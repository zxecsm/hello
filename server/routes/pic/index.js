import express from 'express';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { getImgInfo } from '../../utils/img.js';

import { db } from '../../utils/sqlite.js';

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
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';

import { _delDir } from '../file/file.js';
import _path from '../../utils/path.js';
import nanoid from '../../utils/nanoid.js';

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
    let { HASH, name } = req.query;

    if (!validaString(HASH, 1, fieldLength.id, 1) || !isImgFile(name)) {
      paramErr(res, req);
      return;
    }

    name = _path.sanitizeFilename(name);

    const pic = await db('pic').select('hash').where({ hash: HASH }).findOne();

    if (pic) {
      _err(res, '图片已存在')(req, HASH, 1);
      return;
    }

    const [title, , suffix] = _path.extname(name);

    const create_at = Date.now();
    const timePath = getTimePath(create_at);

    const tDir = appConfig.picDir(timePath);
    const tName = `${HASH}.${suffix}`;

    await receiveFiles(req, tDir, tName, fieldLength.maxPicSize, HASH);

    await getImgInfo(_path.normalize(tDir, tName));

    const obj = {
      id: nanoid(),
      create_at,
      hash: HASH,
      url: _path.normalize(timePath, tName),
      title,
    };

    await db('pic').insert(obj);

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

    const pic = await db('pic')
      .select('id,url')
      .where({ hash: HASH })
      .findOne();

    if (pic) {
      if (await _f.exists(appConfig.picDir(pic.url))) {
        _success(res, 'ok', pic);
        return;
      }

      await db('pic').where({ id: pic.id }).delete();
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

    const total = await db('pic').count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;

      list = await db('pic')
        .select('url,id,hash')
        .orderBy('serial', 'desc')
        .page(pageSize, offset)
        .find();
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

    const dels = await db('pic')
      .select('url')
      .where({ id: { in: ids } })
      .find();

    await concurrencyTasks(dels, 5, async (del) => {
      const { url } = del;

      await _delDir(appConfig.picDir(url));

      await uLog(req, `删除图片(${url})`);
    });

    await db('pic')
      .where({ id: { in: ids } })
      .delete();

    _success(res, '删除图片成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
