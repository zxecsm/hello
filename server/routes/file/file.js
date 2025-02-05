import appConfig from '../../data/config.js';

import { _d } from '../../data/data.js';

import _f from '../../utils/f.js';

import { concurrencyTasks, mixedSort, writelog } from '../../utils/utils.js';

import _path from '../../utils/path.js';

export function getCurPath(acc, p) {
  return _path.normalize(getRootDir(acc), p);
}

// 用户文件管理根目录
export function getRootDir(acc) {
  let path = appConfig.appFiles;

  if (acc !== 'root') {
    path = `${appConfig.userFiles}/${acc}`;
  }
  return _path.normalize(path);
}

// 获取回收站目录
export function getTrashDir(account) {
  return _path.normalize(`${getRootDir(account)}/${appConfig.trashDirName}`);
}

// 删除站点文件
export async function _delDir(path) {
  if (!(await _f.exists(path))) return;

  if (_d.trashState) {
    const trashDir = getTrashDir('root');

    if (
      _path.isPathWithin(path, trashDir, true) ||
      _path.isPathWithin(trashDir, path, true)
    ) {
      return _f.del(path);
    }

    await _f.mkdir(trashDir);

    const targetName = _path.basename(path)[0];

    if (!targetName) return;

    let targetPath = _path.normalize(trashDir, targetName);

    if (await _f.exists(targetPath)) {
      // 已存在添加随机后缀
      targetPath = await getUniqueFilename(targetPath);
    }

    await _f.rename(path, targetPath);
  } else {
    await _f.del(path);
  }
}

// 清理空目录
export async function delEmptyFolder(path) {
  const s = await _f.fsp.lstat(path);

  if (s.isDirectory()) {
    const list = await _f.fsp.readdir(path);

    await concurrencyTasks(list, 5, async (item) => {
      await delEmptyFolder(_path.normalize(`${path}/${item}`));
    });

    // 清除空文件夹
    if ((await _f.fsp.readdir(path)).length === 0) {
      await _delDir(path);
    }
  }
}

// 获取所有文件
export async function getAllFile(path) {
  try {
    const arr = [];

    async function getFile(path) {
      try {
        const s = await _f.fsp.lstat(path);

        if (s.isDirectory()) {
          const list = await _f.fsp.readdir(path);

          await concurrencyTasks(list, 5, async (item) => {
            await getFile(_path.normalize(`${path}/${item}`));
          });
        } else {
          const name = _path.basename(path)[0];

          if (name) {
            arr.push({
              name,
              path: _path.dirname(path),
              size: s.size,
              atime: s.atimeMs, //最近一次访问文件的时间戳
              ctime: s.ctimeMs, //最近一次文件状态的修改的时间戳
              birthtime: s.birthtimeMs, //文件创建时间的时间戳
            });
          }
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

// 文件列表排序
export function sortFileList(list, type, isDesc) {
  list.sort((a, b) => {
    if (type === 'time' || type === 'type') {
      if (isDesc || type === 'type') {
        return b.time - a.time;
      }
      return a.time - b.time;
    } else if (type === 'name') {
      if (isDesc) {
        return mixedSort(b.name, a.name);
      }
      return mixedSort(a.name, b.name);
    } else if (type === 'size') {
      if (isDesc) {
        return b.size - a.size;
      }
      return a.size - b.size;
    }
  });
  if (type === 'type') {
    const files = list.filter((item) => item.type === 'file');
    const dirs = list.filter((item) => item.type === 'dir');
    if (isDesc) {
      list = [...files, ...dirs];
    } else {
      list = [...dirs, ...files];
    }
  }
  return list;
}

// 读取目录文件
export async function readMenu(path) {
  try {
    const list = await _f.fsp.readdir(path);

    const arr = [];

    await concurrencyTasks(list, 5, async (name) => {
      try {
        const f = _path.normalize(`${path}/${name}`);

        const s = await _f.fsp.lstat(f);

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
export function getPermissions(stats) {
  let permissions = '';
  // 检查所有者权限
  if (stats.mode & _f.fs.constants.S_IRUSR) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.fs.constants.S_IWUSR) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.fs.constants.S_IXUSR) permissions += 'x';
  else permissions += '-';

  // 检查所属组权限
  if (stats.mode & _f.fs.constants.S_IRGRP) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.fs.constants.S_IWGRP) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.fs.constants.S_IXGRP) permissions += 'x';
  else permissions += '-';

  // 检查其他用户权限
  if (stats.mode & _f.fs.constants.S_IROTH) permissions += 'r';
  else permissions += '-';
  if (stats.mode & _f.fs.constants.S_IWOTH) permissions += 'w';
  else permissions += '-';
  if (stats.mode & _f.fs.constants.S_IXOTH) permissions += 'x';
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

// 生成唯一文件名
export async function getUniqueFilename(path) {
  const dir = _path.dirname(path);
  const filename = _path.basename(path)[0] || 'unknown';

  let counter = 0;
  let newPath = '';

  async function rename() {
    newPath = _path.normalize(
      `${dir}/${_path.randomFilenameSuffix(filename, ++counter)}`
    );

    // 文件已存在，继续重命名
    if (await _f.exists(newPath)) {
      await rename();
    }
  }

  await rename();

  return newPath;
}

// 是否有同名文件
export async function hasSameNameFile(targetPath, list) {
  const targetList = await readMenu(targetPath);
  return targetList.some(({ name }) => list.some((item) => item.name === name));
}
