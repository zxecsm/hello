const { resolve } = require('path');
const configObj = require('./config');
const _f = require('../utils/f');
let config = JSON.parse(_f.c.readFileSync(resolve(__dirname, 'config.json')));
const configP = `${configObj.filepath}/data/config.json`;
config.tokenKey = generateKey(30);
if (_f.c.existsSync(configP)) {
  config = Object.assign(config, JSON.parse(_f.c.readFileSync(configP)));
}
const _d = deepProxy(config, save);
save();
function save() {
  _f.c.mkdirSync(`${configObj.filepath}/data`, { recursive: true });
  _f.c.writeFileSync(configP, JSON.stringify(_d, null, 2));
}
function deepProxy(target, callback) {
  const handler = {
    get(target, key) {
      const res = Reflect.get(target, key);
      return res !== null && typeof res === 'object'
        ? new Proxy(res, handler)
        : res;
    },
    set(target, key, value) {
      const res = Reflect.set(target, key, value);
      callback && callback();
      return res;
    },
  };
  return new Proxy(target, handler);
}
function generateKey(keyLength) {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  const charactersLength = characters.length;
  for (let i = 0; i < keyLength; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
module.exports = { _d, generateKey };
