import express from 'express';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { getImgInfo } from '../../utils/img.js';

import {
  queryData,
  deleteData,
  insertData,
  fillString,
  getTableRowCount,
} from '../../utils/sqlite.js';

import {
  _success,
  _nothing,
  _err,
  receiveFiles,
  isImgFile,
  _nologin,
  _type,
  paramErr,
  getTimePath,
  validaString,
  createPagingData,
  concurrencyTasks,
  uLog,
  isFilename,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';

import { _delDir } from '../file/file.js';
import _path from '../../utils/path.js';

const route = express.Router();

// 验证登录态
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
      !validaString(HASH, 1, fieldLength.id, 1) ||
      !isImgFile(name) ||
      !validaString(name, 1, fieldLength.filename) ||
      !isFilename(name)
    ) {
      paramErr(res, req);
      return;
    }

    const pic = (await queryData('pic', 'hash', `WHERE hash = ?`, [HASH]))[0];

    if (pic) {
      _err(res, '图片已存在')(req, HASH, 1);
      return;
    }

    const [title, , suffix] = _path.extname(name);

    const timePath = getTimePath(Date.now());

    const tDir = _path.normalize(appConfig.appData, 'pic', timePath);
    const tName = `${HASH}.${suffix}`;

    await _f.mkdir(tDir);
    await receiveFiles(req, tDir, tName, 10);

    await getImgInfo(_path.normalize(tDir, tName));

    const obj = {
      hash: HASH,
      url: _path.normalize(timePath, tName),
      title,
    };

    await insertData('pic', [obj]);

    _success(res, '上传图片成功', obj)(req, obj.url, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 重复图片
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const pic = (await queryData('pic', 'id,url', `WHERE hash = ?`, [HASH]))[0];

    if (pic) {
      if (await _f.exists(_path.normalize(appConfig.appData, 'pic', pic.url))) {
        _success(res, 'ok', pic);
        return;
      }

      await deleteData('pic', `WHERE id = ?`, [pic.id]);
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

route.use((req, res, next) => {
  if (req._hello.isRoot) {
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
      pageSize > fieldLength.bgPageSize
    ) {
      paramErr(res, req);
      return;
    }

    const total = await getTableRowCount('pic');

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;

      list = await queryData(
        'pic',
        'url,id,hash',
        `ORDER BY create_at DESC LIMIT ? OFFSET ?`,
        [pageSize, offset]
      );
    }

    _success(res, 'ok', {
      ...result,
      data: list,
    });
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
      ids.length === 0 ||
      ids.length > fieldLength.bgPageSize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const dels = await queryData(
      'pic',
      'url',
      `WHERE id IN (${fillString(ids.length)})`,
      [...ids]
    );

    await concurrencyTasks(dels, 5, async (del) => {
      const { url } = del;

      await _delDir(_path.normalize(appConfig.appData, 'pic', url));

      await uLog(req, `删除图片(${url})`);
    });

    await deleteData('pic', `WHERE id IN (${fillString(ids.length)})`, [
      ...ids,
    ]);

    _success(res, '删除图片成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
