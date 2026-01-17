import fs from 'fs';
import fsp from 'fs/promises';
import stream from 'stream';
import streamp from 'stream/promises';
import _path from './path.js';
import { withLock } from './lock.js';

// 创建目录
async function mkdir(path) {
  try {
    await fsp.mkdir(path, { recursive: true });
  } catch {}
}

// 创建硬链接
async function link(target, path) {
  await mkdir(_path.dirname(path));
  await fsp.link(target, path);
}

// 创建符号链接
async function symlink(target, path) {
  await mkdir(_path.dirname(path));
  await fsp.symlink(target, path);
}

// 复制
async function cp(from, to, { signal, progress, renameMode = false } = {}) {
  if (!(await getType(from))) return;
  if (from === to) return;

  if (!signal && !progress) {
    await fsp.cp(from, to, {
      recursive: true,
      force: true,
      dereference: false, // 复制符号链接本身，而不是它指向的文件
    });
    if (renameMode) await del(from);
    return;
  }

  const stack = [{ from, to }];

  while (stack.length > 0) {
    const { from: f, to: t } = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');

    const type = await getType(f);
    if (!type) continue;

    if (type === 'dir') {
      await mkdir(t);
      const list = await fsp.readdir(f);

      for (const name of list) {
        stack.push({
          from: _path.normalize(f, name),
          to: _path.normalize(t, name),
        });
      }
    } else if (type === 'symlink') {
      await fsp.cp(f, t, {
        force: true,
        dereference: false,
      });
      if (renameMode) await del(f);
      progress?.({ count: 1 });
    } else {
      const readStream = fs.createReadStream(f);
      const writeStream = await createWriteStream(t, { flags: 'w' });

      await streamp.pipeline(
        readStream,
        new stream.Transform({
          transform(chunk, _, callback) {
            progress?.({
              size: chunk.length,
            });
            callback(null, chunk);
          },
        }),
        writeStream,
        { signal },
      );
      if (renameMode) await del(f);
      progress?.({ count: 1 });
    }
  }
}

// 读取文件
async function readFile(path, options, defaultValue) {
  try {
    return await fsp.readFile(path, options);
  } catch {
    return defaultValue;
  }
}

async function lstat(path) {
  try {
    return await fsp.lstat(path);
  } catch {
    return null;
  }
}

// 读取目录
async function readdir(path, ...arg) {
  try {
    return await fsp.readdir(path, ...arg);
  } catch {
    return [];
  }
}

// 写入文件
async function writeFile(path, ...arg) {
  await withLock(path, async () => {
    await mkdir(_path.dirname(path));
    await fsp.writeFile(path, ...arg);
  });
}

// 追加文件
async function appendFile(path, ...arg) {
  await withLock(path, async () => {
    await mkdir(_path.dirname(path));
    await fsp.appendFile(path, ...arg);
  });
}

// 写入流
async function createWriteStream(path, ...arg) {
  await mkdir(_path.dirname(path));
  return fs.createWriteStream(path, ...arg);
}

// 修改权限
async function chmod(path, mode, { signal, progress, recursive = false } = {}) {
  if (!(await getType(path))) return;

  if (!recursive) {
    await fsp.chmod(path, mode);
    progress?.({ count: 1 });
    return;
  }

  const stack = [path];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');
    const type = await getType(currentPath);
    if (!type) continue;

    await fsp.chmod(currentPath, mode);
    progress?.({ count: 1 });

    if (type === 'dir') {
      const list = await fsp.readdir(currentPath);

      for (const name of list) {
        stack.push(_path.normalize(currentPath, name));
      }
    }
  }
}

// 设置用户组
async function chown(path, uid, gid, { signal, progress, recursive = false } = {}) {
  if (!(await getType(path))) return;

  if (!recursive) {
    await fsp.lchown(path, uid, gid);
    progress?.({ count: 1 });
    return;
  }

  const stack = [path];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');
    const type = await getType(currentPath);
    if (!type) continue;

    await fsp.lchown(currentPath, uid, gid);
    progress?.({ count: 1 });

    if (type === 'dir') {
      const list = await fsp.readdir(currentPath);

      for (const name of list) {
        stack.push(_path.normalize(currentPath, name));
      }
    }
  }
}

async function getType(stat) {
  if (typeof stat === 'string') stat = await lstat(stat);
  if (!stat) return '';
  if (stat.isFile()) return 'file';
  if (stat.isDirectory()) return 'dir';
  if (stat.isSymbolicLink()) return 'symlink';
  if (stat.isSocket()) return 'socket';
  if (stat.isFIFO()) return 'fifo';
  if (stat.isCharacterDevice()) return 'chardev';
  if (stat.isBlockDevice()) return 'blockdev';
  return 'unknown';
}

function getFileTypeName(type) {
  switch (type) {
    case 'file':
      return '文件';
    case 'dir':
      return '文件夹';
    case 'symlink':
      return '符号链接';
    case 'socket':
      return '套接字';
    case 'fifo':
      return '命名管道';
    case 'chardev':
      return '字符设备';
    case 'blockdev':
      return '块设备';
    default:
      return '未知';
  }
}

async function del(path, { signal, progress } = {}) {
  if (!(await getType(path))) return;

  if (!signal && !progress) {
    return fsp.rm(path, { recursive: true, force: true });
  }

  const stack = [path];
  const dirs = [];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');
    const type = await getType(currentPath);
    if (!type) continue;

    if (type === 'dir') {
      dirs.push(currentPath);
      const list = await fsp.readdir(currentPath);

      for (const name of list) {
        stack.push(_path.normalize(currentPath, name));
      }
    } else {
      const size = (await lstat(currentPath)).size;
      await fsp.rm(currentPath, { force: true });
      if (type === 'file') {
        progress?.({ count: 1, size });
      }
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
  return (await lstat(path)) !== null;
}

// 重命名
async function rename(oldPath, newPath, { signal, progress } = {}) {
  if (!(await getType(oldPath))) return;
  try {
    await mkdir(_path.dirname(newPath));
    await fsp.rename(oldPath, newPath);
  } catch {
    await cp(oldPath, newPath, { signal, progress, renameMode: true });
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

async function readDirSize(path, { signal, progress } = {}) {
  let size = 0;

  if (!(await getType(path))) return size;

  const stack = [path];

  while (stack.length > 0) {
    const currentPath = stack.pop();

    if (signal?.aborted) throw new Error('Operation aborted');

    const type = await getType(currentPath);
    if (!type) continue;

    if (type === 'dir') {
      const list = await fsp.readdir(currentPath);

      for (const name of list) {
        stack.push(_path.normalize(currentPath, name));
      }
    } else if (type === 'file') {
      const size = (await lstat(currentPath)).size;
      progress?.({ count: 1, size });
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
    uid: stats.uid,
    gid: stats.gid,
  };
}

const _f = {
  fsp,
  fs,
  stream,
  streamp,
  rename,
  del,
  mkdir,
  getType,
  lstat,
  getFileTypeName,
  symlink,
  link,
  readFile,
  writeFile,
  appendFile,
  readdir,
  createWriteStream,
  cp,
  chmod,
  chown,
  isTextFile,
  exists,
  formatBytes,
  getTextSize,
  readDirSize,
  getPermissions,
};

export default _f;
