import express from 'express';

import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _f from '../../utils/f.js';

import {
  updateData,
  insertData,
  queryData,
  deleteData,
  getTableRowCount,
  batchUpdateData,
  fillString,
} from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import {
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  isImgFile,
  validationValue,
  _type,
  validaString,
  paramErr,
  getTimePath,
  syncUpdateData,
  concurrencyTasks,
  createPagingData,
  uLog,
} from '../../utils/utils.js';

import { _delDir } from '../file/file.js';

import { getRandomBg } from './bg.js';

import { getImgInfo } from '../../utils/img.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import _connect from '../../utils/connect.js';
import nanoid from '../../utils/nanoid.js';

const route = express.Router();

// 获取随机一张壁纸
route.get('/r/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!validationValue(type, ['big', 'small'])) {
      paramErr(res, req);
      return;
    }

    // 检查壁纸接口是否开启
    if (!_d.pubApi.randomBgApi) {
      return _err(res, '接口未开放')(req);
    }

    // 从数据库中随机选择一条数据
    const bgData = await getRandomBg(type === 'big' ? 'bg' : 'bgxs', 'url');

    // 如果没有数据，返回错误
    if (!bgData) {
      return _err(res, '壁纸库为空')(req);
    }

    // 获取壁纸 URL 并返回
    const url = _path.normalize(appConfig.appData, 'bg', bgData.url);

    if (await _f.exists(url)) {
      res.sendFile(url, { dotfiles: 'allow' });
    } else {
      _err(res, '获取壁纸失败')(req, url, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 验证登录态
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
    // 从数据库中随机获取一张背景壁纸和一张背景小图
    const bg = await getRandomBg('bg', 'id');
    const bgxs = await getRandomBg('bgxs', 'id');

    // 更新用户数据
    await batchUpdateData(
      'user',
      { bg: bg ? bg.id : '', bgxs: bgxs ? bgxs.id : '' },
      `WHERE daily_change_bg = ? AND state = ?`,
      [1, 1]
    );

    Object.keys(_connect.getConnects()).forEach((key) => {
      _connect.send(key, nanoid(), {
        type: 'updatedata',
        data: {
          flag: 'userinfo',
        },
      });
    });
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

    const bgData = await getRandomBg(type, 'url,id,type');

    if (!bgData) {
      _err(res, '壁纸库为空，请先上传壁纸')(req);
      return;
    }

    _success(res, 'ok', bgData);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 更换壁纸
route.post('/change', async (req, res) => {
  try {
    const { type, id } = req.body;

    if (
      !validationValue(type, ['bg', 'bgxs']) ||
      !validaString(id, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'user',
      { [type]: id },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

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
      pageSize > fieldLength.bgPageSize
    ) {
      paramErr(res, req);
      return;
    }

    const total = await getTableRowCount('bg', `WHERE type = ?`, [type]);

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];
    if (total > 0) {
      data = await queryData(
        'bg',
        'id,url,type',
        `WHERE type = ? ORDER BY serial DESC LIMIT ? OFFSET ?`,
        [type, pageSize, offset]
      );
    }

    _success(res, 'ok', {
      ...result,
      data,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除壁纸
route.post('/delete', async (req, res) => {
  try {
    const ids = req.body;

    // 验证管理员
    if (!req._hello.isRoot) {
      _err(res, '无权操作')(req);
      return;
    }

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
      'bg',
      'url',
      `WHERE id IN (${fillString(ids.length)})`,
      [...ids]
    );

    await deleteData('bg', `WHERE id IN (${fillString(ids.length)})`, [...ids]);

    await concurrencyTasks(dels, 5, async (del) => {
      const { url } = del;
      await _delDir(_path.normalize(appConfig.appData, 'bg', url));
      await uLog(req, `删除壁纸(${url})`);
    });

    syncUpdateData(req, 'bg');

    _success(res, '删除壁纸成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 上传
route.post('/up', async (req, res) => {
  try {
    let { HASH, name } = req.query;

    if (!validaString(HASH, 1, fieldLength.id, 1) || !isImgFile(name)) {
      paramErr(res, req);
      return;
    }

    name = _path.sanitizeFilename(name);

    const bg = (await queryData('bg', 'url', `WHERE hash = ?`, [HASH]))[0];
    if (bg) {
      _err(res, '壁纸已存在')(req, `${name}-${HASH}`, 1);
      return;
    }

    const [title, , suffix] = _path.extname(name);

    const timePath = getTimePath(Date.now());

    const tDir = _path.normalize(appConfig.appData, 'bg', timePath);
    const tName = `${HASH}.${suffix}`;

    await _f.mkdir(tDir);

    await receiveFiles(req, tDir, tName, 10, HASH);

    // 获取壁纸尺寸进行分类
    const { width, height } = await getImgInfo(_path.normalize(tDir, tName));
    const type = width < height ? 'bgxs' : 'bg';

    const url = _path.normalize(timePath, tName);

    await insertData('bg', [
      {
        hash: HASH,
        url,
        type,
        title,
      },
    ]);

    _success(res, '上传壁纸成功')(req, url, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 重复
route.post('/repeat', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const bg = (await queryData('bg', 'url,id', `WHERE hash = ?`, [HASH]))[0];

    if (bg) {
      if (await _f.exists(_path.normalize(appConfig.appData, 'bg', bg.url))) {
        _success(res);
        return;
      }

      // 壁纸文件丢失，删除数据，重新上传
      await deleteData('bg', `WHERE id = ?`, [bg.id]);
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
