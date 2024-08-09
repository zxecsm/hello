const express = require('express'),
  route = express.Router();
const configObj = require('../data/config');
const _f = require('../utils/f');
const {
  updateData,
  insertData,
  queryData,
  deleteData,
} = require('../utils/sqlite');
const timedTask = require('../utils/timedTask');
const {
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  isImgFile,
  getSuffix,
  randomNum,
  validationValue,
  _type,
  validaString,
  paramErr,
  _delDir,
  getTimePath,
  getImgInfo,
  createFillString,
  nanoid,
  getIn,
  syncUpdateData,
  createPagingData,
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
// 每日切换壁纸
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '000000') {
    const bgarr = await queryData('bg', 'type,id');
    const bg = bgarr.filter((item) => item.type == 'bg');
    const bgxs = bgarr.filter((item) => item.type == 'bgxs');
    const num = randomNum(0, bg.length - 1),
      xsnum = randomNum(0, bgxs.length - 1);
    await updateData(
      'user',
      {
        bg: getIn(bg, [num, 'id']) || '',
        bgxs: getIn(bgxs, [xsnum, 'id']) || '',
      },
      `WHERE dailybg=? AND state=?`,
      ['y', '0']
    );
  }
});
// 随机壁纸
route.get('/random', async (req, res) => {
  try {
    const { type } = req.query;
    if (!validationValue(type, ['bg', 'bgxs'])) {
      paramErr(res, req);
      return;
    }
    const bgarr = await queryData('bg', '*', `WHERE type=?`, [type]);
    const idx = randomNum(0, bgarr.length - 1);
    if (bgarr.length === 0) {
      _err(res, '壁纸库为空，请先上传壁纸')(req);
      return;
    }
    _success(res, 'ok', bgarr[idx]);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 更换壁纸
route.post('/change', async (req, res) => {
  try {
    const { account } = req._hello.userinfo,
      { type, id } = req.body;
    if (!validationValue(type, ['bg', 'bgxs']) || !validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    await updateData('user', { [type]: id }, `WHERE account=? AND state=?`, [
      account,
      '0',
    ]);
    syncUpdateData(req, 'userinfo');
    _success(res, '更换壁纸成功')(req, `${type}-${id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 壁纸列表
route.get('/list', async (req, res) => {
  try {
    let { type, pageNo = 1, pageSize = 40 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      !validationValue(type, ['bg', 'bgxs']) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      paramErr(res, req);
      return;
    }
    const list = await queryData('bg', '*', `WHERE type=?`, [type]);
    list.reverse();
    _success(res, 'ok', createPagingData(list, pageSize, pageNo));
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除壁纸
route.post('/delete', async (req, res) => {
  try {
    const ids = req.body;
    if (!isRoot(req)) {
      _err(res, '无权操作')(req, ids.length, 1);
      return;
    }
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
      'bg',
      'url',
      `WHERE id IN (${createFillString(ids.length)})`,
      [...ids]
    );
    for (let i = 0; i < dels.length; i++) {
      const { url } = dels[i];
      await _delDir(`${configObj.filepath}/bg/${url}`).catch(() => {});
    }
    await deleteData('bg', `WHERE id IN (${createFillString(ids.length)})`, [
      ...ids,
    ]);
    syncUpdateData(req, 'bg');
    _success(res, '删除壁纸成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 上传
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
    const bg = (await queryData('bg', '*', `WHERE hash=?`, [HASH]))[0];
    if (bg) {
      _err(res, '壁纸已存在')(req, HASH, 1);
      return;
    }
    const [title, suffix] = getSuffix(name);
    const time = Date.now();
    const timePath = getTimePath(time);
    const tDir = `${configObj.filepath}/bg/${timePath}`;
    const tName = `${HASH}.${suffix}`;
    await _f.mkdir(tDir);
    await receiveFiles(req, tDir, tName, 20);
    const { width, height } = await getImgInfo(`${tDir}/${tName}`);
    const type = width < height ? 'bgxs' : 'bg';
    const id = nanoid();
    await insertData('bg', [
      {
        id,
        hash: HASH,
        url: `${timePath}/${tName}`,
        time,
        type,
        title,
      },
    ]);
    _success(res, '上传壁纸成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 重复
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;
    if (!validaString(HASH, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const bg = (await queryData('bg', '*', `WHERE hash=?`, [HASH]))[0];
    if (bg) {
      if (_f.c.existsSync(`${configObj.filepath}/bg/${bg.url}`)) {
        _success(res);
        return;
      }
      await deleteData('bg', `WHERE id=?`, [bg.id]);
    }
    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
