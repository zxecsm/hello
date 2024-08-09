class VerifyLimit {
  constructor(opt = {}) {
    const defaultOpt = {
      space: 10, // 分
      count: 3, // 次
    };
    this.opt = Object.assign(defaultOpt, opt);
    this.data = {};
  }
  add(ip, flag = '') {
    const key = 'key_' + ip + flag;
    const t = Date.now();
    if (this.data.hasOwnProperty(key)) {
      this.data[key]['n']++;
      this.data[key]['t'] = t;
    } else {
      this.data[key] = { n: 1, t };
    }
  }
  verify(ip, flag = '') {
    const key = 'key_' + ip + flag;
    const nt = Date.now();
    Object.keys(this.data).forEach((k) => {
      const { t } = this.data[k];
      if (nt - t > this.opt.space * 60 * 1000) {
        delete this.data[k];
      }
    });
    if (
      this.data.hasOwnProperty(key) &&
      this.data[key]['n'] >= this.opt.count
    ) {
      return false;
    }
    return true;
  }
}
function verifyLimit(opt = {}) {
  return new VerifyLimit(opt);
}
module.exports = verifyLimit;
