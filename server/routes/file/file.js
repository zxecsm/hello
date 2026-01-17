import appConfig from '../../data/config.js';

import { _d } from '../../data/data.js';

import _f from '../../utils/f.js';

import {
  concurrencyTasks,
  getSongInfo,
  getTimePath,
  mixedSort,
  writelog,
} from '../../utils/utils.js';

import _path from '../../utils/path.js';
import _crypto from '../../utils/crypto.js';
import { db } from '../../utils/sqlite.js';
import nanoid from '../../utils/nanoid.js';
import pinyin from '../../utils/pinyin.js';
import { getImgInfo } from '../../utils/img.js';

// 删除站点文件
export async function _delDir(path) {
  if (!(await _f.exists(path))) return;

  if (_d.trashState) {
    const trashDir = appConfig.trashDir(appConfig.adminAccount);

    if (_path.isPathWithin(path, trashDir, true) || _path.isPathWithin(trashDir, path, true)) {
      return _f.del(path);
    }

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
  if ((await _f.getType(rootDir)) !== 'dir') return;

  const allDirs = new Set();
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();

    const files = await _f.fsp.readdir(currentDir);
    for (const file of files) {
      const fullPath = _path.normalize(currentDir, file);
      if ((await _f.getType(fullPath)) === 'dir') {
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
        const s = await _f.lstat(currentPath);

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

        const s = await _f.lstat(f);
        const { mode, numericMode, uid, gid } = _f.getPermissions(s);
        const type = await _f.getType(s);
        const modeStr = `${mode} ${numericMode}`;
        const info = {
          path,
          type: type === 'dir' ? 'dir' : 'file',
          name,
          time: s.ctimeMs,
          size: 0,
          mode: modeStr,
          uid,
          gid,
        };
        if (info.type === 'file') {
          info.fileType = type;
          info.fileTypeName = _f.getFileTypeName(type);
          if (type === 'symlink') {
            try {
              info.linkTarget = await _f.fsp.realpath(f);
              info.linkTargetType = await _f.getType(info.linkTarget);
              info.linkTargetTypeName = _f.getFileTypeName(info.linkTargetType);
            } catch {
              info.linkTarget = await _f.fsp.readlink(f);
              info.linkTargetType = 'unknown';
              info.linkTargetTypeName = '未知';
            }
          } else {
            info.size = s.size;
          }
        }
        arr.push(info);
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
  let newPath = _path.normalize(dir, _path.randomFilenameSuffix(filename, ++counter));

  while (await _f.exists(newPath)) {
    newPath = _path.normalize(dir, _path.randomFilenameSuffix(filename, ++counter));
  }

  return newPath;
}

// 是否有同名文件
export async function hasSameNameFile(targetPath, list) {
  const targetList = await readMenu(targetPath);
  return targetList.some(({ name }) => list.some((item) => item.name === name));
}

// 读取收藏目录
export async function readFavorites(account) {
  return (await _f.readFile(appConfig.fileConfigDir(account, 'favorites'), null, ''))
    .toString()
    .split('\n')
    .filter(Boolean);
}

// 写入收藏目录
export async function writeFavorites(account, list) {
  await _f.writeFile(appConfig.fileConfigDir(account, 'favorites'), list.join('\n'));
}

// 读取历史目录
export async function readHistoryDirs(account) {
  return (await _f.readFile(appConfig.fileConfigDir(account, 'cd_history'), null, ''))
    .toString()
    .split('\n')
    .filter(Boolean);
}

// 写入历史目录
export async function writeHistoryDirs(account, list) {
  await _f.writeFile(appConfig.fileConfigDir(account, 'cd_history'), list.join('\n'));
}

export async function fileToMusic(p) {
  const HASH = await _crypto.sampleHash(p);
  if (await db('songs').select('id').where({ hash: HASH }).findOne()) return false;

  const songId = nanoid();

  const create_at = Date.now();

  const timePath = getTimePath(create_at);

  const suffix = _path.basename(p)[3];

  const tDir = appConfig.musicDir(timePath, songId);
  const tName = `${songId}.${suffix}`;

  await _f.cp(p, _path.normalize(tDir, tName));
  // 读取歌曲元数据
  const songInfo = await getSongInfo(_path.normalize(tDir, tName));

  let { album = '', year = '', title, duration, artist, pic = '', lrc = '', picFormat } = songInfo;

  picFormat = _path.basename(picFormat)[0];
  if (picFormat && pic) {
    // 提取封面
    await _f.writeFile(_path.normalize(tDir, `${songId}.${picFormat}`), pic);
    pic = _path.normalize(timePath, songId, `${songId}.${picFormat}`);
  }

  await _f.writeFile(_path.normalize(tDir, `${songId}.lrc`), lrc);

  await db('songs').insert({
    id: songId,
    create_at,
    artist,
    artist_pinyin: pinyin(artist),
    title,
    title_pinyin: pinyin(title),
    duration,
    album,
    year,
    hash: HASH,
    pic,
    url: _path.normalize(timePath, songId, tName),
    lrc: _path.normalize(timePath, songId, `${songId}.lrc`),
  });
  return true;
}

export async function fileToBg(p) {
  const HASH = await _crypto.sampleHash(p);
  if (await db('bg').select('url').where({ hash: HASH }).findOne()) return false;

  const [, title, , suffix] = _path.basename(p);
  const create_at = Date.now();
  const timePath = getTimePath(create_at);

  const tDir = appConfig.bgDir(timePath);
  const tName = `${HASH}.${suffix}`;

  await _f.cp(p, _path.normalize(tDir, tName));

  // 获取壁纸尺寸进行分类
  const { width, height } = await getImgInfo(_path.normalize(tDir, tName));
  const type = width < height ? 'bgxs' : 'bg';

  const url = _path.normalize(timePath, tName);

  await db('bg').insert({
    create_at,
    id: nanoid(),
    hash: HASH,
    url,
    type,
    title,
  });

  return true;
}
