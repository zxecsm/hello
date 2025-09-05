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
  return _path.normalize(getRootDir(account), appConfig.trashDirName);
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
export async function cleanEmptyDirectories(rootDir) {
  if (!(await _f.exists(rootDir))) return;

  const allDirs = new Set();
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();

    const files = await _f.fsp.readdir(currentDir);
    for (const file of files) {
      const fullPath = _path.normalize(currentDir, file);
      const stat = await _f.fsp.lstat(fullPath);
      if (stat.isDirectory()) {
        stack.push(fullPath);
        allDirs.add(fullPath);
      }
    }
  }

  const sortedDirs = Array.from(allDirs).sort((a, b) => {
    return b.split('/').length - a.split('/').length;
  });

  for (const dir of sortedDirs) {
    if ((await _f.fsp.readdir(dir).length) === 0) {
      await _delDir(dir);
    }
  }
}

// 获取所有文件
export async function getAllFile(path) {
  try {
    const result = [];
    const stack = [path];

    while (stack.length > 0) {
      const currentPath = stack.pop();

      try {
        const s = await _f.fsp.lstat(currentPath);

        if (s.isDirectory()) {
          const list = await _f.fsp.readdir(currentPath);
          for (const name of list) {
            stack.push(_path.normalize(currentPath, name));
          }
        } else {
          const name = _path.basename(currentPath)[0];

          if (name) {
            result.push({
              name,
              path: _path.dirname(currentPath),
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

    return result;
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
        const f = _path.normalize(path, name);

        const s = await _f.fsp.lstat(f);
        const { mode, numericMode } = _f.getPermissions(s);
        const modeStr = `${mode} ${numericMode}`;
        if (s.isDirectory()) {
          arr.push({
            path,
            type: 'dir',
            name,
            time: s.ctimeMs,
            size: 0,
            mode: modeStr,
          });
        } else {
          arr.push({
            path,
            type: 'file',
            name,
            time: s.ctimeMs,
            size: s.size,
            mode: modeStr,
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

// 生成唯一文件名
export async function getUniqueFilename(path) {
  const dir = _path.dirname(path);
  const filename = _path.basename(path)[0] || 'unknown';

  let counter = 0;
  let newPath = _path.normalize(
    dir,
    _path.randomFilenameSuffix(filename, ++counter)
  );

  while (await _f.exists(newPath)) {
    newPath = _path.normalize(
      dir,
      _path.randomFilenameSuffix(filename, ++counter)
    );
  }

  return newPath;
}

// 是否有同名文件
export async function hasSameNameFile(targetPath, list) {
  const targetList = await readMenu(targetPath);
  return targetList.some(({ name }) => list.some((item) => item.name === name));
}
