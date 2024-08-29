const { nanoid } = require('./utils');
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
  clear() {
    const t = Date.now();
    Object.keys(this.keys).forEach((key) => {
      if (t - key.split('-')[1] >= exp) {
        delete this.keys[key];
      }
    });
  },
};
module.exports = fileKey;
