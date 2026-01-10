import { CacheByExpire } from './cache.js';
import nanoid from './nanoid.js';

const cache = new CacheByExpire(60 * 1000, 60 * 1000);

// 添加连接信息并设置回调
function add(account, cb, client) {
  const now = Date.now();

  let connect = get(account);
  // 初始化连接
  if (connect) {
    cache.resetExpireTime(account);
  } else {
    connect = {
      flag: nanoid(),
      msgs: [],
      cbs: [],
      onlines: [],
    };
    cache.set(account, connect);
  }

  connect.cbs.push(cb);

  if (client?.temid) {
    const clientInfo = connect.onlines.find(
      (item) => item.temid === client.temid
    );
    if (clientInfo) {
      Object.assign(clientInfo, client);
    } else {
      connect.onlines.push({
        ...client,
        time: now,
      });
    }

    // 清理超过 30 秒未活跃的在线设备
    connect.onlines = connect.onlines.filter(
      (item) => now - item.time < 30 * 1000 && item.page === 'home'
    );
  }

  return connect;
}

// 发送消息
function send(account, temid, data, to = 'all') {
  const connect = get(account);
  if (!connect) return;

  const now = Date.now();
  const flag = nanoid();
  const message = { id: temid, flag, data, time: now, to };

  // 更新 flag 并存入消息
  connect.flag = flag;
  connect.msgs.push(message);

  // 清理超过 60 秒的消息
  connect.msgs = connect.msgs.filter((item) => now - item.time < 1000 * 60);
  // 执行所有回调函数
  connect.cbs.forEach((cb) => {
    cb && cb();
  });
}

function getMessages(account, temid, flag) {
  const connect = get(account);
  if (!connect) return [];

  // 获取未读取的消息
  let msgs = connect.msgs.slice(0);

  const idx = msgs.findIndex((item) => item.flag === flag);

  if (idx >= 0) {
    msgs = msgs.slice(idx + 1);
  }

  // 过滤掉发送者
  msgs = msgs.filter((item) => {
    const { id, to } = item;
    if (to === 'all') return true;
    if (to === 'self' && id === temid) return true;
    if (to === 'other' && id !== temid) return true;
  });

  return msgs.map((item) => item.data);
}

function get(account) {
  return cache.get(account);
}

// 获取所有连接信息
function getConnects() {
  return cache.getCacheData();
}

const _connect = {
  add,
  send,
  getConnects,
  get,
  getMessages,
};

export default _connect;
