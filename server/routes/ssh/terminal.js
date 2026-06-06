import { Client } from 'ssh2';
import { CacheByExpire } from '../../utils/cache.js';
import { concurrencyTasks, devLog } from '../../utils/utils.js';
import _connect from '../../utils/connect.js';
import _path from '../../utils/path.js';

// 清理 SSH 资源（优化顺序与安全性）
function closeSSH(sshObj) {
  if (!sshObj || sshObj._closed) return;
  sshObj._closed = true;

  try {
    // 1. 先关闭主客户端（让其自然通知远程断开）
    if (sshObj.sshClient) {
      sshObj.sshClient.removeAllListeners(); // 移除监听，防止断开时触发全局的 close/error
      try {
        sshObj.sshClient.end();
      } catch {}
    }

    // 2. 移除并销毁外部流
    if (sshObj.stream) {
      sshObj.stream.removeAllListeners();
      try {
        sshObj.stream.end?.();
      } catch {}
      try {
        sshObj.stream.destroy?.();
      } catch {}
    }

    // 3. 移除并销毁 SFTP
    if (sshObj.sftp) {
      sshObj.sftp.removeAllListeners();
      try {
        sshObj.sftp.end?.();
      } catch {}
      try {
        sshObj.sftp.destroy?.();
      } catch {}
    }

    // 4. 彻底强制断开 TCP 连接
    if (sshObj.sshClient) {
      try {
        sshObj.sshClient.destroy?.();
      } catch {}
    }
  } catch (e) {
    devLog('SSH cleanup error:', e);
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

  // 先放入 cache，占位，避免“ready 但 shell 失败”失控
  sshCache.set(temid, sshObj);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    sshCache.delete(temid);
  };

  sshClient.on('ready', () => {
    // 检查在 ready 期间，该会话是否已经被前端取消或清理了
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
        return cleanup(); // Shell 是核心，失败了则整体销毁
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

      // 2. 启动 SFTP (独立错误处理，不影响 Shell)
      sshClient.sftp((err, sftp) => {
        if (sshObj._closed) {
          if (sftp) sftp.destroy?.();
          return;
        }

        if (err) {
          devLog(`SFTP Init Error for ${temid}:`, err);
          return cleanup();
        }

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
