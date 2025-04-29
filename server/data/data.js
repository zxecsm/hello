import { resolve } from 'path';
import appConfig from './config.js';

import _f from '../utils/f.js';
import { getDirname } from '../utils/utils.js';
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

// 创建深度代理，自动保存配置
export const _d = deepProxy(config, saveConfig);

// 保存配置到文件
saveConfig();

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

// 保存配置文件
function saveConfig() {
  _f.fs.mkdirSync(_path.dirname(dataConfigPath), { recursive: true });
  _f.fs.writeFileSync(dataConfigPath, JSON.stringify(_d, null, 2));
}

// 代理
function deepProxy(target, callback) {
  const handler = {
    get(target, key) {
      const value = Reflect.get(target, key);
      return value !== null && typeof value === 'object'
        ? new Proxy(value, handler)
        : value;
    },
    set(target, key, value) {
      const result = Reflect.set(target, key, value);
      callback && callback();
      return result;
    },
  };
  return new Proxy(target, handler);
}
