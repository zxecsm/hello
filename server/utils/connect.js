import { CacheByExpire } from './cache.js';
import nanoid from './nanoid.js';

const cache = new CacheByExpire(60 * 1000, 60 * 1000);

// 消息保留时间
const MSG_TTL = 30 * 1000;

// 添加连接信息并设置回调
function add(account, cb, client) {
  const now = Date.now();

  // 命中则续期，未命中则初始化连接
  const connect = cache.getOrSet(
    account,
    () => ({
      flag: nanoid(),
      msgs: [],
      cbs: [],
      onlines: [],
    }),
    { refresh: true },
  );

  connect.cbs.push(cb);

  if (client?.temid) {
    const clientInfo = connect.onlines.find((item) => item.temid === client.temid);
    client.time = now;
    if (clientInfo) {
      Object.assign(clientInfo, client);
    } else {
      connect.onlines.push(client);
    }

    // 清理超过 30 秒未活跃的在线设备
    connect.onlines = connect.onlines.filter(
      (item) => now - item.time < 30 * 1000 && item.page === 'home',
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
  data.fromID = temid;
  const message = { id: temid, flag, data, time: now, to };

  // 更新 flag 并存入消息
  connect.flag = flag;
  connect.msgs.push(message);

  // 消息按时间顺序追加，从头部移除过期消息即可
  const deadline = now - MSG_TTL;
  while (connect.msgs.length && connect.msgs[0].time < deadline) {
    connect.msgs.shift();
  }

  // 执行所有回调函数
  connect.cbs.forEach((cb) => {
    cb && cb();
  });
}

function getMessages(account, temid, flag) {
  const connect = get(account);
  if (!connect) return [];

  const msgs = connect.msgs;
  const idx = flag ? msgs.findIndex((item) => item.flag === flag) : -1;

  // 从已读位置开始，一趟遍历完成过滤
  const result = [];

  for (let i = idx + 1; i < msgs.length; i++) {
    const { id, to, data } = msgs[i];

    if (
      to === 'all' ||
      to === temid ||
      (to === 'self' && id === temid) ||
      (to === 'other' && id !== temid)
    ) {
      result.push(data);
    }
  }

  return result;
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
