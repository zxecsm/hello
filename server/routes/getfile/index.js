import express from 'express';

import configObj from '../../data/config.js';

import {
  _err,
  _nologin,
  isImgFile,
  validaString,
  paramErr,
} from '../../utils/utils.js';

import { queryData } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import fileKey from '../../utils/fileKey.js';

import { getCurPath, getRootDir } from '../file/file.js';

import { getCompressionSize, compressionImg } from '../../utils/img.js';
import { validShareState } from '../user/user.js';
import { fieldLenght } from '../config.js';
import _path from '../../utils/path.js';

const route = express.Router();

// 读取文件
route.get('/', async (req, res) => {
  try {
    let { t = '', p, pass = '', sign = '' } = req.query;

    if (
      !validaString(sign, 0, fieldLenght.id) ||
      !validaString(t, 0, 1, 1) ||
      !validaString(pass, 0, fieldLenght.sharePass) ||
      !validaString(p, 1, fieldLenght.url)
    ) {
      paramErr(res, req);
      return;
    }

    let { account } = req._hello.userinfo;

    if (!account) {
      // 如果没有登录，有文件key使用文件key
      const fKey = fileKey.get(sign);

      if (fKey) {
        account = fKey.account;
        p = fKey.p;
      }
    }

    const url = _path.normalize('/' + p);

    // 获取访问目录
    const pArr = url.split('/').filter((item) => item);

    let dir = pArr[0];

    const publicArr = ['pic', 'sharemusic', 'sharefile'];
    const verifyArr = ['bg', 'upload', 'file', 'music']; // 目录需要登录态

    if (publicArr.includes(dir)) {
    } else if (verifyArr.includes(dir)) {
      if (!account) {
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
      const id = pArr[1];

      const msg = (
        await queryData('chat_upload_view', 'flag,url', `WHERE id = ?`, [id])
      )[0];

      if (
        msg &&
        msg.url &&
        (msg.flag === 'chang' || msg.flag.includes(account))
      ) {
        // 消息文件存在，并且是群和自己发送或收到的消息
        path = _path.normalize(`${configObj.filepath}/upload/${msg.url}`);
      } else {
        _err(res, '无权访问')(req, `${dir}-${id}`, 1);
        return;
      }
    } else if (dir === 'file') {
      path = getCurPath(account, pArr.slice(1).join('/'));
    } else if (dir === 'sharefile') {
      const id = pArr[1];
      const share = await validShareState(req, ['file', 'dir'], id, pass);

      if (share.state === 0) {
        _err(res, share.text)(req, `${dir}-${id}`, 1);
        return;
      }

      if (share.state === 1) {
        const obj = share.data.data;

        const { name, type } = obj;

        const rootP = _path.normalize(
          `${getRootDir(share.data.account)}/${obj.path}/${name}`
        );

        if (type === 'file') {
          path = rootP;
        } else if (type === 'dir') {
          path = _path.normalize(`${rootP}/${pArr.slice(2).join('/')}`);
        }
      }
    } else if (dir === 'sharemusic') {
      if (account) {
        path = _path.normalize(
          `${configObj.filepath}/music/${pArr.slice(3).join('/')}`
        );
      } else {
        const id = pArr[1];
        const mid = pArr[2];

        const share = await validShareState(req, ['music'], id, pass);
        if (share.state === 0) {
          _err(res, share.text)(req, `${dir}-${id}`, 1);
          return;
        }
        if (share.state === 1) {
          if (share.data.data.some((item) => item === mid)) {
            path = _path.normalize(
              `${configObj.filepath}/music/${pArr.slice(3).join('/')}`
            );
          }
        }
      }
    } else {
      path = _path.normalize(`${configObj.filepath}${url}`);
    }

    if (!path || !(await _f.exists(path))) {
      _err(res, '文件不存在')(req, path, 1);
      return;
    }

    const stat = await _f.fsp.stat(path);
    if (stat.isDirectory()) {
      _err(res, '文件不存在')(req, path, 1);
      return;
    }

    try {
      // 生成缩略图
      if (
        stat.isFile() &&
        isImgFile(path) &&
        stat.size > 300 * 1024 &&
        t &&
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

        const thumbP = _path.normalize(
          `${configObj.filepath}/thumb/${dir}/${_path.basename(url)[1]}_${
            stat.size
          }.png`
        );

        if (!(await _f.exists(thumbP))) {
          await _f.mkdir(_path.dirname(thumbP));

          const { x, y } = getCompressionSize(dir);

          const buf = await compressionImg(path, x, y, 20);

          await _f.fsp.writeFile(thumbP, buf);
        }

        path = thumbP;
      }
    } catch {}
    res.sendFile(path);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
