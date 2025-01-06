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
function isTextFile(path, length = 1000) {
  try {
    let res = true;
    const fd = fs.openSync(path, 'r');
    for (let i = 0; i < length; i++) {
      const buf = new Buffer.alloc(1);
      const bytes = fs.readSync(fd, buf, 0, 1, i);
      const char = buf.toString().charCodeAt();
      if (bytes === 0) {
        break;
      } else if (bytes === 1 && char === 0) {
        res = false;
        break;
      }
    }
    fs.closeSync(fd);
    return res;
  } catch {
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

const _f = { fsp, fs, rename, del, mkdir, cp, isTextFile, exists };

export default _f;
