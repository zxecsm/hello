import md5 from './md5';
import { computeSize } from './utils';

const cacheFile = {
  async addText(key, value) {
    try {
      const hash = md5.getStringHash(key);
      // 缓存
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(value);
      await writable.close();
    } catch {}
  },
  async readText(key) {
    try {
      const hash = md5.getStringHash(key);
      // 是否存在缓存
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: false,
      });

      if (!fileHandle) return null;

      const file = await fileHandle.getFile();

      return file.text();
    } catch {
      return null;
    }
  },
  async read(url) {
    try {
      const hash = md5.getStringHash(url);

      // 是否存在缓存
      const dirHandle = await navigator.storage.getDirectory();
      const fileHandle = await dirHandle.getFileHandle(hash, {
        create: false,
      });

      if (!fileHandle) return null;

      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  },
  async add(url) {
    try {
      const hash = md5.getStringHash(url);
      const cachedFileHandle = await this.read(url);

      // 已存在返回
      if (cachedFileHandle) return cachedFileHandle;

      // 不存在则下载
      const response = await fetch(url);
      const data = await response.blob();

      const objectURL = URL.createObjectURL(data);

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

      return objectURL;
    } catch {
      return null;
    }
  },
  async delete(url) {
    try {
      const hash = md5.getStringHash(url);
      const dirHandle = await navigator.storage.getDirectory();
      await dirHandle.removeEntry(hash);
    } catch {}
  },
  async clear() {
    try {
      const dirHandle = await navigator.storage.getDirectory();
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          await dirHandle.removeEntry(entry.name);
        }
      }
    } catch {}
  },
  async size() {
    try {
      const estimate = await navigator.storage.estimate();
      return '大约：' + computeSize(estimate.usage);
    } catch {
      return '';
    }
  },
};

export default cacheFile;
