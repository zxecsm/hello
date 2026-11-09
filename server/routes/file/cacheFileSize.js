import { CacheByExpire } from '../../utils/cache.js';

// 缓存文件夹大小
const fileSize = {
  // 目录大小可随时重新获取，TTL 不宜过长；2 分钟足够减少重复计算
  cache: new CacheByExpire(2 * 60 * 1000, 2 * 60 * 1000),

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
