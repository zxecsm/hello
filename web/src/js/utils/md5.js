import sparkMd5 from 'spark-md5';
import { getFileReader } from './utils.js';
import _path from './path.js';

async function sampleHash(file) {
  try {
    const fileSize = file.size;

    const maxSampleCount = 100; // 最大取样点数
    const sampleCount = Math.min(Math.max(Math.floor(fileSize / 1024), 4), maxSampleCount);
    const maxOffset = fileSize - 256; // 防止读取超出文件范围

    let seed = fileSize;
    const rng = (seed) => {
      seed = (seed * 9301 + 49297) % 233280; // 线性同余生成器
      return seed / 233280; // 归一化到 [0, 1)
    };

    const spark = new sparkMd5.ArrayBuffer();

    // 读取文件指定位置的样本
    const readSample = async (offset) => {
      spark.append(await getFileReader(file.slice(offset, offset + 256)));
    };

    // 1. 读取文件头部的样本
    await readSample(0);

    // 2. 读取随机位置的样本
    for (let i = 0; i < sampleCount; i++) {
      const randomValue = rng(seed); // 获取伪随机数
      seed = (seed * 9301 + 49297) % 233280; // 更新种子

      const offset = Math.min(Math.floor(randomValue * maxOffset), maxOffset);
      await readSample(offset); // 读取随机位置的样本
    }

    // 3. 读取文件尾部的样本
    await readSample(maxOffset);

    return spark.end();
  } catch {
    return '';
  }
}

// 切片文件
async function fileSlice(file) {
  const chunkSize = getChunkSize(file);

  const [filename, , suffix] = _path.extname(file.name || '');
  const count = Math.ceil(file.size / chunkSize);
  const chunks = createFileChunks(file, chunkSize, count);
  const HASH = await sampleHash(file);
  return {
    HASH,
    chunks,
    count,
    suffix,
    filename,
    size: file.size,
  };
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
    chunks.push({
      file: file.slice(i * chunkSize, (i + 1) * chunkSize),
      filename: `_${i}`,
    });
  }
  return chunks;
}

const md5 = {
  sampleHash,
  fileSlice,
  getStringHash: sparkMd5.hash,
};

export default md5;
