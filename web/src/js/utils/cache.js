export class CacheByExpire {
  constructor(ttl, cleanupInterval = 0, hooks = {}) {
    if (ttl <= 0) {
      throw new Error('TTL must be positive numbers');
    }

    this.ttl = ttl; // 存储缓存过期时间
    this.cache = new Map(); // 使用 Map 来存储缓存

    // 注册钩子
    this.hooks = {
      onSet: hooks.onSet || null, // 设置缓存时的钩子
      onDelete: hooks.onDelete || null, // 删除缓存时的钩子
    };

    if (cleanupInterval > 0) {
      this.cleanupIntervalId = setInterval(
        () => this.cleanup(),
        cleanupInterval
      ); // 定时清理缓存
    }

    this.cleanupInterval = cleanupInterval; // 清理间隔
    this.isDestroyed = false; // 标记缓存是否被销毁
  }

  // 重置条目的过期时间
  resetExpireTime(key, ttl = this.ttl) {
    if (this.isDestroyed) return;

    const entry = this.cache.get(key);
    if (entry) {
      entry.expireTime = Date.now() + ttl;
    }
  }

  // 保存缓存条目
  set(key, value, ttl = this.ttl) {
    if (this.isDestroyed) return;

    const expireTime = Date.now() + ttl; // 设置条目的过期时间
    this.cache.set(key, { value, expireTime });

    if (this.cleanupInterval === 0) {
      this.cleanup();
    }

    this.hooks.onSet?.(key, value);
  }

  // 获取缓存条目
  get(key) {
    if (this.isDestroyed) return null;

    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expireTime) {
      return entry.value; // 返回缓存值
    }

    // 如果条目过期或不存在，删除该条目
    this.delete(key, entry ? entry.value : undefined);
    return null; // 缓存已过期或不存在
  }

  // 获取缓存条目数
  size() {
    return this.cache.size;
  }

  // 获取缓存的数据
  getCacheData() {
    if (this.isDestroyed) return;

    this.cleanup();

    const data = {};
    for (const [key, { value }] of this.cache) {
      data[key] = value;
    }
    return data;
  }

  // 删除过期的缓存条目
  cleanup() {
    if (this.isDestroyed) return; // 如果缓存已经销毁，停止清理

    const now = Date.now();
    // 如果距离上次清理时间超过了设置的清理间隔
    for (const [key, { expireTime, value }] of this.cache) {
      if (expireTime <= now) {
        this.delete(key, value);
      }
    }
  }

  // 删除指定条件的缓存项目
  clearByValue(matches) {
    if (this.isDestroyed || typeof matches !== 'function') return;

    // 遍历缓存，删除匹配的条目
    for (const [k, { value: v }] of this.cache) {
      if (matches(k, v)) {
        this.delete(k, v); // 删除匹配的缓存条目
      }
    }
  }

  // 清空缓存数据
  clear() {
    if (this.isDestroyed) return;
    this.clearByValue(() => true);
  }

  // 删除缓存条目
  delete(key, value) {
    if (this.isDestroyed) return;
    this.cache.delete(key);
    this.hooks.onDelete?.(key, value);
  }

  // 销毁
  destroy() {
    if (this.isDestroyed) return; // 如果已经销毁，则不重复销毁

    this.clear();

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId); // 停止定时清理任务
    }

    this.isDestroyed = true; // 设置销毁标志
  }
}
