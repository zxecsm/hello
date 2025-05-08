import fs from 'fs';
import { pipeline } from 'stream';
import _path from './path.js';

const fsp = fs.promises;

// 创建目录
function mkdir(path) {
  return fsp.mkdir(path, { recursive: true });
}

// 复制
async function cp(from, to, { signal, progress } = {}) {
  if (from === to) return;

  if (signal && signal.aborted) return;
  const stat = await fsp.lstat(from);

  if (stat.isDirectory()) {
    await mkdir(to);

    const list = await fsp.readdir(from);

    for (const name of list) {
      const fPath = _path.join(from, name);
      const tPath = _path.join(to, name);

      await cp(fPath, tPath, { signal, progress });
      if (signal && signal.aborted) return;
    }
  } else {
    // 如果信号已中断，则直接返回
    if (signal && signal.aborted) return;

    await mkdir(_path.dirname(to));
    await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(from);
      const writeStream = fs.createWriteStream(to);

      // 监听数据流的 'data' 事件，实时检查中断信号
      readStream.on('data', () => {
        // 如果信号已中断，立即停止流的操作
        if (signal && signal.aborted) {
          readStream.destroy();
          writeStream.end();
          reject(new Error('复制中断'));
        }
      });

      // 使用管道流来复制文件
      pipeline(readStream, writeStream, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
          progress && progress(from);
        }
      });
    });
  }
}
// function cp(from, to) {
//   if (from === to) return;
//   return fsp.cp(from, to, { recursive: true });
// }

async function del(path, { signal, progress } = {}) {
  if (!(await exists(path))) return;

  if (signal && signal.aborted) return;

  const s = await fsp.lstat(path);

  if (s.isDirectory()) {
    const list = await fsp.readdir(path);

    for (const name of list) {
      const fullPath = _path.join(path, name);

      await del(fullPath, { signal, progress });
      if (signal && signal.aborted) return;
    }

    await fsp.rm(path, { force: true, recursive: true });
  } else {
    if (signal && signal.aborted) return;

    await fsp.rm(path, { force: true, recursive: false });
    progress && progress(path);
  }
}

// 是否文本文件
async function isTextFile(path, length = 1000) {
  try {
    // 使用 fs.open 异步打开指定文件，以只读模式 ('r') 打开文件。
    const fileHandle = await fsp.open(path, 'r');

    // 创建一个指定长度（length）的缓冲区（Buffer），默认 1000 字节。
    const buffer = Buffer.alloc(length);

    // 从文件中读取内容填充缓冲区：
    // - buffer：目标缓冲区。
    // - 0：缓冲区写入的起始位置。
    // - length：要读取的最大字节数。
    // - 0：从文件的起始位置（偏移量 0）开始读取。
    const { bytesRead } = await fileHandle.read(buffer, 0, length, 0);

    // 关闭文件句柄，释放资源。
    await fileHandle.close();

    // 如果读取的字节数为 0，表示文件为空，直接返回 true（认为是文本文件）。
    if (bytesRead === 0) return true;

    // 遍历已读取的字节数据：
    for (let i = 0; i < bytesRead; i++) {
      // 如果遇到 NUL 字节（0x00）（值为 0），表示文件可能是二进制文件，返回 false。
      if (buffer[i] === 0) {
        return false;
      }
    }

    // 如果所有字节都没有 NUL 字节，认为是文本文件，返回 true。
    return true;
  } catch {
    // 如果出现任何错误（如文件不存在、权限不足等），返回 false。
    return false;
  }
}

// 文件或文件夹是否存在
async function exists(path) {
  try {
    await fsp.access(path, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// 重命名
async function rename(oldPath, newPath, { signal, progress } = {}) {
  try {
    await fsp.rename(oldPath, newPath);
  } catch {
    await cp(oldPath, newPath, { signal, progress });
    await del(oldPath, { signal, progress });
  }
}

// 格式化字节大小
function formatBytes(size) {
  size = Number(size);
  if (isNaN(size) || size < 0) return '0B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  let idx = 0;

  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }

  return size.toFixed(2) + units[idx];
}

// 获取文本大小
function getTextSize(text) {
  const encoder = new TextEncoder();
  const byteArray = encoder.encode(text);
  return byteArray.length; // 返回字节数
}

const _f = {
  fsp,
  fs,
  rename,
  del,
  mkdir,
  cp,
  isTextFile,
  exists,
  formatBytes,
  getTextSize,
};

export default _f;
