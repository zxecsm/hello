import JSZip from 'jszip';
import { CacheByExpire } from './cache';
import md5 from './md5';
import { _getData, _setData, downloadBlob, getFiles } from './utils';
import _msg from '../plugins/message';

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
  supported:
    navigator.storage && typeof navigator.storage.getDirectory === 'function',
  getDirectory() {
    return navigator.storage.getDirectory();
  },
  getHash(key, type) {
    const side = window.location.origin;
    key = key.replace(side, '');
    return `${type}_${md5.getStringHash(key)}`;
  },

  async setData(key, value, type = 'hello') {
    const hash = this.getHash(key, type);

    if (!this.supported) {
      // 浏览器不支持文件系统，则存储到 localStorage
      _setData(key, value);
      return;
    }

    await this.writeCache(
      hash,
      encodeURIComponent(JSON.stringify({ data: value }))
    );
  },

  async getData(key, type = 'hello') {
    const hash = this.getHash(key, type);

    try {
      if (!this.supported) throw new Error('No file system access');

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

      if (!this.supported) return null;

      const file = await this.readCache(hash);
      if (!file) return null;

      const objectURL = URL.createObjectURL(file);
      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },

  async loadFile(url) {
    try {
      return (await fetch(url)).blob();
    } catch (error) {
      throw error;
    }
  },

  async add(url, type = 'hello', file) {
    try {
      const hash = this.getHash(url, type);

      const cachedFileHandle = await this.read(url, type);
      if (cachedFileHandle) return cachedFileHandle;

      // 没有传文件，加载文件
      if (!file) file = await this.loadFile(url);

      if (this.supported) {
        await this.writeCache(hash, file);
      }

      const objectURL = URL.createObjectURL(file);

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

      if (!this.supported) return;

      await (await this.getDirectory()).removeEntry(hash);
    } catch {}
  },

  async getList(type) {
    const res = [];
    try {
      if (!this.supported) return res;
      const dirHandle = await this.getDirectory();

      for await (const entry of dirHandle.values()) {
        if (
          entry.kind === 'file' &&
          (!type || entry.name.startsWith(`${type}_`))
        ) {
          res.push(entry);
        }
      }

      return res;
    } catch {
      return res;
    }
  },

  async clear(type) {
    try {
      if (!this.supported) throw '';

      const dirHandle = await this.getDirectory();
      let count = 0;
      for await (const entry of dirHandle.values()) {
        if (
          entry.kind === 'file' &&
          (!type || entry.name.startsWith(`${type}_`))
        ) {
          const cachedURL = this.urlCache.get(entry.name);
          if (cachedURL) {
            this.urlCache.delete(entry.name, cachedURL);
          }

          _msg.botMsg(`清理缓存文件：${++count}`, 1);
          await dirHandle.removeEntry(entry.name);
        }
      }
    } catch (error) {
      throw error;
    }
  },

  async size(type) {
    let total = 0;
    try {
      if (!this.supported) return total;

      const dirHandle = await this.getDirectory();
      if (type) {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.startsWith(`${type}_`)) {
            const file = await entry.getFile();
            total += file.size;
          }
        }
      } else {
        total = (await this.getEstimateSize()).usage;
      }
    } catch {}
    return total;
  },
  getEstimateSize() {
    try {
      return navigator.storage.estimate();
    } catch {
      return { quota: 0, usage: 0 };
    }
  },

  async exportStorage() {
    try {
      if (!this.supported) throw '';

      const dirHandle = await this.getDirectory();
      const packs = []; // 分包
      let size = 0;
      let pack = [];
      const packName = 'hello_storage';

      // 遍历目录中的文件按照一定大小进行分包处理
      for await (const [entryName, entryHandle] of dirHandle.entries()) {
        if (entryHandle.kind === 'file') {
          const file = await entryHandle.getFile();
          size += file.size;
          pack.push({ name: entryName, file });

          _msg.botMsg(
            `缓存分包：${packName}_${packs.length + 1} - ${(
              size /
              1024 /
              1024
            ).toFixed(2)}M`,
            1
          );
          if (size > 500 * 1024 * 1024) {
            packs.push({ size, pack, num: packs.length + 1 });
            size = 0;
            pack = [];
          }
        }
      }

      // 处理最后的分包
      if (pack.length > 0) {
        packs.push({ size, pack, num: packs.length + 1 });
      }

      // 分别压缩包并下载
      for await (const { size, num, pack } of packs) {
        const zip = new JSZip();

        for await (const { name, file } of pack) {
          zip.file(name, file);
        }

        const pName = `${packName}_${num}.zip`;

        _msg.botMsg(
          `开始压缩：${pName} - ${(size / 1024 / 1024).toFixed(2)}M`,
          1
        );
        // 生成zip文件并下载
        const content = await zip.generateAsync({
          type: 'blob',
        });

        downloadBlob(content, pName);
      }
    } catch (error) {
      throw error;
    }
  },

  async importStorage(skip = true) {
    try {
      if (!this.supported) throw '';

      // 选择文件
      const files = await getFiles({ accept: '.zip', multiple: 'multiple' });
      if (files.length === 0) throw '';

      const cacheList = await this.getList();
      let count = 0;

      await Promise.all(
        files.map(async (file) => {
          // 解压文件
          const zip = new JSZip();
          const zipContent = await file.arrayBuffer();
          const zipFiles = await zip.loadAsync(zipContent);

          // 将zip文件中的内容写入存储目录
          for (const filename in zipFiles.files) {
            // 不跳过或者不存在
            if (!skip || !cacheList.some((item) => item.name === filename)) {
              try {
                const fileData = await zipFiles.files[filename].async('blob');
                await this.writeCache(filename, fileData);
                _msg.botMsg(`导入文件：${++count}`, 1);
              } catch {}
            }
          }
        })
      );
    } catch (error) {
      throw error;
    }
  },
};

export default cacheFile;
