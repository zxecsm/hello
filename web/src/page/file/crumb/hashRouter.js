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
    this.data.delete(path);
    window.location.hash = '#' + path;
  },
  back() {
    window.history.back();
  },
  forward() {
    window.history.forward();
  },
};

export default hashRouter;
