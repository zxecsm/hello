import configObj from '../../data/config.js';

import { _d } from '../../data/data.js';

import _f from '../../utils/f.js';

import { concurrencyTasks, writelog } from '../../utils/utils.js';

import _path from '../../utils/path.js';

import compressing from 'compressing';

export function getCurPath(acc, p) {
  return _path.normalize(getRootDir(acc) + '/' + p);
}

// 用户根目录
export function getRootDir(acc) {
  let path = configObj.rootP;

  if (acc !== 'root') {
    path = `${configObj.userFileP}/${acc}`;
  }
  return _path.normalize(path);
}

// 获取回收站目录
export function getTrashDir(account) {
  return _path.normalize(`${getRootDir(account)}/.trash`);
}

// 删除站点文件
export async function _delDir(path) {
  if (!(await _f.exists(path))) return;

  if (_d.trashState) {
    const trashDir = getTrashDir('root');

    if (
      path === trashDir ||
      _path.isPathWithin(path, trashDir) ||
      _path.isPathWithin(trashDir, path)
    ) {
      return _f.del(path);
    }

    await _f.mkdir(trashDir);

    let targetPath = _path.normalize(`${trashDir}/${_path.basename(path)[0]}`);

    if (await _f.exists(targetPath)) {
      // 已存在添加随机后缀
      targetPath = await getUniqueFilename(targetPath);
    }

    try {
      await _f.fsp.rename(path, targetPath);
    } catch {
      await _f.cp(path, targetPath);
      await _f.del(path);
    }
  } else {
    await _f.del(path);
  }
}

// 清理空目录
export async function delEmptyFolder(path) {
  const s = await _f.fsp.stat(path);

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

// 读取目录大小
export async function getDirSize(path) {
  let size = 0;

  (await getAllFile(path)).forEach((item) => {
    size += item.size;
  });

  return size;
}

// 获取所有文件
export async function getAllFile(path) {
  try {
    const arr = [];

    async function getFile(path) {
      try {
        const s = await _f.fsp.stat(path);

        if (s.isDirectory()) {
          const list = await _f.fsp.readdir(path);

          await concurrencyTasks(list, 5, async (item) => {
            await getFile(_path.normalize(`${path}/${item}`));
          });
        } else {
          arr.push({
            name: _path.basename(path)[0],
            path: _path.dirname(path),
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
export function compressFile(p1, p2) {
  return compressing.zip.compressFile(p1, p2);
}
// 压缩目录
export function compressDir(p1, p2) {
  return compressing.zip.compressDir(p1, p2);
}
// 解压
export function uncompress(p1, p2) {
  return compressing.zip.uncompress(p1, p2);
}

// 读取目录文件
export async function readMenu(path) {
  try {
    const list = await _f.fsp.readdir(path);

    const arr = [];

    await concurrencyTasks(list, 5, async (name) => {
      try {
        const f = _path.normalize(`${path}/${name}`);

        const s = await _f.fsp.stat(f);

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
export function getUniqueFilename(path) {
  return new Promise((resolve) => {
    const dir = _path.dirname(path);
    const filename = _path.basename(path)[0];

    const ensureUniqueFileName = async (newPath) => {
      // 如果还存在一直递归到不存在为止
      if (await _f.exists(newPath)) {
        await ensureUniqueFileName(
          _path.normalize(`${dir}/${_path.randomFilenameSuffix(filename)}`)
        );
      } else {
        resolve(newPath);
      }
    };

    ensureUniqueFileName(
      _path.normalize(`${dir}/${_path.randomFilenameSuffix(filename)}`)
    );
  });
}
