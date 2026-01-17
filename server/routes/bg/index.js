import express from 'express';

import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _f from '../../utils/f.js';

import { db } from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import {
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  isImgFile,
  getTimePath,
  syncUpdateData,
  concurrencyTasks,
  createPagingData,
  uLog,
  validate,
} from '../../utils/utils.js';

import { _delDir } from '../file/file.js';

import { getRandomBg } from './bg.js';

import { getImgInfo } from '../../utils/img.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import _connect from '../../utils/connect.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';
import getFile from '../getfile/index.js';

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

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
  async (req, res) => {
    try {
      const { type } = req[kValidate].params;

      // 检查壁纸接口是否开启
      if (!_d.pubApi.randomBgApi) {
        return _err(res, '接口未开放')(req);
      }

      // 从数据库中随机选择一条数据
      const bgData = await getRandomBg(type === 'd' ? 'bg' : 'bgxs', 'id');

      // 如果没有数据，返回错误
      if (!bgData) {
        return _err(res, '壁纸库为空')(req);
      }

      await getFile(req, res, `/bg/${bgData.id}`, false);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

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
  async (req, res) => {
    try {
      const { type } = req[kValidate];

      const bgData = await getRandomBg(type, 'id,type');

      if (!bgData) {
        _err(res, '壁纸库为空，请先上传壁纸')(req);
        return;
      }

      _success(res, 'ok', bgData);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { type, id } = req[kValidate];

      const { account } = req[kHello].userinfo;
      await db('user')
        .where({ account, state: 1 })
        .update({ [type]: id });

      syncUpdateData(req, 'userinfo');

      _success(res, '更换壁纸成功')(req, `${type}-${id}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 壁纸列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      type: V.string().trim().enum(['bg', 'bgxs']),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(40).min(1).max(fieldLength.bgPageSize),
    }),
  ),
  async (req, res) => {
    try {
      const { type, pageNo, pageSize } = req[kValidate];

      const bgdb = db('bg').where({ type });

      const total = await bgdb.count();

      const result = createPagingData(Array(total), pageSize, pageNo);

      const offset = (result.pageNo - 1) * pageSize;

      let data = [];
      if (total > 0) {
        data = await bgdb.select('id,type').page(pageSize, offset).orderBy('serial', 'DESC').find();
      }

      _success(res, 'ok', {
        ...result,
        data,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 删除壁纸
route.post(
  '/delete',
  validate(
    'body',
    V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
      .min(1)
      .max(fieldLength.bgPageSize),
    'ids',
  ),
  async (req, res) => {
    try {
      const ids = req[kValidate];

      // 验证管理员
      if (!req[kHello].isRoot) {
        _err(res, '无权操作')(req);
        return;
      }

      const bgDb = db('bg')
        .select('url')
        .where({ id: { in: ids } });

      const dels = await bgDb.find();

      await bgDb.delete();

      await concurrencyTasks(dels, 5, async (del) => {
        const { url } = del;
        await _delDir(appConfig.bgDir(url));
        await uLog(req, `删除壁纸(${url})`);
      });

      syncUpdateData(req, 'bg');

      _success(res, '删除壁纸成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { HASH, name } = req[kValidate];

      const bg = await db('bg').select('url').where({ hash: HASH }).findOne();
      if (bg) {
        _err(res, '壁纸已存在')(req, `${name}-${HASH}`, 1);
        return;
      }

      const [title, , suffix] = _path.extname(name);
      const create_at = Date.now();
      const timePath = getTimePath(create_at);

      const tDir = appConfig.bgDir(timePath);
      const tName = `${HASH}.${suffix}`;

      await receiveFiles(req, tDir, tName, fieldLength.maxBgSize, HASH);

      // 获取壁纸尺寸进行分类
      const { width, height } = await getImgInfo(_path.normalize(tDir, tName));
      const type = width < height ? 'bgxs' : 'bg';

      const url = _path.normalize(timePath, tName);

      await db('bg').insert({
        create_at,
        id: nanoid(),
        hash: HASH,
        url,
        type,
        title,
      });

      _success(res, '上传壁纸成功')(req, url, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { HASH } = req[kValidate];

      const bg = await db('bg').select('url,id').where({ hash: HASH }).findOne();

      if (bg) {
        if ((await _f.getType(appConfig.bgDir(bg.url))) === 'file') {
          _success(res);
          return;
        }

        // 壁纸文件丢失，删除数据，重新上传
        await db('bg').where({ id: bg.id }).delete();
      }

      _nothing(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

export default route;
