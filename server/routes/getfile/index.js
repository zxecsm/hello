const express = require('express'),
  route = express.Router();

const configObj = require('../../data/config');

const {
  _err,
  _nologin,
  isImgFile,
  validaString,
  paramErr,
} = require('../../utils/utils');

const { queryData } = require('../../utils/sqlite');

const _f = require('../../utils/f');

const fileKey = require('../../utils/fileKey');
const {
  hdPath,
  getCurPath,
  getPathFilename,
  getRootDir,
} = require('../file/file');
const { getCompressionSize, compressionImg } = require('../../utils/img');
const { validShareState } = require('../user/user');
const { fieldLenght } = require('../config');

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
      const fKey = fileKey.get(sign);

      if (fKey) {
        account = fKey.account;
        p = fKey.p;
      }
    }

    const url = hdPath('/' + p);

    // 获取访问目录
    const pArr = url.split('/').filter((item) => item);

    let dir = pArr[0];

    const publicArr = ['pic', 'sharemusic', 'sharefile'];
    const verifyArr = ['bg', 'upload', 'file', 'music'];

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
        path = hdPath(`${configObj.filepath}/upload/${msg.url}`);
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

        const rootP = hdPath(
          getRootDir(share.data.account) + '/' + obj.path + '/' + name
        );

        if (type === 'file') {
          path = rootP;
        } else if (type === 'dir') {
          path = hdPath(`${rootP}/${pArr.slice(2).join('/')}`);
        }
      }
    } else if (dir === 'sharemusic') {
      if (account) {
        path = `${configObj.filepath}/music/${pArr.slice(3).join('/')}`;
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
            path = `${configObj.filepath}/music/${pArr.slice(3).join('/')}`;
          }
        }
      }
    } else {
      path = configObj.filepath + url;
    }
    path = hdPath(path);

    if (!_f.c.existsSync(path)) {
      _err(res, '文件不存在')(req, path, 1);
      return;
    }

    const stat = await _f.p.stat(path);
    if (stat.isDirectory()) {
      _err(res, '文件不存在')(req, path, 1);
      return;
    }

    try {
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
        const thumbP = `${configObj.filepath}/thumb/${dir}`;

        const tp = `${thumbP}/${getPathFilename(url)[1]}_${stat.size}.png`;

        if (!_f.c.existsSync(tp)) {
          await _f.mkdir(thumbP);

          const { x, y } = getCompressionSize(dir);

          const buf = await compressionImg(path, x, y, 20);

          await _f.p.writeFile(tp, buf);
        }

        path = tp;
      }
      // eslint-disable-next-line no-unused-vars
    } catch (error) {}
    res.sendFile(path);
  } catch (error) {
    _err(res)(req, error);
  }
});

module.exports = route;
