import sparkMd5 from 'spark-md5';
import FileWorker from './fileSlice.worker.js';
import { getFileReader } from './utils.js';
import _path from './path.js';

// 切片文件
function fileSlice(file, callback, signal) {
  return new Promise(async (resolve, reject) => {
    const chunkSize = getChunkSize(file);

    const [filename, , suffix] = _path.extname(file.name || '');
    const count = Math.ceil(file.size / chunkSize);
    const chunks = createFileChunks(file, chunkSize, count);

    if (typeof Worker === 'undefined') {
      const spark = new sparkMd5.ArrayBuffer();
      const list = [];

      for (let i = 0; i < chunks; i++) {
        if (signal && signal.aborted) break;

        const chunk = chunks[i];
        const buf = await getFileReader(chunk);
        spark.append(buf);
        list.push({
          file: chunk,
          filename: `_${i}`,
        });
        callback && callback(count === 1 ? 1 : (i + 1) / count);
      }

      const HASH = spark.end();

      return {
        HASH,
        chunks: list,
        count,
        suffix,
        filename,
        size: file.size,
      };
    }

    const w = new FileWorker();

    w.postMessage({ chunks });

    w.onmessage = (e) => {
      if (signal && signal.aborted) {
        cleanUpWorker(w);
        w.terminate();
        return;
      }

      const { type, value, HASH } = e.data;
      if (type === 'progress') {
        callback && callback(value);
      } else if (type === 'result') {
        cleanUpWorker(w);
        resolve({
          HASH,
          chunks: value,
          count,
          suffix,
          filename,
          size: file.size,
        });
      }
    };

    w.onerror = (err) => {
      cleanUpWorker(w);
      reject(err);
    };
  });
}

// 获取切片大小
function getChunkSize(file) {
  const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 最大块大小
  const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 最小块大小
  return Math.max(MIN_CHUNK_SIZE, Math.min(file.size / 100, MAX_CHUNK_SIZE));
}

// 创建文件切片
function createFileChunks(file, chunkSize, count) {
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
    chunks.push(chunk);
  }
  return chunks;
}

// 清理 Worker
function cleanUpWorker(worker) {
  worker.onmessage = null;
  worker.onerror = null;
}

const md5 = {
  fileSlice,
  getStringHash: sparkMd5.hash,
};

export default md5;
