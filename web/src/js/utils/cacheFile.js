import { CacheByExpire } from './cache';
import md5 from './md5';
import { _getData, _setData } from './utils';

const cacheFile = {
  urlCache: new CacheByExpire(30 * 60 * 1000, 40 * 60 * 1000, {
    onDelete: (_, url) => {
      // 清除url缓存，释放URL对象
      if (url) {
        URL.revokeObjectURL(url);
      }
    },
  }),
  getHash(key, type) {
    return `${type}_${md5.getStringHash(key)}`;
  },
  async setData(key, value, type = 'hello') {
    const hash = this.getHash(key, type);

    const data = encodeURIComponent(JSON.stringify({ data: value }));

    // 无法储存则存到localStorage
    if (!(await this.writeCache(hash, data))) {
      _setData(key, data);
    }
  },
  async getData(key, type = 'hello') {
    try {
      const hash = this.getHash(key, type);
      const file = await this.readCache(hash);
      if (!file) throw '';
      const text = await file.text();
      return JSON.parse(decodeURIComponent(text)).data;
    } catch {
      return _getData(key);
    }
  },
  hasUrl(url, type) {
    const hash = this.getHash(url, type);

    return this.urlCache.get(hash);
  },
  async read(url, type = 'hello') {
    try {
      const hash = this.getHash(url, type);

      const cache = this.urlCache.get(hash);
      if (cache) {
        return cache;
      }

      // 是否存在缓存
      const file = await this.readCache(hash);

      if (!file) return null;

      const objectURL = URL.createObjectURL(file);
      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },
  async add(url, type = 'hello', file) {
    try {
      const hash = this.getHash(url, type);

      const cachedFileHandle = await this.read(url);

      // 已存在返回
      if (cachedFileHandle) return cachedFileHandle;

      let objectURL = null;
      if (file) {
        objectURL = URL.createObjectURL(file);
      } else {
        // 不存在则下载
        const response = await fetch(url);
        const data = await response.blob();

        objectURL = URL.createObjectURL(data);

        await this.writeCache(hash, data);
      }

      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },
  async readCache(hash) {
    try {
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: false,
      });

      if (!fileHandle) return null;

      return fileHandle.getFile();
    } catch {
      return null;
    }
  },
  async writeCache(hash, data) {
    try {
      // 缓存
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  },
  async delete(url, type = 'hello') {
    try {
      const hash = this.getHash(url, type);
      const u = this.urlCache.get(hash);
      this.urlCache.delete(hash, u);
      const dirHandle = await navigator.storage.getDirectory();
      await dirHandle.removeEntry(hash);
    } catch {}
  },
  async clear(type) {
    try {
      const dirHandle = await navigator.storage.getDirectory();
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          if (!type || (type && entry.name.startsWith(`${type}_`))) {
            const url = this.urlCache.get(entry.name);
            this.urlCache.delete(entry.name, url);
            await dirHandle.removeEntry(entry.name);
          }
        }
      }
    } catch {}
  },
  async size(type) {
    let total = 0;
    try {
      if (type) {
        const dirHandle = await navigator.storage.getDirectory();
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            if (entry.name.startsWith(`${type}_`)) {
              const file = await entry.getFile();
              total += file.size;
            }
          }
        }
      } else {
        const estimate = await navigator.storage.estimate();
        total = estimate.usage;
      }
    } catch {}
    return total;
  },
};

export default cacheFile;
