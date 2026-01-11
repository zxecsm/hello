import JSZip from 'jszip';
import { CacheByExpire } from './cache';
import md5 from './md5';
import { _setTimeout, downloadBlob, getFiles, isTextFile } from './utils';
import _msg from '../plugins/message';
import _d from '../common/config';
import localData from '../common/localData';
import { withLock } from './lock';

const cacheFile = {
  // 缓存状态
  setCacheState(val) {
    if (val === undefined) return localData.get('cacheState');
    localData.set('cacheState', val);
  },
  // URL对象缓存
  urlCache: new CacheByExpire(5 * 60 * 1000, 5 * 60 * 1000, {
    beforeDelete: (_, url) => {
      // 清除url缓存，释放URL对象
      if (url) {
        URL.revokeObjectURL(url);
      }
    },
    beforeReplace: (_, url, newUrl) => {
      if (url !== newUrl) {
        _setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      }
    },
  }),
  // 文件缓存支持
  supported:
    navigator.storage && typeof navigator.storage.getDirectory === 'function',
  // 获取文件系统
  getDirectory() {
    return navigator.storage.getDirectory();
  },
  // 文件标识
  getHash(key, type) {
    const side = _d.originURL;
    key = key.replace(side, '');
    return `${type}_${md5.getStringHash(key)}`;
  },
  // 保存配置数据
  async setData(key, value, type = _d.appName) {
    const hash = this.getHash(key, type);

    if (!this.supported) {
      // 浏览器不支持文件系统，则存储到 localStorage
      localData.set(key, value);
      return;
    }

    await this.writeCache(
      hash,
      encodeURIComponent(JSON.stringify({ data: value }))
    );
  },
  // 获取配置数据
  async getData(key, type = _d.appName) {
    const hash = this.getHash(key, type);

    try {
      if (!this.supported) throw new Error('No file system access');

      const file = await this.readCache(hash);
      if (!file) throw new Error('Cache not found');

      const text = await file.text();
      return JSON.parse(decodeURIComponent(text)).data;
    } catch {
      // 如果文件系统不可用，则回退到 localStorage
      return localData.get(key);
    }
  },
  // 判断url对象缓存是否存在
  hasUrl(url, type) {
    const hash = this.getHash(url, type);
    return this.urlCache.get(hash);
  },
  // 读取文件
  async read(url, type = _d.appName) {
    try {
      const hash = this.getHash(url, type);

      const cache = this.urlCache.get(hash);
      if (cache) {
        // 如果存在 URL 缓存，直接返回
        return cache;
      }

      if (!this.supported) return null;

      let file = await this.readCache(hash);
      if (!file) return null;

      let ttl = 30 * 60 * 1000;

      if (type === 'image' && (await isTextFile(file))) {
        file = new Blob([await file.text()], { type: 'image/svg+xml' });
        ttl = undefined;
      }

      const objectURL = URL.createObjectURL(file);
      this.urlCache.set(hash, objectURL, ttl);

      return objectURL;
    } catch {
      return null;
    }
  },
  // 加载文件
  async loadFile(url) {
    return (await fetch(url)).blob();
  },
  // 添加文件
  async add(url, type = _d.appName, file) {
    try {
      const hash = this.getHash(url, type);

      const cachedFileHandle = await this.read(url, type);
      if (cachedFileHandle) return cachedFileHandle;

      // 没有传文件，加载文件
      if (!file) file = await this.loadFile(url);

      // 关闭缓存停止写入
      if (this.supported && this.setCacheState()) {
        await this.writeCache(hash, file);
      }

      const objectURL = URL.createObjectURL(file);

      this.urlCache.set(hash, objectURL);

      return objectURL;
    } catch {
      return null;
    }
  },
  // 读取文件缓存
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
  // 写入文件缓存
  async writeCache(hash, data) {
    return withLock(hash, async () => {
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
    });
  },
  // 删除文件缓存
  async delete(url, type = _d.appName) {
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
  // 获取文件列表
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
  // 清理缓存
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
  // 获取缓存大小
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
  // 获取缓存预估大小
  getEstimateSize() {
    try {
      return navigator.storage.estimate();
    } catch {
      return { quota: 0, usage: 0 };
    }
  },
  // 导出缓存
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
  // 导入缓存
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
