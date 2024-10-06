class VerifyLimit {
  constructor(opt = {}, updateTimestamp = true) {
    const defaultOpt = {
      space: 10 * 60, // 秒
      count: 3, // 次
    };

    this.opt = Object.assign(defaultOpt, opt);
    this.updateTimestamp = updateTimestamp; // true: 间隔 10*60 秒 3 次  false: 10*60 秒内 3 次
    this.data = {};
  }

  add(ip, flag = '') {
    const key = 'key_' + ip + flag;
    const t = Date.now();
    if (this.data.hasOwnProperty(key)) {
      this.data[key]['n']++;
      if (this.updateTimestamp) {
        this.data[key]['t'] = t;
      }
    } else {
      this.data[key] = { n: 1, t };
    }
  }

  verify(ip, flag = '') {
    const key = 'key_' + ip + flag;
    const nt = Date.now();
    Object.keys(this.data).forEach((k) => {
      const { t } = this.data[k];
      if (nt - t > this.opt.space * 1000) {
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

function verifyLimit(opt = {}, updateTimestamp = true) {
  return new VerifyLimit(opt, updateTimestamp);
}

export default verifyLimit;
