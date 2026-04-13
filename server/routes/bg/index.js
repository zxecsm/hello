import express from 'express';

import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _f from '../../utils/f.js';

import { db } from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import {
  receiveFiles,
  isImgFile,
  getTimePath,
  syncUpdateData,
  concurrencyTasks,
  createPagingData,
  unique,
} from '../../utils/utils.js';

import { _delDir } from '../file/file.js';

import { batchGetCollectBgList, getCollectBgList, getRandomBg, updateCollecBgtList } from './bg.js';

import { getImgInfo } from '../../utils/img.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import _connect from '../../utils/connect.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import getFile from '../getfile/index.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 获取随机一张壁纸
route.get(
  '/r/:type',
  validate(
    [
      'params',
      V.object({
        type: V.string().trim().enum(['d', 'm']),
      }),
    ],
    ['query', V.object({ w: V.number().toInt().default(0).min(0) })],
  ),
  asyncHandler(async (req, res) => {
    const { type } = res.locals.ctx.params;

    // 检查壁纸接口是否开启
    if (!_d.pubApi.randomBgApi && !res.locals.hello.userinfo.account) {
      return resp.forbidden(res, '接口未开放')();
    }

    // 从数据库中随机选择一条数据
    const bgData = await getRandomBg(type === 'd' ? 'bg' : 'bgxs', 'id');

    // 如果没有数据，返回错误
    if (!bgData) {
      return resp.notFound(res, '壁纸库为空')();
    }

    await getFile(req, res, `/bg/${bgData.id}`, false);
  }),
);

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

// 每日切换壁纸
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '000000') {
    // 从数据库中随机获取一张背景壁纸和一张背景小图
    const bg = await getRandomBg('bg', 'id');
    const bgxs = await getRandomBg('bgxs', 'id');

    // 更新用户数据
    await db('user')
      .where({ daily_change_bg: 1, state: 1 })
      .batchUpdate({ bg: bg ? bg.id : '', bgxs: bgxs ? bgxs.id : '' });

    Object.keys(_connect.getConnects()).forEach((key) => {
      _connect.send(
        key,
        nanoid(),
        {
          type: 'updatedata',
          data: {
            flag: 'userinfo',
          },
        },
        'all',
      );
    });
  }
});

// 随机壁纸
route.get(
  '/random',
  validate('query', V.object({ type: V.string().trim().enum(['bg', 'bgxs']) })),
  asyncHandler(async (_, res) => {
    const { type } = res.locals.ctx;

    const bgData = await getRandomBg(type, 'id,type');

    if (!bgData) {
      return resp.notFound(res, '壁纸库为空，请先上传壁纸')();
    }

    resp.success(res, 'ok', bgData)();
  }),
);

// 更换壁纸
route.post(
  '/change',
  validate(
    'body',
    V.object({
      type: V.string().trim().enum(['bg', 'bgxs']),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { type, id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
    await db('user')
      .where({ account, state: 1 })
      .update({ [type]: id });

    syncUpdateData(res, 'userinfo');

    resp.success(res, '更换壁纸成功')();
  }),
);

// 收藏壁纸
route.post(
  '/collect',
  validate(
    'body',
    V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
      .min(1)
      .max(fieldLength.bgPageSize),
    'ids',
  ),
  asyncHandler(async (_, res) => {
    const ids = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;

    const list = unique([...(await getCollectBgList(account)), ...ids]).slice(
      0,
      fieldLength.collectBg,
    );

    await updateCollecBgtList(account, list);

    syncUpdateData(res, 'bg');

    resp.success(res, '收藏壁纸成功')();
  }),
);

// 壁纸列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      type: V.string().trim().enum(['bg', 'bgxs']),
      collect: V.number().toInt().default(0).enum([0, 1]),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(40).min(1).max(fieldLength.bgPageSize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { type, pageNo, pageSize, collect } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
    const collectList = await getCollectBgList(account);

    if (collect === 1) {
      let data = [];
      let result = null;
      if (collectList.length > 0) {
        const obj = await batchGetCollectBgList(collectList);
        let isChange = false;
        const list = [];
        collectList.forEach((id) => {
          const item = obj[id];
          if (item) {
            list.push(id);
            if (item.type === type) {
              data.push(item);
            }
          } else {
            isChange = true;
          }
        });
        if (isChange) {
          await updateCollecBgtList(account, list);
        }
        result = createPagingData(Array(data.length), pageSize, pageNo);
        const offset = (result.pageNo - 1) * pageSize;
        data = data.reverse().slice(offset, offset + pageSize);
      } else {
        result = createPagingData(Array(0), pageSize, pageNo);
      }

      return resp.success(res, 'ok', {
        ...result,
        data,
      })();
    }

    const bgdb = db('bg').where({ type });

    const total = await bgdb.count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];
    if (total > 0) {
      data = await bgdb.select('id,type').page(pageSize, offset).orderBy('serial', 'DESC').find();
      data = data.map((item) => {
        if (collectList.includes(item.id)) {
          item.isCollect = true;
        }
        return item;
      });
    }

    resp.success(res, 'ok', {
      ...result,
      data,
    })();
  }),
);

// 删除壁纸
route.post(
  '/delete',
  validate(
    'body',
    V.object({
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.bgPageSize),
      collect: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids, collect } = res.locals.ctx;

    if (collect === 1) {
      const { account } = res.locals.hello.userinfo;

      const list = (await getCollectBgList(account)).filter((item) => !ids.includes(item));

      await updateCollecBgtList(account, list);

      syncUpdateData(res, 'bg');

      return resp.success(res, '删除收藏壁纸成功')();
    }

    // 验证管理员
    if (!res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权操作')();
    }

    const bgDb = db('bg')
      .select('url')
      .where({ id: { in: ids } });

    const dels = await bgDb.find();

    await bgDb.delete();

    await concurrencyTasks(dels, 5, async (del) => {
      const { url } = del;
      await _delDir(appConfig.bgDir(url));
    });

    syncUpdateData(res, 'bg');

    resp.success(res, '删除壁纸成功')();
  }),
);

// 上传
route.post(
  '/up',
  validate(
    'query',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      name: V.string()
        .trim()
        .preprocess((v) => (typeof v === 'string' ? _path.sanitizeFilename(v) : v))
        .min(1)
        .max(fieldLength.filename)
        .custom(isImgFile, '必须为受支持的图片格式'),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { HASH, name } = res.locals.ctx;

    const bg = await db('bg').select('url').where({ hash: HASH }).findOne();
    if (bg) {
      return resp.forbidden(res, '壁纸已存在')();
    }

    const [title, , suffix] = _path.extname(name);
    const create_at = Date.now();
    const timePath = getTimePath(create_at);

    const tDir = appConfig.bgDir(timePath);
    const tName = `${HASH}.${suffix}`;

    await receiveFiles(req, tDir, tName, fieldLength.maxBgSize, HASH);

    // 获取壁纸尺寸进行分类
    const { width, height } = await getImgInfo(_path.normalizeNoSlash(tDir, tName));
    const type = width < height ? 'bgxs' : 'bg';

    const url = _path.normalizeNoSlash(timePath, tName);

    await db('bg').insert({
      create_at,
      id: nanoid(),
      hash: HASH,
      url,
      type,
      title,
    });

    resp.success(res, '上传壁纸成功')();
  }),
);

// 重复
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

    const bg = await db('bg').select('url,id').where({ hash: HASH }).findOne();

    if (bg) {
      if ((await _f.getType(appConfig.bgDir(bg.url))) === 'file') {
        return resp.success(res)();
      }

      // 壁纸文件丢失，删除数据，重新上传
      await db('bg').where({ id: bg.id }).delete();
    }

    resp.ok(res)();
  }),
);

export default route;
