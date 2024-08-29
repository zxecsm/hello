const express = require('express'),
  route = express.Router();
const configObj = require('../data/config');
const _f = require('../utils/f');
const { queryData, deleteData, insertData } = require('../utils/sqlite');
const {
  _success,
  _nothing,
  _err,
  receiveFiles,
  isImgFile,
  _nologin,
  getSuffix,
  _type,
  paramErr,
  _delDir,
  getTimePath,
  validaString,
  createFillString,
  nanoid,
  createPagingData,
  getImgInfo,
  isRoot,
} = require('../utils/utils');

//拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});
// 上传图片
route.post('/up', async (req, res) => {
  try {
    const { HASH, name } = req.query;
    if (
      !validaString(HASH, 1, 50, 1) ||
      !isImgFile(name) ||
      !validaString(name, 1, 255)
    ) {
      paramErr(res, req);
      return;
    }
    const pic = (await queryData('pic', '*', `WHERE hash=?`, [HASH]))[0];
    if (pic) {
      _err(res, '图片已存在')(req, HASH, 1);
      return;
    }
    const [title, suffix] = getSuffix(name);
    const time = Date.now();
    const timePath = getTimePath(time);
    const tDir = `${configObj.filepath}/pic/${timePath}`;
    const tName = `${HASH}.${suffix}`;
    await _f.mkdir(tDir);
    await receiveFiles(req, tDir, tName, 5);
    await getImgInfo(`${tDir}/${tName}`);
    const obj = {
      id: nanoid(),
      hash: HASH,
      url: `${timePath}/${tName}`,
      time,
      title,
    };
    await insertData('pic', [obj]);
    _success(res, '上传图片成功', obj)(req, obj.id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 重复图片
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;
    if (!validaString(HASH, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const pic = (await queryData('pic', '*', `WHERE hash=?`, [HASH]))[0];
    if (pic) {
      if (_f.c.existsSync(`${configObj.filepath}/pic/${pic.url}`)) {
        _success(res, 'ok', pic);
        return;
      }
      await deleteData('pic', `WHERE id=?`, [pic.id]);
    }
    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
route.use((req, res, next) => {
  if (isRoot(req)) {
    next();
  } else {
    _err(res, '无权操作')(req);
  }
});
// 图片列表
route.get('/list', async (req, res) => {
  try {
    let { pageNo = 1, pageSize = 40 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      paramErr(res, req);
      return;
    }
    const list = await queryData('pic', '*');
    list.reverse();
    _success(res, 'ok', createPagingData(list, pageSize, pageNo));
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除图片
route.post('/delete', async (req, res) => {
  try {
    const ids = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 100 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const dels = await queryData(
      'pic',
      'url',
      `WHERE id IN (${createFillString(ids.length)})`,
      [...ids]
    );
    for (let i = 0; i < dels.length; i++) {
      const { url } = dels[i];
      await _delDir(`${configObj.filepath}/pic/${url}`).catch(() => {});
    }
    await deleteData('pic', `WHERE id IN (${createFillString(ids.length)})`, [
      ...ids,
    ]);
    _success(res, '删除图片成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
