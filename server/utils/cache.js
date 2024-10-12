export class CacheByExpire {
  constructor(ttl, cleanupInterval) {
    if (ttl <= 0 || cleanupInterval <= 0) {
      throw new Error('TTL and cleanupInterval must be positive numbers');
    }

    this.ttl = ttl; // 存储缓存过期时间
    this.cache = new Map(); // 使用 Map 来存储缓存
    this.cleanupIntervalId = setInterval(() => this.cleanup(), cleanupInterval); // 定时清理缓存
    this.cleanupInterval = cleanupInterval; // 清理间隔
    this.isDestroyed = false; // 标记缓存是否被销毁
  }

  // 重置过期时间
  resetExpireTime(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expireTime = Date.now() + this.ttl;
    }
  }

  set(key, value) {
    if (this.isDestroyed) return;

    const expireTime = Date.now() + this.ttl; // 设置条目的过期时间
    this.cache.set(key, { value, expireTime }); // 保存缓存条目
  }

  get(key) {
    if (this.isDestroyed) return null;

    const entry = this.cache.get(key); // 获取缓存条目
    if (entry && Date.now() < entry.expireTime) {
      return entry.value; // 返回缓存值
    }

    // 如果条目过期或不存在，删除该条目
    this.delete(key);
    return null; // 缓存已过期或不存在
  }

  getCacheData() {
    const data = {};
    for (const [key, { value }] of this.cache) {
      data[key] = value;
    }
    return data;
  }

  cleanup() {
    if (this.isDestroyed) return; // 如果缓存已经销毁，停止清理

    const now = Date.now();
    // 如果距离上次清理时间超过了设置的清理间隔
    for (const [key, { expireTime }] of this.cache) {
      if (expireTime <= now) {
        this.delete(key); // 删除过期的缓存条目
      }
    }
  }

  clearByValue(key, value) {
    if (this.isDestroyed || !key) return;

    // 判断匹配的逻辑
    const matches = (v) => {
      if (value === undefined) {
        // 如果 value 为 undefined，只判断 v 是否等于 key
        return key === v;
      } else {
        // 如果 value 被定义，判断是否为对象且包含 key，或者值本身与 key 匹配
        return v && typeof v === 'object' && v[key] === value;
      }
    };

    // 遍历缓存，删除匹配的条目
    for (const [k, { value: v }] of this.cache) {
      if (matches(v)) {
        this.delete(k); // 删除匹配的缓存条目
      }
    }
  }

  clear() {
    if (this.isDestroyed) return;
    this.cache.clear(); // 清空缓存数据
  }

  delete(key) {
    this.cache.delete(key);
  }

  destroy() {
    if (this.isDestroyed) return; // 如果已经销毁，则不重复销毁

    this.clear();
    clearInterval(this.cleanupIntervalId); // 停止定时清理任务
    this.isDestroyed = true; // 设置销毁标志
  }
}
