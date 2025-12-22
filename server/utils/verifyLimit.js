import { CacheByExpire } from './cache.js';

class VerifyLimit {
  constructor(opt = {}, updateTimestamp = true) {
    const defaultOpt = {
      space: 10 * 60, // 秒
      count: 3, // 次
    };

    this.opt = Object.assign(defaultOpt, opt);
    this.updateTimestamp = updateTimestamp; // true: 间隔 10*60 秒 3 次  false: 10*60 秒内 3 次
    this.cache = new CacheByExpire(this.opt.space * 1000);
  }

  add(ip, flag = '') {
    const key = 'key_' + ip + flag;

    const data = this.cache.get(key);

    if (data) {
      data.count++;

      if (this.updateTimestamp) {
        this.cache.resetExpireTime(key);
      }
    } else {
      this.cache.set(key, { count: 1 });
    }
  }

  verify(ip, flag = '') {
    const key = 'key_' + ip + flag;

    const data = this.cache.get(key);

    if (data && data.count >= this.opt.count) {
      return false;
    }

    return true;
  }

  delete(ip, flag = '') {
    const key = 'key_' + ip + flag;

    this.cache.delete(key);
  }
}

function verifyLimit(opt = {}, updateTimestamp = true) {
  return new VerifyLimit(opt, updateTimestamp);
}

export default verifyLimit;
