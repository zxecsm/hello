const bus = {
  cbs: {},
  on(type, cb) {
    this.cbs[type] ? this.cbs[type].push(cb) : (this.cbs[type] = [cb]);
  },
  emit(type, ...arg) {
    this.cbs[type] &&
      this.cbs[type].forEach((cb) => {
        cb && cb(...arg);
      });
  },
  cancel(type, cb) {
    if (this.cbs[type]) {
      if (cb) {
        this.cbs[type] = this.cbs[type].filter((item) => item !== cb);
      } else {
        delete this.cbs[type];
      }
    } else {
      this.cbs = {};
    }
  },
};
export default bus;
