const connect = {};

// 获取随机 flag
function getFlag() {
  return Math.random().toFixed(10).slice(-10);
}

// 获取连接信息并设置回调
function get(key, cb, info) {
  // 初始化连接
  if (!connect[key]) {
    connect[key] = {
      flag: getFlag(),
      msgs: [],
      cbs: [],
      onlines: [],
    };
  }

  const connection = connect[key];
  const time = Date.now();

  // 添加回调
  connection.cbs.push(cb);
  connection.t = time;

  // 记录客户端在线信息
  connection.onlines.push({ os: info.os, ip: info.ip, time });

  // 清理超过 30 秒未活跃的在线用户
  const seen = {};
  connection.onlines = connection.onlines
    .filter((item) => time - item.time < 30 * 1000)
    .filter((item) => !seen[item.os] && (seen[item.os] = true));

  // 清理超时连接
  clean(time);

  return connection;
}

// 设置消息并触发回调
function set(key, id, data) {
  if (!connect[key]) return;

  const connection = connect[key];
  const flag = getFlag();
  const message = { id, flag, data };

  // 更新 flag 并存入消息
  connection.flag = flag;
  connection.msgs.push(message);

  // 限制消息队列长度为 100
  if (connection.msgs.length > 100) {
    connection.msgs.shift();
  }

  // 执行所有回调函数
  connection.cbs.forEach((cb) => {
    cb && cb();
  });
}

// 清理超过 1 分钟未活动的连接
function clean(time) {
  Object.keys(connect).forEach((key) => {
    const { t } = connect[key];
    if (time - t > 1000 * 60) {
      delete connect[key];
    }
  });
}

// 获取当前连接信息
function getConnect() {
  return connect;
}

// 导出 msg 对象
const msg = {
  get,
  set,
  getConnect,
};
module.exports = msg;
