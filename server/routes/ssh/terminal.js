import { Client } from 'ssh2';
import { CacheByExpire } from '../../utils/cache.js';
import { devLog, uLog } from '../../utils/utils.js';
import _connect from '../../utils/connect.js';

// 清理 SSH 资源（幂等）
function closeSSH(sshObj, temid) {
  if (!sshObj || sshObj._closed) return;
  sshObj._closed = true;

  uLog(false, `断开SSH: ${temid}`);
  try {
    if (sshObj.stream) {
      sshObj.stream.removeAllListeners('data');
      sshObj.stream.removeAllListeners('close');
      sshObj.stream.removeAllListeners('error');

      // 先关闭，再强制销毁
      sshObj.stream.end?.();
      sshObj.stream.destroy?.();
    }

    if (sshObj.sshClient) {
      sshObj.sshClient.end();
      sshObj.sshClient.destroy?.();
    }
  } catch (e) {
    devLog('SSH cleanup error:', e);
  }
}

// SSH 连接缓存
const sshCache = new CacheByExpire(60 * 1000, 60 * 1000, {
  beforeDelete(temid, ssh) {
    closeSSH(ssh, temid);
  },
  beforeReplace(temid, ssh) {
    closeSSH(ssh, temid);
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
    sshClient.shell({ term: 'xterm-256color' }, (err, stream) => {
      if (err) {
        _connect.send(account, temid, { type: 'ssh', data: `SSH Error: ${err.message}` }, 'self');
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

  if (config.auth_type === 'password') {
    connectCfg.password = config.password;
  }

  if (config.auth_type === 'key') {
    connectCfg.privateKey = config.private_key;
    connectCfg.passphrase = config.passphrase;
  }

  sshClient.connect(connectCfg);
}
