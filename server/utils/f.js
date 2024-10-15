import fs from 'fs';
const fsp = fs.promises;

// 创建目录
function mkdir(path) {
  return fsp.mkdir(path, { recursive: true });
}

// 复制
function cp(from, to) {
  return fsp.cp(from, to, { recursive: true });
}

// 删除
async function deldir(folderPath) {
  const entries = await fsp.readdir(folderPath, { withFileTypes: true });

  const promises = entries.map(async (entry) => {
    const fullPath = `${folderPath}/${entry.name}`;
    if (entry.isDirectory()) {
      await deldir(fullPath);
    } else {
      await fsp.unlink(fullPath);
    }
  });

  await Promise.all(promises);
  await fsp.rmdir(folderPath);
}

async function del(path) {
  if (!fs.existsSync(path)) return;

  const s = await fsp.stat(path);
  if (s.isDirectory()) {
    await deldir(path);
  } else {
    await fsp.unlink(path);
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

const _f = { fsp, fs, del, mkdir, cp, isTextFile };

export default _f;
