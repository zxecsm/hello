const fs = require('fs');
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
  try {
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
  } catch (error) {
    throw error;
  }
}
async function del(path) {
  try {
    const s = await fsp.stat(path);
    if (s.isDirectory()) {
      await deldir(path);
    } else {
      await fsp.unlink(path);
    }
  } catch (error) {
    throw error;
  }
}
const _f = { p: fsp, c: fs, del, mkdir, cp };
module.exports = _f;
