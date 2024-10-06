import { nanoid } from './utils.js';
const exp = 5 * 60 * 60 * 1000;

const fileKey = {
  keys: {},
  add(account, p) {
    const key = `${nanoid()}-${Date.now()}`;

    if (account) {
      this.keys[key] = { account, p };
    }

    return key;
  },
  get(key) {
    this.clear();
    return this.keys[key];
  },
  clear(account) {
    if (account) {
      Object.keys(this.keys).forEach((key) => {
        const value = this.keys[key];
        if (value.account === account) {
          delete this.keys[key];
        }
      });
    } else {
      const t = Date.now();
      Object.keys(this.keys).forEach((key) => {
        if (t - key.split('-')[1] >= exp) {
          delete this.keys[key];
        }
      });
    }
  },
};

export default fileKey;
