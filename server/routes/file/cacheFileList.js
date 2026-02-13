import { CacheByExpire } from '../../utils/cache.js';

// 缓存文件列表
const fileList = {
  cache: new CacheByExpire(10 * 60 * 1000, 10 * 60 * 1000),

  // 添加缓存
  add(account, key, list) {
    this.cache.set(`${account}_${key}`, { list });
  },

  // 获取缓存
  get(account, key) {
    const value = this.cache.get(`${account}_${key}`);
    return value ? value.list : null;
  },

  // 清空缓存
  clear(account) {
    this.cache.clearByValue((k) => {
      return k.startsWith(`${account}_`);
    });
  },
  resetExpireTime(account, key) {
    this.cache.resetExpireTime(`${account}_${key}`);
  },
};

export default fileList;
