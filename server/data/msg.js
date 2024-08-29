const connect = {};

function getFlag() {
  return Math.random().toFixed(10).slice(-10);
}
function get(key, cb, info) {
  if (!connect.hasOwnProperty(key)) {
    connect[key] = {
      flag: getFlag(),
      msgs: [],
      cbs: [],
      onlines: [],
    };
  }
  const time = Date.now();
  connect[key]['cbs'].push(cb);
  connect[key]['t'] = time;
  connect[key]['onlines'].push({ os: info.os, ip: info.ip, time });
  const temObj = {};
  connect[key]['onlines'] = connect[key]['onlines']
    .filter((item) => time - item.time < 30 * 1000)
    .filter((item) =>
      temObj.hasOwnProperty(typeof item.os + item.os)
        ? false
        : (temObj[typeof item.os + item.os] = true)
    );
  clean(time);
  return connect[key];
}
function set(key, id, data) {
  if (!connect.hasOwnProperty(key)) return;
  const flag = getFlag();
  const obj = { id, flag, data };
  connect[key].flag = flag;
  connect[key].msgs.push(obj);
  connect[key].msgs = connect[key].msgs.slice(-100);
  connect[key]['cbs'].forEach((item) => {
    item && item();
  });
}
function clean(time) {
  Object.keys(connect).forEach((key) => {
    const { t } = connect[key];
    if (time - t > 1000 * 60) {
      delete connect[key];
    }
  });
}
function getConnect() {
  return connect;
}
const msg = {
  get,
  set,
  getConnect,
};
module.exports = msg;
