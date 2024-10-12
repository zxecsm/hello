import { CacheByExpire } from './cache.js';
import { nanoid } from './utils.js';

const cache = new CacheByExpire(5 * 60 * 60 * 1000, 1000 * 60 * 30);

const fileKey = {
  add(account, p) {
    const key = `${nanoid()}-${Date.now()}`;

    if (account) {
      cache.set(key, { account, p });
    }

    return key;
  },
  get(key) {
    return cache.get(key);
  },
  clear(account) {
    cache.clearByValue('account', account);
  },
};

export default fileKey;
