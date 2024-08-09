const express = require('express'),
  route = express.Router();
const configObj = require('../data/config');
const {
  _err,
  _nologin,
  compressionImg,
  getCompressionSize,
  isImgFile,
  getPathFilename,
  validaString,
  paramErr,
  hdPath,
  _hdPath,
  isValid,
  getRootDir,
} = require('../utils/utils');
const { queryData } = require('../utils/sqlite');
const _f = require('../utils/f');
// 读取文件
route.get('/', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { t = '', p, pass = '' } = req.query;
    if (
      !validaString(t, 0, 1, 1) ||
      !validaString(pass, 0, 20) ||
      !validaString(p, 1, 1000)
    ) {
      paramErr(res, req);
      return;
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
        await queryData('getchatfile', 'flag,url', `WHERE id=?`, [id])
      )[0];
      if (msg) {
        if (msg.url && (msg.flag == 'chang' || msg.flag.includes(account))) {
          path = hdPath(`${configObj.filepath}/upload/${msg.url}`);
        }
      }
    } else if (dir === 'file') {
      path = _hdPath(account, pArr.slice(1).join('/'));
    } else if (dir === 'sharefile') {
      const id = pArr[1];
      const share = (
        await queryData(
          'share',
          '*',
          `WHERE id=? AND (pass=? OR pass=?) AND type IN(?,?)`,
          [id, '', pass, 'file', 'dir']
        )
      )[0];
      if (share && !isValid(share.valid)) {
        const obj = JSON.parse(share.data);
        const { name, type } = obj;
        const rootP = hdPath(
          getRootDir(share.account) + '/' + obj.path + '/' + name
        );
        if (type == 'file') {
          path = rootP;
        } else if (type == 'dir') {
          path = hdPath(`${rootP}/${pArr.slice(2).join('/')}`);
        }
      }
    } else if (dir === 'sharemusic') {
      if (account) {
        path = `${configObj.filepath}/music/${pArr.slice(3).join('/')}`;
      } else {
        const id = pArr[1];
        const mid = pArr[2];
        const share = (
          await queryData(
            'share',
            '*',
            `WHERE id=? AND type=? AND (pass=? OR pass=?)`,
            [id, 'music', '', pass]
          )
        )[0];
        if (share && !isValid(share.valid)) {
          const arr = JSON.parse(share.data);
          if (arr.some((item) => item == mid)) {
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
