import { CacheByExpire } from './cache';

export const imgCache = {
  cache: new CacheByExpire(60 * 60 * 1000, 80 * 60 * 1000),
  add(url, src) {
    this.cache.set(url, src);
  },
  get(url) {
    return this.cache.get(url);
  },
  delete(url) {
    this.cache.delete(url);
  },
  clear() {
    this.cache.clear();
  },
};
