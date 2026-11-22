import appConfig from '../../config/index.js';

import { _d } from '../../config/store.js';

import _f from '../../utils/fs/f.js';

import {
  concurrencyTasks,
  getSongInfo,
  getTimePath,
  mixedSort,
  writelog,
} from '../../utils/common/utils.js';

import _path from '../../utils/common/path.js';
import _crypto from '../../utils/security/crypto.js';
import { db } from '../../utils/db/sqlite.js';
import nanoid from '../../utils/common/nanoid.js';
import pinyin from '../../utils/text/pinyin.js';
import { getImgInfo } from '../../utils/fs/img.js';

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

    let targetPath = _path.normalizeNoSlash(trashDir, targetName);

    if (await _f.exists(targetPath)) {
      // 已存在添加随机后缀
      targetPath = await getUniqueFilename(targetPath);
    }

    await _f.rename(path, targetPath);
  } else {
    await _f.del(path);
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

// 软链接目标在容器内不存在时，尝试用挂载根目录（用户根目录）拼接后查找。
// 例：宿主机根挂载到 /app/app_data，链接指向 /volume1/a/b，依次尝试：
//   /app/app_data/volume1/a/b  （挂载根 = 宿主根）
//   /app/app_data/a/b          （挂载根 = 宿主一级目录）
//   /app/app_data/b            （挂载根 = /volume1/a）
// 逐个校验，命中第一个就返回；全部不存在则返回 null（前端按未知处理）。
async function mapLinkTarget(base, target) {
  if (!base || !target) return null;

  const t = _path.toUnixPath(target);

  // 只处理绝对路径链接
  if (!t.startsWith('/')) return null;

  const segs = t.split('/').filter(Boolean);
  if (segs.length === 0) return null;

  const baseReal = (await _f.realpath(base)) || _path.normalize(base);

  for (let i = 0; i < segs.length; i++) {
    // 去掉开头 i 段，拼到挂载根目录下
    const p = _path.normalizeNoSlash(base, '/' + segs.slice(i).join('/'));

    // 拼接结果必须仍在根目录内
    if (!_path.isPathWithin(base, p, true)) continue;

    const realp = await _f.realpath(p);
    if (!realp) continue;

    // 解析后的真实路径也必须仍在根目录内
    if (!_path.isPathWithin(baseReal, realp, true)) continue;

    const type = await _f.getType(realp);
    if (!type) continue;

    const size = type === 'file' ? (await _f.stat(realp))?.size || 0 : 0;

    return { path: realp, type, size };
  }

  return null;
}

// 读取目录文件
export async function readMenu(path, base) {
  try {
    const dirents = await _f.fsp.readdir(path, { withFileTypes: true });

    const arr = [];

    // lstat 无法避免（需要时间、大小、权限），这里提高并发减少大目录等待
    await concurrencyTasks(dirents, 5, async (dirent) => {
      try {
        const name = dirent.name;
        const f = _path.normalizeNoSlash(path, name);

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
          // 普通文件且有多个硬链接，视为硬链接
          info.hardLink = type === 'file' && s.nlink > 1 ? 1 : 0;
          if (type === 'symlink') {
            try {
              info.linkTarget = await _f.fsp.realpath(f);
              const targetStat = await _f.stat(info.linkTarget);
              info.linkTargetType = await _f.getType(info.linkTarget);
              info.linkTargetTypeName = _f.getFileTypeName(info.linkTargetType);
              // 链接显示目标文件的真实大小，目录/未知为 0
              info.size = targetStat && targetStat.isFile() ? targetStat.size : 0;
            } catch {
              info.linkTarget = await _f.fsp.readlink(f);

              // 宿主机绝对路径链接在容器内解析失败时，尝试映射到挂载根目录下
              const mapped = await mapLinkTarget(base, info.linkTarget);
              if (mapped) {
                info.linkTarget = mapped.path;
                info.linkTargetType = mapped.type;
                info.linkTargetTypeName = _f.getFileTypeName(mapped.type);
                info.size = mapped.size;
                info.linkMapped = 1;
              } else {
                info.linkTargetType = 'unknown';
                info.linkTargetTypeName = '未知';
              }
            }
          } else {
            info.size = s.size;
          }
        }
        arr.push(info);
      } catch (error) {
        await writelog(false, `[ readMenu ] - ${error}`, 500);
      }
    });

    return arr;
  } catch (error) {
    await writelog(false, `[ readMenu ] - ${error}`, 500);
    return [];
  }
}

// 生成唯一文件名
export async function getUniqueFilename(path) {
  const dir = _path.dirname(path);
  const filename = _path.basename(path)[0] || 'unknown';

  let counter = 0;
  let newPath = _path.normalizeNoSlash(dir, _path.randomFilenameSuffix(filename, ++counter));

  while (await _f.exists(newPath)) {
    newPath = _path.normalizeNoSlash(dir, _path.randomFilenameSuffix(filename, ++counter));
  }

  return newPath;
}

// 是否有同名文件
export async function hasSameNameFile(targetPath, list) {
  // 只比较文件名，不需要 lstat 每个目录项
  const targetList = await _f.readdir(targetPath);
  return targetList.some((name) => list.some((item) => item.name === name));
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
  if (db('songs').select('id').where({ hash: HASH }).findOne()) return false;

  const songId = nanoid();

  const create_at = Date.now();

  const timePath = getTimePath(create_at);

  const suffix = _path.basename(p)[3];

  const tDir = appConfig.musicDir(timePath, songId);
  const tName = `${songId}.${suffix}`;

  await _f.cp(p, _path.normalizeNoSlash(tDir, tName));
  // 读取歌曲元数据
  const songInfo = await getSongInfo(_path.normalizeNoSlash(tDir, tName));

  let { album = '', year = '', title, duration, artist, pic = '', lrc = '', picFormat } = songInfo;

  picFormat = _path.basename(picFormat)[0];
  if (picFormat && pic) {
    // 提取封面
    await _f.writeFile(_path.normalizeNoSlash(tDir, `${songId}.${picFormat}`), pic);
    pic = _path.normalizeNoSlash(timePath, songId, `${songId}.${picFormat}`);
  }

  await _f.writeFile(_path.normalizeNoSlash(tDir, `${songId}.lrc`), lrc);

  db('songs').insert({
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
    url: _path.normalizeNoSlash(timePath, songId, tName),
    lrc: _path.normalizeNoSlash(timePath, songId, `${songId}.lrc`),
  });
  return true;
}

export async function fileToBg(p) {
  const HASH = await _crypto.sampleHash(p);
  if (db('bg').select('url').where({ hash: HASH }).findOne()) return false;

  const [, title, , suffix] = _path.basename(p);
  const create_at = Date.now();
  const timePath = getTimePath(create_at);

  const tDir = appConfig.bgDir(timePath);
  const tName = `${HASH}.${suffix}`;

  await _f.cp(p, _path.normalizeNoSlash(tDir, tName));

  // 获取壁纸尺寸进行分类
  let imgInfo = {};
  try {
    imgInfo = await getImgInfo(_path.normalizeNoSlash(tDir, tName));
  } catch (error) {
    throw new Error(error);
  }

  const { width, height } = imgInfo;
  const type = width < height ? 'bgxs' : 'bg';

  const url = _path.normalizeNoSlash(timePath, tName);

  db('bg').insert({
    create_at,
    id: nanoid(),
    hash: HASH,
    url,
    type,
    title,
  });

  return true;
}

// 文件编辑草稿路径（使用文件路径的 hash 作为文件名）
export function getFileEditingPath(account, path) {
  const hash = _crypto.getStringHash(_path.normalizeNoSlash(path));
  return appConfig.fileEditingDir(account, hash);
}

// 保存文件编辑草稿
export async function saveFileEditing(account, path, text) {
  await _f.writeFile(getFileEditingPath(account, path), text);
}

// 读取文件编辑草稿（不存在返回 null）
export async function readFileEditing(account, path) {
  const p = getFileEditingPath(account, path);
  if (!(await _f.exists(p))) return null;
  return (await _f.readFile(p, null, '')).toString();
}

// 清除文件编辑草稿
export async function clearFileEditing(account, path) {
  await _f.del(getFileEditingPath(account, path));
}

// 路径安全
// 对目标路径逐级向上做 realpath，解析结果必须位于根目录内，
// 用于阻断 ../ 穿越与软链接逃逸，越界返回 false。
// 根目录本身也先做一次 realpath 归一化，避免根目录经由软链接、
// Windows 短路径或大小写差异时被误判为越界。
export async function isPathSafe(base, target, allowEqual = false) {
  const baseReal = (await _f.realpath(base)) || _path.normalize(base);

  let current = target;
  let realp = null;

  while (current) {
    try {
      realp = await _f.realpath(current);
      if (realp) break;
    } catch {}

    const parent = _path.dirname(current);
    if (parent === current) break;

    current = parent;
  }

  return realp && _path.isPathWithin(baseReal, realp, allowEqual);
}
