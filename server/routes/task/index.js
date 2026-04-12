import express from 'express';
import { fieldLength } from '../config.js';
import taskState from '../../utils/taskState.js';
import { validShareState } from '../user/user.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 获取任务信息
route.post(
  '/info',
  validate(
    'body',
    V.object({
      key: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id * 2)
        .alphanumeric(),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { key, token } = res.locals.ctx;

    let {
      temid,
      userinfo: { account },
    } = res.locals.hello;

    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    if (!token && !account) {
      return resp.unauthorized(res)();
    }

    let accFlag = '';

    if (token) {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        return resp.forbidden(res, share.text)();
      }

      accFlag = share.data.id + account || temid;
    } else {
      accFlag = account;
    }

    if (!key.startsWith(`${accFlag}_`)) {
      return resp.badRequest(res)(`key 必须 ${accFlag}_ 开头`, 1);
    }

    const task = taskState.get(key);
    if (task && task.state === 1) {
      taskState.delete(key);
    }

    resp.success(res, 'ok', { text: task ? task.text : '', state: task ? task.state : -1 })();
  }),
);

// 取消任务
route.post(
  '/cancel',
  validate(
    'body',
    V.object({
      key: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id * 2)
        .alphanumeric(),
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { key, token } = res.locals.ctx;

    let {
      temid,
      userinfo: { account },
    } = res.locals.hello;

    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    if (!token && !account) {
      return resp.unauthorized(res)();
    }

    let accFlag = '';

    if (token) {
      const share = await validShareState(token, 'file');

      if (share.state === 0) {
        return resp.forbidden(res, share.text)();
      }
      accFlag = share.data.id + account || temid;
    } else {
      accFlag = account;
    }

    if (!key.startsWith(`${accFlag}_`)) {
      return resp.badRequest(res)(`key 必须 ${accFlag}_ 开头`, 1);
    }

    const task = taskState.get(key);
    if (task) {
      task.controller.abort();
      taskState.delete(key);
    }

    resp.success(res)();
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

// 获取任务列表
route.post(
  '/list',
  asyncHandler(async (_, res) => {
    resp.success(res, 'ok', taskState.getTaskKeys(res.locals.hello.userinfo.account))();
  }),
);

export default route;
