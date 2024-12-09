import { CacheByExpire } from './cache';
import md5 from './md5';
import { computeSize } from './utils';

const cacheFile = {
  urlCache: new CacheByExpire(30 * 60 * 1000, 40 * 60 * 1000, {
    onDelete: (_, url) => {
      // 清除url缓存，释放URL对象
      if (url) {
        URL.revokeObjectURL(url);
      }
    },
  }),
  hasUrl(url, type) {
    const hash = `${type}_${md5.getStringHash(url)}`;

    return this.urlCache.get(hash);
  },
  async read(url, type = 'hello') {
    try {
      const hash = `${type}_${md5.getStringHash(url)}`;

      const cache = this.urlCache.get(hash);
      if (cache) {
        return cache;
      }

      // 是否存在缓存
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: false,
      });

      if (!fileHandle) return null;

      const file = await fileHandle.getFile();

      const objectURL = URL.createObjectURL(file);
      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },
  async add(url, type = 'hello', file) {
    try {
      const hash = `${type}_${md5.getStringHash(url)}`;

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

        await this.saveCache(hash, data);
      }

      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },
  async saveCache(hash, data) {
    try {
      // 缓存
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch {}
  },
  async delete(url, type = 'hello') {
    try {
      const hash = `${type}_${md5.getStringHash(url)}`;
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
    try {
      let total = 0;
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
      return '大约：' + computeSize(total);
    } catch {
      return '';
    }
  },
};

export default cacheFile;
