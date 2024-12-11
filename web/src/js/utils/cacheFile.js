import { CacheByExpire } from './cache';
import md5 from './md5';
import { _getData, _setData } from './utils';

const cacheFile = {
  // URL缓存
  urlCache: new CacheByExpire(30 * 60 * 1000, 40 * 60 * 1000, {
    onDelete: (_, url) => {
      // 清除url缓存，释放URL对象
      if (url) {
        URL.revokeObjectURL(url);
      }
    },
  }),

  // 保存获取目录句柄的函数引用
  getDirectory: navigator.storage?.getDirectory || null,

  getHash(key, type) {
    return `${type}_${md5.getStringHash(key)}`;
  },

  async setData(key, value, type = 'hello') {
    const hash = this.getHash(key, type);
    const data = encodeURIComponent(JSON.stringify({ data: value }));

    if (!this.getDirectory) {
      // 浏览器不支持文件系统，则存储到 localStorage
      _setData(key, data);
      return;
    }

    await this.writeCache(hash, data);
  },

  async getData(key, type = 'hello') {
    const hash = this.getHash(key, type);

    try {
      if (!this.getDirectory) throw new Error('No file system access');

      const file = await this.readCache(hash);
      if (!file) throw new Error('Cache not found');

      const text = await file.text();
      return JSON.parse(decodeURIComponent(text)).data;
    } catch {
      // 如果文件系统不可用，则回退到 localStorage
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
        // 如果存在 URL 缓存，直接返回
        return cache;
      }

      if (!this.getDirectory) return null;

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
      if (cachedFileHandle) return cachedFileHandle;

      let objectURL = null;
      if (file) {
        objectURL = URL.createObjectURL(file);
      } else {
        const data = await (await fetch(url)).blob();

        objectURL = URL.createObjectURL(data);

        if (this.getDirectory) {
          await this.writeCache(hash, data);
        }
      }

      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },

  async readCache(hash) {
    try {
      const fileHandle = await (
        await this.getDirectory()
      ).getFileHandle(hash, { create: false });
      return fileHandle.getFile();
    } catch {
      return null;
    }
  },

  async writeCache(hash, data) {
    try {
      const fileHandle = await (
        await this.getDirectory()
      ).getFileHandle(hash, { create: true });
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
      const cachedURL = this.urlCache.get(hash);
      if (cachedURL) {
        this.urlCache.delete(hash, cachedURL);
      }

      if (!this.getDirectory) return;

      await (await this.getDirectory()).removeEntry(hash);
    } catch {}
  },

  async clear(type) {
    try {
      if (!this.getDirectory) return;

      const dirHandle = await this.getDirectory();
      for await (const entry of dirHandle.values()) {
        if (
          entry.kind === 'file' &&
          (!type || entry.name.startsWith(`${type}_`))
        ) {
          const cachedURL = this.urlCache.get(entry.name);
          if (cachedURL) {
            this.urlCache.delete(entry.name, cachedURL);
          }
          await dirHandle.removeEntry(entry.name);
        }
      }
    } catch {}
  },

  async size(type) {
    let total = 0;
    try {
      if (!this.getDirectory) return total;

      const dirHandle = await this.getDirectory();
      if (type) {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.startsWith(`${type}_`)) {
            const file = await entry.getFile();
            total += file.size;
          }
        }
      } else {
        total = await this.getEstimateSize().usage;
      }
    } catch {}
    return total;
  },
  async getEstimateSize() {
    try {
      return await navigator.storage.estimate();
    } catch {
      return { quota: 0, usage: 0 };
    }
  },
};

export default cacheFile;
