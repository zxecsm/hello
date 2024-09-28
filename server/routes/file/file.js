const configObj = require('../../data/config');

const { _d } = require('../../data/data');

const _f = require('../../utils/f');

const { concurrencyTasks, writelog } = require('../../utils/utils');

const compressing = require('compressing');

// 处理路径
function hdPath(path) {
  return path.replace(/(\/){2,}/g, '/');
}

function getCurPath(acc, p) {
  return hdPath(getRootDir(acc) + '/' + p);
}

// 用户根目录
function getRootDir(acc) {
  let path = configObj.rootP;

  if (acc !== 'root') {
    path = `${configObj.userFileP}/${acc}`;
  }
  return hdPath(path);
}

// 获取回收站目录
function getTrashDir(account) {
  return hdPath(`${getRootDir(account)}/.trash`);
}

// 判断是否父目录
function isParentDir(parentP, childP) {
  if (childP === parentP) return false;
  return parentP === childP.slice(0, parentP.length);
}

// 文件所在目录
function getFileDir(path) {
  return path.split('/').slice(0, -1).join('/');
}

// 获取扩展名
function getSuffix(str) {
  let idx = str.lastIndexOf('.'),
    a = '',
    b = '';

  if (idx < 0) {
    a = str;
  } else {
    a = str.slice(0, idx);
    b = str.slice(idx + 1);
  }

  return [a, b];
}

// 文件随机后缀
function getRandomName(str) {
  const r = '_' + Math.random().toString().slice(-6),
    [a, b] = getSuffix(str);

  if (a) {
    return a + r + (b === '' ? '' : `.${b}`);
  }

  return (b === '' ? '' : `.${b}`) + r;
}

// path获取文件名
function getPathFilename(path) {
  const filename = path.split('/').slice(-1)[0];

  const [a, b] = getSuffix(filename);

  return [filename, a, b];
}

// 删除站点文件
async function _delDir(path) {
  if (!_f.c.existsSync(path)) return;

  if (_d.trashState) {
    const trashDir = getTrashDir('root');

    if (
      path === trashDir ||
      isParentDir(path, trashDir) ||
      isParentDir(trashDir, path)
    ) {
      return _f.del(path);
    }

    await _f.mkdir(trashDir);

    let fname = getPathFilename(path)[0];

    if (_f.c.existsSync(`${trashDir}/${fname}`)) {
      fname = getRandomName(fname);
    }

    try {
      await _f.p.rename(path, `${trashDir}/${fname}`);
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      await _f.cp(path, `${trashDir}/${fname}`);
      await _f.del(path);
    }
  } else {
    await _f.del(path);
  }
}

// 清理空目录
async function delEmptyFolder(path) {
  const s = await _f.p.stat(path);

  if (s.isDirectory()) {
    const list = await _f.p.readdir(path);

    await concurrencyTasks(list, 5, async (item) => {
      await delEmptyFolder(`${path}/${item}`);
    });

    // 清除空文件夹
    if ((await _f.p.readdir(path)).length === 0) {
      await _delDir(path);
    }
  }
}

// 读取目录大小
async function getDirSize(path) {
  let size = 0;

  (await getAllFile(path)).forEach((item) => {
    size += item.size;
  });

  return size;
}

// 获取所有文件
async function getAllFile(path) {
  try {
    const arr = [];

    async function getFile(path) {
      try {
        const s = await _f.p.stat(path);

        if (s.isDirectory()) {
          const list = await _f.p.readdir(path);

          await concurrencyTasks(list, 5, async (item) => {
            await getFile(`${path}/${item}`);
          });
        } else {
          arr.push({
            name: getPathFilename(path)[0],
            path: getFileDir(path),
            size: s.size,
            atime: s.atimeMs, //最近一次访问文件的时间戳
            ctime: s.ctimeMs, //最近一次文件状态的修改的时间戳
            birthtime: s.birthtimeMs, //文件创建时间的时间戳
          });
        }
      } catch (error) {
        await writelog(false, `[ getAllFile ] - ${error}`, 'error');
      }
    }

    await getFile(path);

    return arr;
  } catch (error) {
    await writelog(false, `[ getAllFile ] - ${error}`, 'error');
    return [];
  }
}

// 压缩文件
function compressFile(p1, p2) {
  return compressing.zip.compressFile(p1, p2);
}
// 压缩目录
function compressDir(p1, p2) {
  return compressing.zip.compressDir(p1, p2);
}
// 解压
function uncompress(p1, p2) {
  return compressing.zip.uncompress(p1, p2);
}

// 读取目录文件
async function readMenu(path) {
  try {
    const list = await _f.p.readdir(path);

    const arr = [];

    await concurrencyTasks(list, 5, async (name) => {
      try {
        const f = `${path}/${name}`;

        const s = await _f.p.stat(f);

        if (s.isDirectory()) {
          arr.push({
            path,
            type: 'dir',
            name,
            time: s.ctime.getTime(),
            size: 0,
            mode: getPermissions(s),
          });
        } else {
          arr.push({
            path,
            type: 'file',
            name,
            time: s.ctime.getTime(),
            size: s.size,
            mode: getPermissions(s),
          });
        }
      } catch (error) {
        await writelog(false, `[ readMenu ] - ${error}`, 'error');
      }
    });

    return arr;
  } catch (error) {
    await writelog(false, `[ readMenu ] - ${error}`, 'error');
    return [];
  }
}

// 文件权限
function getPermissions(stats) {
  let permissions = '';
  // 检查所有者权限
  if (stats.mode & _f.c.constants.S_IRUSR) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IWUSR) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IXUSR) permissions += 'x';
  else permissions += '-';

  // 检查所属组权限
  if (stats.mode & _f.c.constants.S_IRGRP) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IWGRP) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IXGRP) permissions += 'x';
  else permissions += '-';

  // 检查其他用户权限
  if (stats.mode & _f.c.constants.S_IROTH) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IWOTH) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.c.constants.S_IXOTH) permissions += 'x';
  else permissions += '-';

  const groups = permissions.match(/(.{3})/g).map((group) => {
    return group
      .replace(/r/g, '4')
      .replace(/w/g, '2')
      .replace(/x/g, '1')
      .replace(/-/g, '0');
  });

  const num = groups.reduce((a, b) => {
    return (a += b.split('').reduce((c, d) => parseInt(c) + parseInt(d), 0));
  }, '');
  return permissions + ' ' + num;
}

module.exports = {
  hdPath,
  getRootDir,
  getTrashDir,
  _delDir,
  delEmptyFolder,
  getCurPath,
  isParentDir,
  getPathFilename,
  getAllFile,
  getDirSize,
  getSuffix,
  getRandomName,
  getFileDir,
  compressFile,
  compressDir,
  uncompress,
  readMenu,
  getPermissions,
};
