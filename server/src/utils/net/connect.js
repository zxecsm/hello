import { CacheByExpire } from '../common/cache.js';
import nanoid from '../common/nanoid.js';

const cache = new CacheByExpire(60 * 1000, 60 * 1000);

// 消息保留时间
const MSG_TTL = 30 * 1000;

// 添加连接信息并设置回调
// client: { temid, page, pages, ip, os }
// pages 为页面标识集合，支持一个连接替多个页面收消息（home 外壳代收子窗口）
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
    const pages =
      Array.isArray(client.pages) && client.pages.length
        ? client.pages
        : client.page
          ? [client.page]
          : [];

    const clientInfo = connect.onlines.find((item) => item.temid === client.temid);
    client.time = now;
    client.pages = pages;
    if (clientInfo) {
      Object.assign(clientInfo, client);
    } else {
      connect.onlines.push(client);
    }

    // 清理超过 30 秒未活跃的在线设备
    connect.onlines = connect.onlines.filter(
      (item) => now - item.time < 30 * 1000 && item.pages.includes('home'),
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
  const message = { from: temid, flag, data, time: now, to };

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

// 获取消息
// temids：本连接代收的所有客户端ID（已带账号前缀）；不传则只收自己的
// 统一返回 { from, to, data }：
//   from 发送方客户端ID，to 投递目标（all / other / self / 某个客户端ID）
//   from/to 会去掉账号前缀，方便页面直接和自己的临时ID比对
function getMessages(account, temid, flag, temids) {
  const connect = get(account);
  if (!connect) return [];

  const msgs = connect.msgs;
  const idx = flag ? msgs.findIndex((item) => item.flag === flag) : -1;

  const clients = new Set(Array.isArray(temids) && temids.length ? temids : [temid]);
  clients.add(temid);

  // 去掉账号前缀（'all' / 'other' / 'self' 等关键字保持原样）
  const plain = (val) =>
    val && val !== 'all' && val !== 'other' && val !== 'self' && val.startsWith(account)
      ? val.slice(account.length)
      : val;

  // 从已读位置开始，一趟遍历完成过滤
  const result = [];

  for (let i = idx + 1; i < msgs.length; i++) {
    const { from, to, data } = msgs[i];

    let hit;
    if (to === 'all') {
      hit = true;
    } else if (to === 'other') {
      // 广播给除发送方以外的客户端：发送方在自己代收范围内时，
      // 只有还代收着别的客户端才需要下发（单连接就是发给自己，直接跳过）
      hit = !clients.has(from) || clients.size > 1;
    } else if (to === 'self') {
      // 只给发起方，发起方必须在本连接代收的范围内
      hit = clients.has(from);
    } else {
      // 定向到某个客户端，目标必须在本连接代收的范围内
      hit = clients.has(to);
    }

    if (hit) {
      result.push({ from: plain(from), to: plain(to), data });
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
