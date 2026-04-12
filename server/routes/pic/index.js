import express from 'express';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { getImgInfo } from '../../utils/img.js';

import { db } from '../../utils/sqlite.js';

import {
  receiveFiles,
  isImgFile,
  getTimePath,
  createPagingData,
  concurrencyTasks,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';

import { _delDir } from '../file/file.js';
import _path from '../../utils/path.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 验证登录态
route.use(
  asyncHandler((_, res, next) => {
    if (res.locals.hello.userinfo.account) {
      next();
    } else {
      resp.unauthorized(res)();
    }
  }),
);

// 上传图片
route.post(
  '/up',
  validate(
    'query',
    V.object({
      name: V.string()
        .trim()
        .preprocess((v) => (typeof v === 'string' ? _path.sanitizeFilename(v) : v))
        .min(1)
        .max(fieldLength.filename)
        .custom(isImgFile, '必须为受支持的图片格式'),
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { HASH, name } = res.locals.ctx;

    const pic = await db('pic').select('hash').where({ hash: HASH }).findOne();

    if (pic) {
      return resp.forbidden(res, '图片已存在')();
    }

    const [title, , suffix] = _path.extname(name);

    const create_at = Date.now();
    const timePath = getTimePath(create_at);

    const tDir = appConfig.picDir(timePath);
    const tName = `${HASH}.${suffix}`;

    await receiveFiles(req, tDir, tName, fieldLength.maxPicSize, HASH);

    await getImgInfo(_path.normalizeNoSlash(tDir, tName));

    const obj = {
      id: nanoid(),
      create_at,
      hash: HASH,
      url: _path.normalizeNoSlash(timePath, tName),
      title,
    };

    await db('pic').insert(obj);

    resp.success(res, '上传图片成功', { id: obj.id })();
  }),
);

// 重复图片
route.post(
  '/repeat',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { HASH } = res.locals.ctx;

    const pic = await db('pic').select('id,url').where({ hash: HASH }).findOne();

    if (pic) {
      if ((await _f.getType(appConfig.picDir(pic.url))) === 'file') {
        return resp.success(res, 'ok', { id: pic.id })();
      }

      await db('pic').where({ id: pic.id }).delete();
    }

    resp.ok(res)();
  }),
);

route.use(
  asyncHandler((_, res, next) => {
    if (res.locals.hello.isRoot) {
      next();
    } else {
      resp.forbidden(res, '无权操作')();
    }
  }),
);

// 图片列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(40).min(1).max(fieldLength.bgPageSize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { pageNo, pageSize } = res.locals.ctx;

    const total = await db('pic').count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;

      list = await db('pic').select('id').orderBy('serial', 'desc').page(pageSize, offset).find();
    }

    resp.success(res, 'ok', {
      ...result,
      data: list,
    })();
  }),
);

// 删除图片
route.post(
  '/delete',
  validate(
    'body',
    V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
      .min(1)
      .max(fieldLength.bgPageSize),
    'ids',
  ),
  asyncHandler(async (_, res) => {
    const ids = res.locals.ctx;

    const dels = await db('pic')
      .select('url')
      .where({ id: { in: ids } })
      .find();

    await concurrencyTasks(dels, 5, async (del) => {
      const { url } = del;

      await _delDir(appConfig.picDir(url));
    });

    await db('pic')
      .where({ id: { in: ids } })
      .delete();

    resp.success(res, '删除图片成功')();
  }),
);

export default route;
