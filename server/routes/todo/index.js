import express from 'express';

import { db } from '../../utils/sqlite.js';

import {
  _nologin,
  _err,
  _success,
  syncUpdateData,
  createPagingData,
  validate,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';
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

// 待办列表
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
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { pageNo, pageSize } = req._vdata;

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
  }
);

// 增加待办
route.post(
  '/add',
  validate(
    'body',
    V.object({
      content: V.string().trim().min(1).max(fieldLength.todoContent),
    })
  ),
  async (req, res) => {
    try {
      const { content } = req._vdata;

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
  }
);

// 删除待办
route.post(
  '/delete',
  validate(
    'body',
    V.object({
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { ids } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('todo')
        .where({ id: { in: ids }, account })
        .delete();

      syncUpdateData(req, 'todolist');

      _success(res, `删除待办成功`)(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 待办状态
route.get(
  '/state',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      state: V.number().toInt().enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const { id, state } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('todo')
        .where({ id, account })
        .update({ state, update_at: Date.now() });

      syncUpdateData(req, 'todolist');

      _success(res, state === 1 ? '标记为未完成' : '标记为已完成')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑待办
route.post(
  '/edit',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      content: V.string().trim().min(1).max(fieldLength.todoContent),
    })
  ),
  async (req, res) => {
    try {
      const { id, content } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('todo')
        .where({ id, account })
        .update({ content, update_at: Date.now() });

      syncUpdateData(req, 'todolist');

      _success(res, '编辑待办成功')(req, content, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

export default route;
