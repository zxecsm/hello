const fileSize = {
  keys: {},
  CACHE_DURATION: 20 * 60 * 1000,

  // 生成键名
  generateKey(p) {
    return `h_${p}`;
  },

  // 添加缓存
  add(p, size) {
    const key = this.generateKey(p);
    this.keys[key] = { size, t: Date.now() };
  },

  // 获取缓存
  get(p) {
    this.clear();
    const key = this.generateKey(p);
    const value = this.keys[key];
    return value ? value.size : 0;
  },

  // 清理过期缓存
  clear() {
    const now = Date.now();
    Object.keys(this.keys).forEach((key) => {
      if (now - this.keys[key].t >= this.CACHE_DURATION) {
        delete this.keys[key]; // 删除过期的缓存
      }
    });
  },
};

export default fileSize;
