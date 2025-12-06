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
  getTimePath,
  createPagingData,
  concurrencyTasks,
  uLog,
  validate,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';

import { _delDir } from '../file/file.js';
import _path from '../../utils/path.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';

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
route.post(
  '/up',
  validate(
    'query',
    V.object({
      name: V.string()
        .trim()
        .preprocess((v) =>
          typeof v === 'string' ? _path.sanitizeFilename(v) : v
        )
        .min(1)
        .max(fieldLength.filename)
        .custom((v) => isImgFile(v), '必须图片文件后缀'),
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { HASH, name } = req._vdata;

      const pic = await db('pic')
        .select('hash')
        .where({ hash: HASH })
        .findOne();

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
  }
);

// 重复图片
route.post(
  '/repeat',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { HASH } = req._vdata;

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
  }
);

route.use((req, res, next) => {
  if (req._hello.isRoot) {
    next();
  } else {
    _err(res, '无权操作')(req);
  }
});

// 图片列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(40)
        .min(1)
        .max(fieldLength.bgPageSize),
    })
  ),
  async (req, res) => {
    try {
      const { pageNo, pageSize } = req._vdata;

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
  }
);

// 删除图片
route.post(
  '/delete',
  validate(
    'body',
    V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
      .min(1)
      .max(fieldLength.bgPageSize),
    'ids'
  ),
  async (req, res) => {
    try {
      const ids = req._vdata;

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
  }
);

export default route;
