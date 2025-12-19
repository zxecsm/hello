import appConfig from '../../data/config.js';

import {
  _err,
  _nologin,
  isImgFile,
  paramErr,
  errLog,
} from '../../utils/utils.js';

import { db } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { convertImageFormat } from '../../utils/img.js';
import { validShareState } from '../user/user.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';

const kHello = sym('hello');
const kValidate = sym('validate');

export default async function getFile(
  req,
  res,
  originalPath,
  verifyLogin = true
) {
  try {
    const params = { ...req.query, p: originalPath };
    try {
      req[kValidate] = await V.parse(
        params,
        V.object({
          w: V.number().toInt().default(0).min(0),
          token: V.string()
            .trim()
            .default('')
            .allowEmpty()
            .max(fieldLength.url),
          p: V.string().notEmpty().min(1).max(fieldLength.url),
        })
      );
    } catch (error) {
      paramErr(res, req, error, params);
      return;
    }

    let { token, p, w } = req[kValidate];

    let { account } = req[kHello].userinfo;

    const jwtData = token ? await jwt.get(token) : '';

    // 以指定的用户身份访问指定的文件
    if (jwtData?.data?.type === 'temAccessFile') {
      account = jwtData.data.data.account;
      p = jwtData.data.data.p;
    }

    const url = _path.normalize('/' + p);

    // 获取访问目录
    const pArr = url.split('/').filter(Boolean);

    let dir = pArr.shift();

    const publicArr = ['pic', 'sharemusic', 'sharefile', 'logo', 'pub'];
    const verifyArr = ['bg', 'upload', 'file', 'music']; // 目录需要登录态

    if (publicArr.includes(dir)) {
    } else if (verifyArr.includes(dir)) {
      if (!account && verifyLogin) {
        _nologin(res);
        return;
      }
    } else {
      _err(res, '无权访问')(req, dir, 1);
      return;
    }

    // 合并url
    let path = '';

    if (dir === 'upload') {
      let id = pArr[0];
      try {
        id = await V.parse(
          id,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'chat id'
        );
      } catch (error) {
        paramErr(res, req, error, { id });
        return;
      }

      const msg = await db('chat_upload_view')
        .select('flag,url')
        .where({ id })
        .findOne();

      if (
        msg &&
        msg.url &&
        (msg.flag === appConfig.chatRoomAccount || msg.flag.includes(account))
      ) {
        // 消息文件存在，并且是群和自己发送或收到的消息
        path = appConfig.uploadDir(msg.url);
      } else {
        _err(res, '无权访问')(req, `${dir}-${id}`, 1);
        return;
      }
    } else if (dir === 'file') {
      path = appConfig.userRootDir(account, pArr.join('/'));
    } else if (dir === 'sharefile') {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        _err(res, share.text)(req, dir, 1);
        return;
      }

      if (share.state === 1) {
        const obj = share.data.data;

        const { name, type } = obj;

        const rootP = appConfig.userRootDir(share.data.account, obj.path, name);

        if (type === 'file') {
          path = rootP;
        } else if (type === 'dir') {
          path = _path.normalize(rootP, pArr.join('/'));
        }
      }
    } else if (dir === 'sharemusic') {
      if (account) {
        path = appConfig.musicDir(pArr.slice(1).join('/'));
      } else {
        let sid = pArr[0];
        try {
          sid = await V.parse(
            sid,
            V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
            'song id'
          );
        } catch (error) {
          paramErr(res, req, error, { id: sid });
          return;
        }
        const share = await validShareState(token, 'music');
        if (share.state === 0) {
          _err(res, share.text)(req, dir, 1);
          return;
        }
        if (share.state === 1) {
          if (share.data.data.some((item) => item === sid)) {
            path = appConfig.musicDir(pArr.slice(1).join('/'));
          }
        }
      }
    } else if (dir === 'logo') {
      let acc = pArr[0];
      try {
        acc = await V.parse(
          acc,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'logo account'
        );
      } catch (error) {
        paramErr(res, req, error, { account: acc });
        return;
      }
      path = appConfig.logoDir(acc, pArr.slice(1).join('/'));
    } else if (dir === 'pub') {
      let acc = pArr[0];
      try {
        acc = await V.parse(
          acc,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'pub account'
        );
      } catch (error) {
        paramErr(res, req, error, { account: acc });
        return;
      }
      path = appConfig.pubDir(acc, pArr.slice(1).join('/'));
    } else {
      path = appConfig.appFilesDir(url);
    }

    const stat = await _f.lstat(path);

    if (!path || !stat || stat.isDirectory()) {
      _err(res, '文件不存在')(req, path, 1);
      return;
    }

    let size = stat.size;

    try {
      // 生成缩略图
      if (
        w > 0 &&
        !_path.isPathWithin(appConfig.thumbDir(), path, 1) &&
        stat.isFile() &&
        isImgFile(path) &&
        [
          'pic',
          'music',
          'bg',
          'upload',
          'file',
          'sharefile',
          'sharemusic',
        ].includes(dir)
      ) {
        if (dir === 'sharefile') {
          dir = 'file';
        }
        if (dir === 'sharemusic') {
          dir = 'music';
        }

        w = normalizeWidth(w);

        let thumbP = '';
        if (dir === 'file') {
          thumbP = appConfig.thumbDir(
            dir,
            `${_path.basename(path)[1]}_${w}_${size}.webp`
          );
        } else {
          thumbP = appConfig.thumbDir(
            `${
              _path.extname(path.slice(appConfig.appFilesDir().length))[0]
            }_${w}.webp`
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
      }
    } catch (error) {
      await errLog(req, `生成缩略图失败(${error})-${path}`);
    }
    res.setHeader('X-File-Size', size);
    res.sendFile(path, { dotfiles: 'allow' });
  } catch (error) {
    _err(res)(req, error);
  }
}

function normalizeWidth(w) {
  if (w <= 256) return 256;
  if (w <= 512) return 512;
  if (w <= 1024) return 1024;
  return 1024;
}
