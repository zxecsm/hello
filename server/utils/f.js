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
const _f = { p: fsp, c: fs, del, mkdir, cp };

export default _f;
