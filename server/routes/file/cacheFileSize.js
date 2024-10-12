import { CacheByExpire } from '../../utils/cache.js';

const fileSize = {
  cache: new CacheByExpire(20 * 60 * 1000, 30 * 60 * 1000),

  // 生成键名
  generateKey(p) {
    return `h_${p}`;
  },

  // 添加缓存
  add(p, size) {
    const key = this.generateKey(p);
    this.cache.set(key, { size });
  },

  // 获取缓存
  get(p) {
    const key = this.generateKey(p);
    const value = this.cache.get(key);
    return value ? value.size : 0;
  },
};

export default fileSize;
