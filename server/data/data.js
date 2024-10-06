import { resolve } from 'path';
import configObj from './config.js';

import _f from '../utils/f.js';
import { getDirname } from '../utils/utils.js';

const __dirname = getDirname(import.meta);

const configPath = resolve(__dirname, 'config.json');

const dataConfigPath = `${configObj.filepath}/data/config.json`;

// 加载默认配置
let config = loadConfig(configPath);
config.tokenKey = generateKey(30);

// 合并已有的配置文件
if (_f.c.existsSync(dataConfigPath)) {
  const fileConfig = loadConfig(dataConfigPath);
  config = { ...config, ...fileConfig };
}

// 创建深度代理，自动保存配置
export const _d = deepProxy(config, saveConfig);

// 保存当前配置到文件
saveConfig();

/**
 * 读取配置文件
 * @param {string} path - 配置文件路径
 * @returns {object} - 返回配置对象
 */
function loadConfig(path) {
  try {
    const data = _f.c.readFileSync(path, 'utf-8');
    return JSON.parse(data);
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return {};
  }
}

/**
 * 保存配置文件
 */
function saveConfig() {
  const dataDir = `${configObj.filepath}/data`;
  _f.c.mkdirSync(dataDir, { recursive: true });
  _f.c.writeFileSync(dataConfigPath, JSON.stringify(_d, null, 2));
}

/**
 * 创建深度代理，用于监控对象的变更并保存
 * @param {object} target - 目标对象
 * @param {function} callback - 变更后的回调函数
 * @returns {Proxy} - 返回代理对象
 */
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

/**
 * 生成指定长度的随机密钥
 * @param {number} keyLength - 密钥长度
 * @returns {string} - 返回生成的密钥
 */
export function generateKey(keyLength) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  return Array.from({ length: keyLength }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join('');
}
