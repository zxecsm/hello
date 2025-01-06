import { CacheByExpire } from '../../utils/cache.js';

// 缓存文件夹大小
const fileSize = {
  cache: new CacheByExpire(20 * 60 * 1000, 30 * 60 * 1000),

  // 添加缓存
  add(key, size) {
    this.cache.set(key, { size });
  },

  // 获取缓存
  get(key) {
    const value = this.cache.get(key);
    return value ? value.size : 0;
  },
};

export default fileSize;
