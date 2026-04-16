import appConfig from '../../data/config.js';

import { isImgFile } from '../../utils/utils.js';

import { db } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { convertImageFormat } from '../../utils/img.js';
import { validShareState } from '../user/user.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';

export default async function getFile(req, res, originalPath, verifyLogin = true) {
  const params = { ...req.query, p: originalPath };
  try {
    res.locals.ctx = await V.parse(
      params,
      V.object({
        w: V.number().toInt().default(0).min(0),
        token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
        p: V.string().notEmpty().min(1).max(fieldLength.url),
        d: V.number().toInt().default(0).enum([0, 1]),
        n: V.string()
          .trim()
          .default('')
          .allowEmpty()
          .max(fieldLength.filename)
          .custom(_path.isFilename, '文件名不合法'),
      }),
    );
  } catch (error) {
    return resp.badRequest(res)(error, 1);
  }

  let { token, p, w, d, n } = res.locals.ctx;

  let { account } = res.locals.hello.userinfo;

  const jwtData = token ? await jwt.get(token) : '';

  // 以指定的用户身份访问指定的文件
  if (jwtData?.data?.type === 'temAccessFile') {
    account = jwtData.data.data.account;
    p = jwtData.data.data.p;
  }

  const url = _path.normalizeNoSlash('/' + p);

  // 获取访问目录
  const pArr = url.split('/').filter(Boolean);

  let dir = pArr.shift();

  const publicArr = ['pic', 'sharemusic', 'sharefile', 'logo', 'pub'];
  const verifyArr = ['bg', 'upload', 'file', 'music']; // 目录需要登录态

  if (publicArr.includes(dir)) {
  } else if (verifyArr.includes(dir)) {
    if (!account && verifyLogin) {
      return resp.unauthorized(res)();
    }
  } else {
    return resp.forbidden(res, '无权访问')();
  }

  // 合并url
  let path = '';

  if (dir === 'pic') {
    path = await getPicPath(res, pArr[0]);
  } else if (dir === 'bg') {
    path = await getBgPath(res, pArr[0]);
  } else if (dir === 'upload') {
    path = await getUploadPath(res, pArr[0], account);
  } else if (dir === 'file') {
    path = getFilePath(account, pArr);
  } else if (dir === 'sharefile') {
    path = await getShareFilePath(res, token, pArr);
  } else if (dir === 'music') {
    path = await getMusicPath(res, pArr);
  } else if (dir === 'sharemusic') {
    path = await getShareMusicPath(res, token, pArr, account);
  } else if (dir === 'logo') {
    path = await getLogoPath(res, pArr);
  } else if (dir === 'pub') {
    path = await getPubPath(res, pArr);
  }

  if (path === null) return;
  const stat = await _f.lstat(path);

  if (!path || !stat || stat.isDirectory()) {
    return resp.notFound(res, '文件不存在')();
  }

  const tObj = await getThumbPath(res, w, dir, path, stat);

  if (!tObj) return;

  res.setHeader('X-File-Size', tObj.size);

  if (d === 1) {
    const [oFileName, , , suffix] = _path.basename(tObj.path);
    const fileName = n
      ? _path.extname(n)[2]
        ? n
        : n + (n.includes('.') ? '' : '.') + suffix
      : oFileName;
    res.setHeader(
      'Content-Disposition',
      "attachment; filename*=UTF-8''" + encodeURIComponent(fileName),
    );
    res.setHeader('Content-Type', 'application/octet-stream');
  }

  res.sendFile(tObj.path, { dotfiles: 'allow' });
}
async function getPicPath(res, id) {
  try {
    id = await V.parse(id, V.string().trim().min(1).max(fieldLength.id).alphanumeric(), 'pic id');
  } catch (error) {
    resp.badRequest(res)(error, 1);
    return null;
  }
  const pic = await db('pic').select('url').where({ id }).findOne();
  if (pic && pic.url) {
    return appConfig.picDir(pic.url);
  }
  return '';
}

async function getBgPath(res, id) {
  try {
    id = await V.parse(id, V.string().trim().min(1).max(fieldLength.id).alphanumeric(), 'bg id');
  } catch (error) {
    resp.badRequest(res)(error, 1);
    return null;
  }
  const bg = await db('bg').select('url').where({ id }).findOne();
  if (bg && bg.url) {
    return appConfig.bgDir(bg.url);
  }
  return '';
}

async function getLogoPath(res, pArr) {
  let acc = pArr[0];
  try {
    acc = await V.parse(
      acc,
      V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      'logo account',
    );
  } catch (error) {
    resp.badRequest(res)(error, 1);
    return null;
  }
  return appConfig.logoDir(acc, pArr.slice(1).join('/'));
}

async function getUploadPath(res, id, account) {
  try {
    id = await V.parse(id, V.string().trim().min(1).max(fieldLength.id).alphanumeric(), 'chat id');
  } catch (error) {
    resp.badRequest(res)(error, 1);
    return null;
  }

  const msg = await db('chat AS c')
    .join('upload AS u', { 'c.hash': { value: 'u.id', raw: true } }, { type: 'LEFT' })
    .select('c.flag,u.url')
    .where({ 'c.id': id })
    .findOne();

  if (msg && msg.url && (msg.flag === appConfig.chatRoomAccount || msg.flag.includes(account))) {
    // 消息文件存在，并且是群和自己发送或收到的消息
    return appConfig.uploadDir(msg.url);
  } else {
    resp.forbidden(res, '无权访问')();
    return null;
  }
}

async function getShareFilePath(res, token, pArr) {
  const share = await validShareState(token, 'file');

  if (share.state === 0) {
    resp.forbidden(res, share.text)();
    return null;
  }

  if (share.state === 1) {
    const obj = share.data.data;

    const { name, type } = obj;

    const rootP = appConfig.userRootDir(share.data.account, obj.path, name);

    if (type === 'file') {
      return rootP;
    } else if (type === 'dir') {
      return _path.normalizeNoSlash(rootP, pArr.join('/'));
    }
  }
  return '';
}

async function getShareMusicPath(res, token, pArr, account) {
  let [, id] = pArr;
  if (account) {
    return getMusicPath(res, pArr);
  } else {
    const share = await validShareState(token, 'music');
    if (share.state === 0) {
      resp.forbidden(res, share.text)();
      return null;
    }
    if (share.state === 1) {
      if (share.data.data.some((item) => item === id)) {
        return getMusicPath(res, pArr);
      } else {
        resp.forbidden(res, '无权访问')();
        return null;
      }
    }
    return '';
  }
}

function getFilePath(account, pArr) {
  return appConfig.userRootDir(account, pArr.join('/'));
}

async function getPubPath(res, pArr) {
  let acc = pArr[0];
  try {
    acc = await V.parse(
      acc,
      V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      'pub account',
    );
  } catch (error) {
    resp.badRequest(res)(error, 1);
    return null;
  }
  return appConfig.pubDir(acc, pArr.slice(1).join('/'));
}

async function getMusicPath(res, pArr) {
  let [type, id] = pArr;
  try {
    id = await V.parse(id, V.string().trim().min(1).max(fieldLength.id).alphanumeric(), 'song id');
    type = await V.parse(type, V.string().trim().enum(['pic', 'url', 'mv']), 'song type');
  } catch (error) {
    resp.badRequest(res)(error, 1);
    return null;
  }
  const song = await db('songs').select(type).where({ id }).findOne();
  if (song && song[type]) {
    return appConfig.musicDir(song[type]);
  }
  return '';
}

async function getThumbPath(res, w, dir, path, stat) {
  let size = stat.size;

  // 生成缩略图
  if (
    w > 0 &&
    !_path.isPathWithin(appConfig.thumbDir(), path, 1) &&
    stat.isFile() &&
    isImgFile(path) &&
    ['pic', 'music', 'bg', 'upload', 'file', 'sharefile', 'sharemusic'].includes(dir)
  ) {
    try {
      if (size > fieldLength.maxBgSize * 1024 * 1024) {
        resp.forbidden(res, '获取缩略图失败')('图片过大', 1);
        return null;
      }

      if (dir === 'sharefile') {
        dir = 'file';
      }
      if (dir === 'sharemusic') {
        dir = 'music';
      }

      w = normalizeWidth(w);

      let thumbP = '';
      if (dir === 'file') {
        thumbP = appConfig.thumbDir(dir, `${_path.basename(path)[1]}_${w}_${size}.webp`);
      } else {
        thumbP = appConfig.thumbDir(
          `${_path.extname(path.slice(appConfig.appFilesDir().length))[0]}_${w}.webp`,
        );
      }

      const thumbStat = await _f.lstat(thumbP);
      if (!thumbStat) {
        const buf = await convertImageFormat(path, {
          format: 'webp',
          width: w,
          height: 1024,
        });

        size = buf.length;
        await _f.writeFile(thumbP, buf);
      } else {
        size = thumbStat.size;
      }

      path = thumbP;
    } catch (error) {
      resp.forbidden(res, '获取缩略图失败')(error, 1);
      return null;
    }
  }
  return { path, size };
}

function normalizeWidth(w) {
  if (w <= 256) return 256;
  if (w <= 512) return 512;
  if (w <= 1024) return 1024;
  return 1024;
}
