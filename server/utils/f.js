import fs from 'fs';
import { pipeline } from 'stream';
import _path from './path.js';

const fsp = fs.promises;

// 创建目录
function mkdir(path) {
  return fsp.mkdir(path, { recursive: true });
}

// 复制
async function cp(from, to, { signal, fileCount, chunkCopied } = {}) {
  if (from === to) return;

  if (!signal && !fileCount && !chunkCopied) {
    return fsp.cp(from, to, { recursive: true, force: true });
  }

  const stack = [{ from, to }];

  while (stack.length > 0) {
    const { from: f, to: t } = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');

    const stat = await fsp.lstat(f);

    if (stat.isDirectory()) {
      await mkdir(t);
      const list = await fsp.readdir(f);

      for (const name of list) {
        stack.push({ from: _path.join(f, name), to: _path.join(t, name) });
      }
    } else {
      await mkdir(_path.dirname(t));
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(f);
        const writeStream = fs.createWriteStream(t);

        readStream.on('data', (chunk) => {
          if (signal?.aborted) {
            readStream.destroy();
            writeStream.end();
            reject(new Error('Operation aborted'));
            return;
          }

          chunkCopied?.(chunk.length);
        });

        pipeline(readStream, writeStream, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
            fileCount?.();
          }
        });
      });
    }
  }
}

async function del(path, { signal, fileCount } = {}) {
  if (!(await exists(path))) return;

  if (!signal && !fileCount) {
    return fsp.rm(path, { recursive: true, force: true });
  }

  const stack = [path];
  const dirs = [];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');
    const s = await fsp.lstat(currentPath);

    if (s.isDirectory()) {
      dirs.push(currentPath);
      const list = await fsp.readdir(currentPath);

      for (const name of list) {
        stack.push(_path.join(currentPath, name));
      }
    } else {
      await fsp.rm(currentPath, { force: true });
      fileCount?.();
    }
  }

  for (let i = dirs.length - 1; i >= 0; i--) {
    await fsp.rm(dirs[i], { recursive: true, force: true });
  }
}

// 是否文本文件
async function isTextFile(path, length = 1000) {
  let fileHandle;
  try {
    // 使用 fs.open 异步打开指定文件，以只读模式 ('r') 打开文件。
    fileHandle = await fsp.open(path, 'r');

    // 创建一个指定长度（length）的缓冲区（Buffer），默认 1000 字节。
    const buffer = Buffer.alloc(length);

    // 从文件中读取内容填充缓冲区：
    // - buffer：目标缓冲区。
    // - 0：缓冲区写入的起始位置。
    // - length：要读取的最大字节数。
    // - 0：从文件的起始位置（偏移量 0）开始读取。
    const { bytesRead } = await fileHandle.read(buffer, 0, length, 0);

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
  } finally {
    // 关闭文件句柄，释放资源。
    if (fileHandle) await fileHandle.close();
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
async function rename(
  oldPath,
  newPath,
  { signal, fileCount, chunkCopied } = {}
) {
  try {
    await fsp.rename(oldPath, newPath);
  } catch {
    await cp(oldPath, newPath, { signal, fileCount, chunkCopied });
    await del(oldPath, { signal });
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
  return Buffer.byteLength(text, 'utf8');
}

async function readDirSize(path, { signal, fileCount } = {}) {
  let size = 0;

  if (!(await exists(path))) return size;

  const stack = [path];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');

    const s = await fsp.lstat(currentPath);

    if (s.isDirectory()) {
      const list = await fsp.readdir(currentPath);

      for (const name of list) {
        stack.push(_path.join(currentPath, name));
      }
    } else {
      size += s.size;
      fileCount?.(s.size);
    }
  }

  return size;
}

function getPermissions(stats) {
  const mode = stats.mode.toString(8).slice(-3);
  const permissionMap = [
    { bit: 0o400, char: 'r' },
    { bit: 0o200, char: 'w' },
    { bit: 0o100, char: 'x' },
    { bit: 0o040, char: 'r' },
    { bit: 0o020, char: 'w' },
    { bit: 0o010, char: 'x' },
    { bit: 0o004, char: 'r' },
    { bit: 0o002, char: 'w' },
    { bit: 0o001, char: 'x' },
  ];

  let permissionString = '';
  const numericMode = parseInt(mode, 8);

  permissionMap.forEach(({ bit, char }) => {
    permissionString += numericMode & bit ? char : '-';
  });

  return {
    mode: permissionString,
    numericMode: mode,
  };
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
  readDirSize,
  getPermissions,
};

export default _f;
