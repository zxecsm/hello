import express from 'express';

import { db } from '../../utils/sqlite.js';

import {
  _nologin,
  _err,
  _success,
  validaString,
  paramErr,
  syncUpdateData,
  createPagingData,
  _type,
  validationValue,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';
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

// 待办列表
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
      pageSize > fieldLength.maxPagesize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const total = await db('todo').where({ account }).count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [],
      undoneCount = 0;

    if (total > 0) {
      // 未完成代办数
      undoneCount = await db('todo').where({ account, state: 1 }).count();

      data = await db('todo')
        .select('id,content,state,update_at')
        .where({ account })
        .orderBy('state', 'desc')
        .orderBy('update_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .find();
    }

    _success(res, 'ok', {
      ...result,
      data,
      undoneCount,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 增加待办
route.post('/add', async (req, res) => {
  try {
    const { content } = req.body;

    if (!validaString(content, 1, fieldLength.todoContent)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const create_at = Date.now();
    await db('todo').insert({
      id: nanoid(),
      create_at,
      account,
      content,
      update_at: create_at,
    });

    syncUpdateData(req, 'todolist');

    _success(res, `添加待办成功`)(req, content, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除待办
route.post('/delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await db('todo')
      .where({ id: { in: ids }, account })
      .delete();

    syncUpdateData(req, 'todolist');

    _success(res, `删除待办成功`)(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 待办状态
route.get('/state', async (req, res) => {
  try {
    let { id, state } = req.query;
    state = +state;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validationValue(state, [1, 0])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await db('todo')
      .where({ id, account })
      .update({ state, update_at: Date.now() });

    syncUpdateData(req, 'todolist');

    _success(res, state === 1 ? '标记为未完成' : '标记为已完成')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑待办
route.post('/edit', async (req, res) => {
  try {
    const { id, content } = req.body;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(content, 1, fieldLength.todoContent)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await db('todo')
      .where({ id, account })
      .update({ content, update_at: Date.now() });

    syncUpdateData(req, 'todolist');

    _success(res, '编辑待办成功')(req, content, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
