import { Client } from 'ssh2';
import { CacheByExpire } from '../../utils/cache.js';
import { devLog } from '../../utils/utils.js';
import _connect from '../../utils/connect.js';

function closeSSHClient(sshClient) {
  try {
    sshClient.end();
  } catch (error) {
    devLog(error);
  }
}

// 缓存SSH连接
const sshCache = new CacheByExpire(60 * 1000, 60 * 1000, {
  beforeDelete(_, ssh) {
    if (ssh) {
      closeSSHClient(ssh.sshClient);
    }
  },
  beforeReplace(_, ssh) {
    if (ssh) {
      closeSSHClient(ssh.sshClient);
    }
  },
});

// 创建SSH连接
export function getSSH(temid) {
  return sshCache.get(temid);
}

// 重置过期时间
export function resetSSHExpireTime(temid) {
  sshCache.resetExpireTime(temid);
}

// 创建终端
export function createTerminal(account, temid, config) {
  const sshClient = new Client();
  sshClient.on('ready', () => {
    sshClient.shell((err, stream) => {
      if (err)
        return _connect.send(
          account,
          temid,
          {
            type: 'ssh',
            data: 'open shell failed\n',
          },
          'self'
        );
      stream.on('data', (d) =>
        _connect.send(
          account,
          temid,
          {
            type: 'ssh',
            data: d.toString(),
          },
          'self'
        )
      );
      stream.stderr.on('data', (d) =>
        _connect.send(
          account,
          temid,
          {
            type: 'ssh',
            data: d.toString(),
          },
          'self'
        )
      );

      sshCache.set(temid, { stream, sshClient });
    });
  });

  sshClient.on('error', (err) => {
    _connect.send(
      account,
      temid,
      {
        type: 'ssh',
        data: 'SSH error: ' + err.message,
      },
      'self'
    );
    sshClient.end();
  });

  // 连接 SSH
  const connectCfg = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
  };
  if (config.auth_type === 'password') connectCfg.password = config.password;
  if (config.auth_type === 'key') {
    connectCfg.privateKey = config.private_key;
    connectCfg.passphrase = config.passphrase;
  }
  sshClient.connect(connectCfg);
}
