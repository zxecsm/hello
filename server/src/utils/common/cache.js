// 无定时清理时，set 触发惰性清理的间隔范围
// 避免每次写入都全量扫描，把清理成本摊销到多次写入上
const MIN_AUTO_CLEANUP_INTERVAL = 1000;
const MAX_AUTO_CLEANUP_INTERVAL = 60 * 1000;

// 已创建的缓存实例（弱引用），供健康检查等运维接口汇总运行状态。
// 用 WeakRef 避免注册表本身阻止缓存实例被回收；实例被 GC 时由 FinalizationRegistry 自动摘除。
const registry = new Set();
const registryFinalizer = new FinalizationRegistry((ref) => registry.delete(ref));

// 注册表超过该阈值时先清理一次失效引用，作为 finalizer 尚未执行时的兜底
const REGISTRY_PRUNE_THRESHOLD = 64;

function pruneRegistry() {
  for (const ref of registry) {
    if (!ref.deref()) registry.delete(ref);
  }
}

// 获取全部缓存实例的运行状态
export function getCacheStats() {
  const stats = [];

  for (const ref of registry) {
    const cache = ref.deref();

    if (cache) {
      stats.push(cache.stats());
    } else {
      registry.delete(ref);
    }
  }

  return stats;
}

export class CacheByExpire {
  constructor(
    ttl,
    cleanupInterval = 0,
    { beforeDelete, afterDelete, beforeReplace, afterReplace, maxSize = 0, name = '' } = {},
  ) {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('TTL must be a positive finite number');
    }

    if (!Number.isFinite(cleanupInterval) || cleanupInterval < 0) {
      throw new Error('cleanupInterval must be a non-negative number');
    }

    if (!Number.isInteger(maxSize) || maxSize < 0) {
      throw new Error('maxSize must be a non-negative integer');
    }

    this.ttl = ttl; // 存储缓存过期时间
    this.cache = new Map();
    this.maxSize = maxSize; // 最大条目数，0 表示不限制
    this.name = name || 'anonymous'; // 缓存名称，用于运维统计

    // 运行计数：命中 / 未命中 / 写入 / 淘汰 / 过期删除
    this.hits = 0;
    this.misses = 0;
    this.sets = 0;
    this.evictions = 0;
    this.expired = 0;

    this.beforeDelete = beforeDelete;
    this.afterDelete = afterDelete;
    this.beforeReplace = beforeReplace;
    this.afterReplace = afterReplace;

    this.cleanupInterval = cleanupInterval; // 清理间隔
    this.isDestroyed = false; // 标记缓存是否被销毁

    // 弱引用注册：不阻止实例被 GC，destroy 时主动移除
    if (registry.size >= REGISTRY_PRUNE_THRESHOLD) pruneRegistry();
    const registryRef = new WeakRef(this);
    this._registryRef = registryRef;
    registry.add(registryRef);
    registryFinalizer.register(this, registryRef, registryRef);

    // 无定时清理时，set 触发的惰性清理间隔（摊销成本，避免 O(n^2)）
    this._autoCleanupEvery = Math.min(
      Math.max(ttl, MIN_AUTO_CLEANUP_INTERVAL),
      MAX_AUTO_CLEANUP_INTERVAL,
    );
    this._nextAutoCleanupAt = 0;

    if (cleanupInterval > 0) {
      this.cleanupIntervalId = setInterval(() => this.cleanup(), cleanupInterval); // 定时清理缓存
    }
  }

  // 内部 ttl 校验
  _validateTTL(ttl) {
    if (!Number.isFinite(ttl) || ttl <= 0) {
      throw new Error('TTL must be a positive finite number');
    }
  }

  // 内部删除：复用已取到的 entry，避免重复查找
  _deleteEntry(key, entry) {
    this.beforeDelete?.(key, entry.value);
    this.cache.delete(key);
    this.afterDelete?.(key, entry.value);
  }

  // 超出 maxSize 时按 Map 插入顺序淘汰最旧条目
  _evictOldest() {
    if (this.maxSize <= 0) return;

    const overflow = this.cache.size - this.maxSize;
    if (overflow <= 0) return;

    let count = 0;
    for (const [key, entry] of this.cache) {
      this._deleteEntry(key, entry);
      this.evictions++;
      if (++count >= overflow) break;
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

    const now = Date.now();
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.beforeReplace?.(key, oldEntry.value, value);
    }

    this.cache.set(key, { value, expireTime: now + ttl });
    this.sets++;

    if (oldEntry) {
      this.afterReplace?.(key, oldEntry.value, value);
    }

    // 定时清理已开启时交给定时器，否则按间隔做一次惰性清理
    if (this.cleanupInterval === 0 && now >= this._nextAutoCleanupAt) {
      this._nextAutoCleanupAt = now + this._autoCleanupEvery;
      this.cleanup();
    }

    // 容量兜底：先清理过期项，再按插入顺序淘汰最旧条目
    if (this.maxSize > 0 && this.cache.size > this.maxSize) {
      this._evictOldest();
    }
  }

  // 获取缓存条目
  get(key) {
    if (this.isDestroyed) return null;

    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() < entry.expireTime) {
      this.hits++;
      return entry.value;
    }

    this.expired++;
    this.misses++;
    this._deleteEntry(key, entry);
    return null;
  }

  // 读取缓存，未命中时用 factory 生成并写入
  // refresh: 命中后是否续期；值为 null/undefined 时不适合使用本方法
  getOrSet(key, factory, { ttl = this.ttl, refresh = false } = {}) {
    if (this.isDestroyed) return null;

    this._validateTTL(ttl);

    const value = this.get(key);
    if (value !== null) {
      if (refresh) this.resetExpireTime(key);
      return value;
    }

    const newValue = factory(key);
    this.set(key, newValue, ttl);
    return newValue;
  }

  // 取出并删除（原子操作），不存在或已过期返回 null
  take(key) {
    if (this.isDestroyed) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() >= entry.expireTime) {
      this._deleteEntry(key, entry);
      return null;
    }

    const value = entry.value;
    this._deleteEntry(key, entry);
    return value;
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

    // 使用无原型对象，避免特殊 key（如 __proto__）污染原型
    const data = Object.create(null);
    for (const [key, { value }] of this.cache) {
      data[key] = value;
    }
    return data;
  }

  // 删除过期的缓存条目（单次遍历，边遍历边删除）
  cleanup() {
    if (this.isDestroyed || this.cache.size === 0) return;

    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.expireTime <= now) {
        this.expired++;
        this._deleteEntry(key, entry);
      }
    }
  }

  // 删除指定条件的缓存项目
  clearByValue(matches) {
    if (this.isDestroyed || typeof matches !== 'function') return;

    // 先收集再删除，避免回调中重新写入导致遍历不终止
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

  // 删除所有以 prefix 开头的缓存项，返回删除数量
  clearByPrefix(prefix) {
    if (this.isDestroyed) return 0;

    const target = String(prefix);
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      if (String(key).startsWith(target)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  // 清空缓存数据
  clear() {
    if (this.isDestroyed) return;

    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      this.delete(key);
    }
  }

  // 删除缓存条目
  delete(key) {
    if (this.isDestroyed) return;

    const entry = this.cache.get(key);
    if (!entry) return;

    this._deleteEntry(key, entry);
  }

  // 仅当当前缓存值严格等于 value 时才删除（按值比较，避免误删已被替换的条目）
  // 返回是否实际删除
  deleteIf(key, value) {
    if (this.isDestroyed) return false;

    const entry = this.cache.get(key);
    if (!entry || entry.value !== value) return false;

    this._deleteEntry(key, entry);
    return true;
  }

  // 获取缓存运行状态（供运维接口使用，不触发清理）
  stats() {
    const now = Date.now();
    let active = 0;

    for (const entry of this.cache.values()) {
      if (entry.expireTime > now) active++;
    }

    const lookups = this.hits + this.misses;

    return {
      name: this.name,
      destroyed: this.isDestroyed,
      size: this.isDestroyed ? 0 : active, // 有效条目数
      stale: this.isDestroyed ? 0 : this.cache.size - active, // 已过期但尚未清理
      maxSize: this.maxSize,
      ttl: this.ttl,
      cleanupInterval: this.cleanupInterval,
      hits: this.hits,
      misses: this.misses,
      hitRate: lookups ? Number((this.hits / lookups).toFixed(4)) : 0,
      sets: this.sets,
      evictions: this.evictions,
      expired: this.expired,
    };
  }

  // 销毁缓存
  destroy() {
    if (this.isDestroyed) return;

    if (this._registryRef) {
      registryFinalizer.unregister(this._registryRef);
      registry.delete(this._registryRef);
      this._registryRef = undefined;
    }

    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = undefined;
    }

    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      this.delete(key);
    }

    this.isDestroyed = true;
  }
}
