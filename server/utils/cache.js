export class CacheByExpire {
  constructor(
    ttl,
    cleanupInterval = 0,
    { beforeDelete, afterDelete, beforeReplace, afterReplace } = {}
  ) {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('TTL must be a positive finite number');
    }

    if (!Number.isFinite(cleanupInterval) || cleanupInterval < 0) {
      throw new Error('cleanupInterval must be a non-negative number');
    }

    this.ttl = ttl; // 存储缓存过期时间
    this.cache = new Map();

    this.beforeDelete = beforeDelete;
    this.afterDelete = afterDelete;
    this.beforeReplace = beforeReplace;
    this.afterReplace = afterReplace;

    this.cleanupInterval = cleanupInterval; // 清理间隔
    this.isDestroyed = false; // 标记缓存是否被销毁

    if (cleanupInterval > 0) {
      this.cleanupIntervalId = setInterval(
        () => this.cleanup(),
        cleanupInterval
      ); // 定时清理缓存
    }
  }

  // 内部 ttl 校验
  _validateTTL(ttl) {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('TTL must be a positive finite number');
    }
  }

  // 重置条目的过期时间
  resetExpireTime(key, ttl = this.ttl) {
    if (this.isDestroyed) return;

    this._validateTTL(ttl);

    const entry = this.cache.get(key);
    if (entry) {
      entry.expireTime = Date.now() + ttl;
    }
  }

  // 保存缓存条目
  set(key, value, ttl = this.ttl) {
    if (this.isDestroyed) return;

    this._validateTTL(ttl);

    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.beforeReplace?.(key, oldEntry.value, value);
    }

    const expireTime = Date.now() + ttl;
    this.cache.set(key, { value, expireTime });

    if (oldEntry) {
      this.afterReplace?.(key, oldEntry.value, value);
    }

    if (this.cleanupInterval === 0) {
      this.cleanup();
    }
  }

  // 获取缓存条目
  get(key) {
    if (this.isDestroyed) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() < entry.expireTime) {
      return entry.value;
    }

    this.delete(key);
    return null;
  }

  // 获取缓存条目数
  size() {
    if (this.isDestroyed) return 0;
    this.cleanup();
    return this.cache.size;
  }

  // 获取缓存的数据
  getCacheData() {
    if (this.isDestroyed) return {};

    this.cleanup();

    const data = {};
    for (const [key, { value }] of this.cache) {
      data[key] = value;
    }
    return data;
  }

  // 删除过期的缓存条目
  cleanup() {
    if (this.isDestroyed) return;

    const now = Date.now();
    const expiredKeys = [];

    for (const [key, { expireTime }] of this.cache) {
      if (expireTime <= now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }

  // 删除指定条件的缓存项目
  clearByValue(matches) {
    if (this.isDestroyed || typeof matches !== 'function') return;

    const keysToDelete = [];

    for (const [k, { value: v }] of this.cache) {
      if (matches(k, v)) {
        keysToDelete.push(k);
      }
    }

    for (const k of keysToDelete) {
      this.delete(k);
    }
  }

  // 清空缓存数据
  clear() {
    if (this.isDestroyed) return;
    this.clearByValue(() => true);
  }

  // 删除缓存条目
  delete(key) {
    if (this.isDestroyed) return;

    const entry = this.cache.get(key);
    if (!entry) return;

    this.beforeDelete?.(key, entry.value);
    this.cache.delete(key);
    this.afterDelete?.(key, entry.value);
  }

  // 销毁缓存
  destroy() {
    if (this.isDestroyed) return;

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      this.delete(key);
    }

    this.isDestroyed = true;
  }
}
