import { Client } from 'ssh2';
import { CacheByExpire } from '../../utils/cache.js';
import { concurrencyTasks, writelog } from '../../utils/utils.js';
import _connect from '../../utils/connect.js';
import _path from '../../utils/path.js';

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
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    sshCache.delete(temid);
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

      stream.on('data', (d) => {
        _connect.send(account, temid, { type: 'ssh', data: d.toString() }, 'self');
      });

      stream.on('close', cleanup);
      stream.on('error', cleanup);

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

  const result = [];

  await concurrencyTasks(list, 5, async (item) => {
    const { filename: name, longname } = item;
    const fullPath = _path.normalizeNoSlash(dirPath, name);

    let type = 'file';
    let mtime = 0;

    try {
      const st = await new Promise((resolve, reject) => {
        sftp.stat(fullPath, (err, stat) => {
          if (err) return reject(err);
          resolve(stat);
        });
      });

      if (st.isDirectory()) {
        type = 'dir';
      }

      mtime = st.mtime || 0;
    } catch {}

    result.push({
      type,
      path: dirPath,
      name,
      longname,
      mtime,
    });
  });

  result.sort((a, b) => b.mtime - a.mtime);

  return result;
}
