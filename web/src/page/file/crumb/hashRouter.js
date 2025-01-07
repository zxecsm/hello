const hashRouter = {
  data: new Map(),
  get(key) {
    return this.data.get(key);
  },
  set(key, value) {
    this.data.set(key, value);
  },
  getHash() {
    return decodeURIComponent(window.location.hash.slice(1)) || '/';
  },
  setHash(path) {
    window.location.hash = '#' + path;
  },
  back() {
    window.history.back();
  },
};

export default hashRouter;
