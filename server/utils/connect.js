import { CacheByExpire } from './cache.js';

const cache = new CacheByExpire(60 * 1000, 10 * 60 * 1000);

// 获取随机 flag
function getFlag() {
  return Math.random().toFixed(10).slice(-10);
}

// 添加连接信息并设置回调
function add(account, cb, info) {
  const time = Date.now();

  let connect = get(account);
  // 初始化连接
  if (connect) {
    cache.resetExpireTime(account);
  } else {
    cache.set(account, {
      flag: getFlag(),
      msgs: [],
      cbs: [],
      onlines: [],
    });
    connect = get(account);
  }

  connect.cbs.push(cb);
  connect.onlines.push({ os: info.os, ip: info.ip, time, temid: info.temid });

  // 清理超过 30 秒未活跃的在线设备
  const seen = new Map();
  connect.onlines = connect.onlines
    .filter((item) => time - item.time < 30 * 1000)
    .filter((item) => !seen.has(item.temid) && seen.set(item.temid, true));

  return connect;
}

// 发送消息
function send(account, id, data) {
  const connect = get(account);

  if (!connect) return;

  const flag = getFlag();
  const message = { id, flag, data };

  // 更新 flag 并存入消息
  connect.flag = flag;
  connect.msgs.push(message);

  // 限制消息队列长度为 100
  if (connect.msgs.length > 100) {
    connect.msgs.shift();
  }

  // 执行所有回调函数
  connect.cbs.forEach((cb) => {
    cb && cb();
  });
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
};

export default _connect;
