import express from 'express';

import { db } from '../../utils/sqlite.js';

import { syncUpdateData, createPagingData } from '../../utils/utils.js';

import { fieldLength } from '../config.js';
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

// 待办列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(40).min(1).max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { pageNo, pageSize } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

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

    resp.success(res, 'ok', {
      ...result,
      data,
      undoneCount,
    })();
  }),
);

// 增加待办
route.post(
  '/add',
  validate(
    'body',
    V.object({
      content: V.string().trim().min(1).max(fieldLength.todoContent),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { content } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const create_at = Date.now();
    await db('todo').insert({
      id: nanoid(),
      create_at,
      account,
      content,
      update_at: create_at,
    });

    syncUpdateData(res, 'todolist');

    resp.success(res, `添加待办成功`)();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('todo')
      .where({ id: { in: ids }, account })
      .delete();

    syncUpdateData(res, 'todolist');

    resp.success(res, `删除待办成功`)();
  }),
);

// 待办状态
route.get(
  '/state',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      state: V.number().toInt().enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, state } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('todo').where({ id, account }).update({ state, update_at: Date.now() });

    syncUpdateData(res, 'todolist');

    resp.success(res, state === 1 ? '标记为未完成' : '标记为已完成')();
  }),
);

// 编辑待办
route.post(
  '/edit',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      content: V.string().trim().min(1).max(fieldLength.todoContent),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, content } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('todo').where({ id, account }).update({ content, update_at: Date.now() });

    syncUpdateData(res, 'todolist');

    resp.success(res, '编辑待办成功')();
  }),
);

export default route;
