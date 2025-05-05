import { resolve } from 'path';
import appConfig from './config.js';

import _f from '../utils/f.js';
import { debounce, getDirname } from '../utils/utils.js';
import _path from '../utils/path.js';
import _crypto from '../utils/crypto.js';

const __dirname = getDirname(import.meta);

// 默认配置路径
const defaultConfigPath = resolve(__dirname, 'config.json');

// 配置路径
const dataConfigPath = _path.normalize(`${appConfig.appData}/data/config.json`);

// 加载默认配置
let config = loadConfig(defaultConfigPath);
config.tokenKey = _crypto.generateSecureKey();

// 合并配置文件
if (_f.fs.existsSync(dataConfigPath)) {
  config = { ...config, ...loadConfig(dataConfigPath) };
}

// 保存配置文件
function saveConfig() {
  try {
    _f.fs.mkdirSync(_path.dirname(dataConfigPath), { recursive: true });
    _f.fs.writeFileSync(dataConfigPath, JSON.stringify(_d, null, 2));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

const saveConfigDebounced = debounce(saveConfig, 100);

// 创建深度代理，自动保存配置
export const _d = deepProxy(config, saveConfigDebounced);

// 保存配置到文件
saveConfigDebounced();

// 读取配置文件
function loadConfig(path) {
  try {
    return JSON.parse(_f.fs.readFileSync(path, 'utf-8'));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return {};
  }
}

// 代理
function deepProxy(target, callback, cache = new WeakMap()) {
  if (cache.has(target)) {
    return cache.get(target);
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (value && typeof value === 'object') {
        return deepProxy(value, callback, cache);
      }
      return value;
    },
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver);
      callback && callback();
      return result;
    },
    deleteProperty(obj, key) {
      const result = Reflect.deleteProperty(obj, key);
      callback && callback();
      return result;
    },
  });

  cache.set(target, proxy);
  return proxy;
}
