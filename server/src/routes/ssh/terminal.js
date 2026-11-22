import { Client } from 'ssh2';
import { StringDecoder } from 'node:string_decoder';
import { CacheByExpire } from '../../utils/common/cache.js';
import { writelog, concurrencyTasks } from '../../utils/common/utils.js';
import _connect from '../../utils/net/connect.js';
import _path from '../../utils/common/path.js';

// 清理 SSH 资源（修复竞态与未捕获的错误）
function closeSSH(sshObj) {
  if (!sshObj || sshObj._closed) return;
  sshObj._closed = true;

  // 关键防御：在准备关闭时，挂载一个空函数 error 监听，
  // 确保 end() 或 destroy() 过程中底层异步抛出的任何错误都会被安全拦截，防止炸进程。
  if (sshObj.sshClient) {
    sshObj.sshClient.on('error', () => {});
  }

  try {
    // 1. 优先销毁子通道流（SFTP 和 Stream）
    if (sshObj.stream) {
      sshObj.stream.destroy?.();
    }
    if (sshObj.sftp) {
      sshObj.sftp.destroy?.();
    }
  } catch (e) {
    writelog(null, 'SSH streams cleanup error: ' + e, 500);
  }

  try {
    // 2. 最后关闭并强制断开 TCP 连接
    if (sshObj.sshClient) {
      sshObj.sshClient.end();
      sshObj.sshClient.destroy?.();
    }
  } catch (e) {
    writelog(null, 'SSH client cleanup error: ' + e, 500);
  }
}

// SSH 连接缓存
const sshCache = new CacheByExpire(60 * 1000, 60 * 1000, {
  beforeDelete(_, ssh) {
    closeSSH(ssh);
  },
  beforeReplace(_, ssh) {
    closeSSH(ssh);
  },
});

export function getSSH(temid) {
  return sshCache.get(temid);
}

// 重置过期时间
export function resetSSHExpireTime(temid) {
  sshCache.resetExpireTime(temid);
}

// 创建 SSH 终端
export function createTerminal(account, temid, config, defaultPath = '') {
  // 一个 temid 同一时间只允许一个 SSH 会话
  if (sshCache.get(temid)) {
    sshCache.delete(temid);
  }

  const sshClient = new Client();

  const sshObj = {
    sshClient,
    stream: null,
    sftp: null,
    _closed: false,
  };

  // 先放入 cache 占位
  sshCache.set(temid, sshObj);

  let cleaned = false;
  // 停止 SSH 输出合并器（由 shell 回调赋值）
  let stopSshOutput = null;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    stopSshOutput?.();
    // 仅当缓存里仍是当前会话时才删除，避免旧会话关闭时误删同 key 的新会话
    sshCache.deleteIf(temid, sshObj);
  };

  sshClient.on('ready', () => {
    if (sshObj._closed) return cleanup();

    // 1. 启动 Shell 终端
    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (sshObj._closed) {
        if (stream) stream.destroy?.();
        return;
      }

      if (err) {
        _connect.send(
          account,
          temid,
          { type: 'ssh', data: `SSH Shell Error: ${err.message}` },
          'self',
        );
        return cleanup();
      }

      sshObj.stream = stream;

      // 合并短时间内的终端输出，避免每个 chunk 都走一次推送与消息缓存
      const decoder = new StringDecoder('utf8');
      let sendTimer = null;
      let pending = '';

      const flush = () => {
        if (sendTimer) {
          clearTimeout(sendTimer);
          sendTimer = null;
        }

        if (!pending) return;

        const data = pending;
        pending = '';

        // 连接已关闭（如缓存过期）时直接丢弃未推送内容
        if (sshObj._closed) return;

        _connect.send(account, temid, { type: 'ssh', data }, 'self');
      };

      stopSshOutput = () => {
        if (sendTimer) {
          clearTimeout(sendTimer);
          sendTimer = null;
        }
        pending = '';
      };

      stream.on('data', (d) => {
        pending += decoder.write(d);

        // 单次积压过多时立即推送，避免内存和延迟继续增大
        if (pending.length >= 64 * 1024) {
          flush();
        } else if (!sendTimer) {
          // 40ms 内合并推送
          sendTimer = setTimeout(flush, 40);
        }
      });

      stream.on('close', () => {
        pending += decoder.end();
        flush();
        cleanup();
      });

      stream.on('error', () => {
        stopSshOutput();
        cleanup();
      });

      if (defaultPath) {
        stream.write(`cd ${defaultPath}\r`);
        stream.write('clear\r');
      }

      // 2. 启动 SFTP
      sshClient.sftp((err, sftp) => {
        if (sshObj._closed) {
          if (sftp) sftp.destroy?.();
          return;
        }

        if (err) return cleanup();

        sshObj.sftp = sftp;
        sftp.on('close', cleanup);
        sftp.on('error', cleanup);
      });
    });
  });

  sshClient.on('error', (err) => {
    _connect.send(account, temid, { type: 'ssh', data: `SSH Error: ${err.message}` }, 'self');
    cleanup();
  });

  sshClient.on('close', cleanup);

  const connectCfg = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 10000,
  };

  if (config.auth_type === 'password') connectCfg.password = config.password;
  if (config.auth_type === 'key') {
    connectCfg.privateKey = config.private_key;
    connectCfg.passphrase = config.passphrase;
  }

  sshClient.connect(connectCfg);
}

export async function readSftpDir(sftp, dirPath) {
  const list = await new Promise((resolve) => {
    sftp.readdir(dirPath, (err, list) => {
      if (err) return resolve([]);
      resolve(list || []);
    });
  });

  // readdir 已经返回 attrs，普通目录项无需额外请求
  const result = list.map((item) => {
    const { filename: name, longname, attrs } = item;

    const isDir = !!attrs?.isDirectory?.();
    const isSymlink = !!attrs?.isSymbolicLink?.();

    const info = {
      // 链接本身仍按文件处理
      type: isDir ? 'dir' : 'file',
      fileType: isSymlink ? 'symlink' : 'file',
      path: dirPath,
      name,
      longname,
      // 符号链接的 size 是链接内容长度，先置 0，解析目标后再取目标文件的真实大小
      size: isSymlink ? 0 : attrs?.size || 0,
      mtime: attrs?.mtime || 0,
    };

    if (!isSymlink && !isDir) {
      // SFTP 的 attrs 没有链接数，用 longname 的第二个字段尽力判断硬链接
      const nlink = Number((longname || '').trim().split(/\s+/)[1]);
      info.hardLink = Number.isInteger(nlink) && nlink > 1 ? 1 : 0;
    }

    return info;
  });

  // 只有符号链接需要额外读取目标和目标真实类型，限制并发避免请求风暴
  const links = result.filter((info) => info.fileType === 'symlink');

  await concurrencyTasks(links, 5, async (info) => {
    const p = _path.normalizeNoSlash(dirPath, info.name);

    // 优先取解析后的绝对路径，失败则退回链接内容
    info.linkTarget =
      (await sftpRealpath(sftp, p).catch(() => '')) ||
      (await sftpReadlink(sftp, p).catch(() => ''));

    // 目标真实类型：取不到时按文件处理
    const target = await sftpStat(sftp, p).catch(() => null);
    if (target) {
      const isTargetDir = target.isDirectory();
      info.linkTargetType = isTargetDir ? 'dir' : 'file';
      info.linkTargetTypeName = isTargetDir ? '文件夹' : '文件';
      // 显示目标文件的真实大小，目录为 0
      info.size = isTargetDir ? 0 : target.size || 0;
    } else {
      info.linkTargetType = 'unknown';
      info.linkTargetTypeName = '未知';
    }
  });

  result.sort((a, b) => b.mtime - a.mtime);

  return result;
}

// 读取远端文件状态
export function sftpStat(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.stat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

// 读取远端文件内容
export function sftpReadFile(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.readFile(path, (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}

// 写入远端文件内容
export function sftpWriteFile(sftp, path, data) {
  return new Promise((resolve, reject) => {
    sftp.writeFile(path, data, 'utf8', (err) => {
      err ? reject(err) : resolve();
    });
  });
}

// 新建远端目录
export function sftpMkdir(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(path, (err) => {
      err ? reject(err) : resolve();
    });
  });
}

// 读取远端文件状态（不跟随符号链接）
export function sftpLstat(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.lstat(path, (err, stat) => {
      err ? reject(err) : resolve(stat);
    });
  });
}

// 读取符号链接内容（不跟随）
export function sftpReadlink(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.readlink(path, (err, target) => {
      err ? reject(err) : resolve(target);
    });
  });
}

// 获取符号链接解析后的绝对路径
export function sftpRealpath(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.realpath(path, (err, resolved) => {
      err ? reject(err) : resolve(resolved);
    });
  });
}

// 读取远端目录
export function sftpReaddir(sftp, path) {
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      err ? reject(err) : resolve(list || []);
    });
  });
}

// 远端路径是否存在
export async function sftpExists(sftp, path) {
  try {
    await sftpLstat(sftp, path);
    return true;
  } catch {
    return false;
  }
}

// 重命名/移动远端路径
export function sftpRename(sftp, from, to) {
  return new Promise((resolve, reject) => {
    sftp.rename(from, to, (err) => {
      err ? reject(err) : resolve();
    });
  });
}

// 递归删除远端文件或目录
export async function removeSftpPath(sftp, path) {
  const stat = await sftpLstat(sftp, path);

  if (!stat.isDirectory()) {
    await new Promise((resolve, reject) => {
      sftp.unlink(path, (err) => {
        err ? reject(err) : resolve();
      });
    });
    return;
  }

  const list = await sftpReaddir(sftp, path).catch(() => []);

  for (const item of list) {
    if (item.filename === '.' || item.filename === '..') continue;
    await removeSftpPath(sftp, _path.normalizeNoSlash(path, item.filename));
  }

  await new Promise((resolve, reject) => {
    sftp.rmdir(path, (err) => {
      err ? reject(err) : resolve();
    });
  });
}
