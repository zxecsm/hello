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
const dataConfigPath = appConfig.dataDir('config.json');

// 加载默认配置
let config = loadConfig(defaultConfigPath);
config.tokenKey = _crypto.generateSecureKey();

// 合并配置文件
if (_f.fs.existsSync(dataConfigPath)) {
  config = { ...config, ...loadConfig(dataConfigPath) };
}

// 保存配置文件（异步 + 原子替换，避免阻塞事件循环）
let saving = false;
let savePending = false;

async function saveConfig() {
  // 正在写入时只做标记，等本轮写完后再写一次最新配置
  if (saving) {
    savePending = true;
    return;
  }

  saving = true;

  try {
    do {
      savePending = false;

      await _f.fsp.mkdir(_path.dirname(dataConfigPath), { recursive: true });

      const tmpPath = `${dataConfigPath}.tmp`;
      await _f.fsp.writeFile(tmpPath, JSON.stringify(_d, null, 2));
      await _f.fsp.rename(tmpPath, dataConfigPath);
    } while (savePending);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    saving = false;
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
