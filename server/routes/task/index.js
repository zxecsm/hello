import express from 'express';
import { _err, _nologin, _success, paramErr, validate } from '../../utils/utils.js';
import { fieldLength } from '../config.js';
import taskState from '../../utils/taskState.js';
import { validShareState } from '../user/user.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

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
  async (req, res) => {
    try {
      const { key, token } = req[kValidate];

      let {
        temid,
        userinfo: { account },
      } = req[kHello];

      try {
        temid = await V.parse(
          temid,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'temid',
        );
      } catch (error) {
        paramErr(res, req, error, { temid });
        return;
      }

      if (!token && !account) {
        _nologin(res);
        return;
      }

      if (token) {
        const share = await validShareState(token, 'file');

        if (share.state === 0) {
          _err(res, share.text)(req);
          return;
        }

        account = temid;
      }

      if (!key.startsWith(`${account}_`)) {
        paramErr(res, req, `key 必须 ${account}_ 开头`, 'body');
        return;
      }

      const task = taskState.get(key);
      if (task && task.state === 1) {
        taskState.delete(key);
      }

      _success(res, 'ok', { text: task ? task.text : '', state: task ? task.state : -1 });
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { key, token } = req[kValidate];

      let {
        temid,
        userinfo: { account },
      } = req[kHello];

      try {
        temid = await V.parse(
          temid,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'temid',
        );
      } catch (error) {
        paramErr(res, req, error, { temid });
        return;
      }

      if (!token && !account) {
        _nologin(res);
        return;
      }

      if (token) {
        const share = await validShareState(token, 'file');

        if (share.state === 0) {
          _err(res, share.text)(req);
          return;
        }

        account = temid;
      }

      if (!key.startsWith(`${account}_`)) {
        paramErr(res, req, `key 必须 ${account}_ 开头`, 'body');
        return;
      }

      const task = taskState.get(key);
      if (task) {
        task.controller.abort();
        taskState.delete(key);
      }

      _success(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 获取任务列表
route.post(
  '/list',
  validate(
    'body',
    V.object({
      token: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  async (req, res) => {
    try {
      const { token } = req[kValidate];

      let {
        temid,
        userinfo: { account },
      } = req[kHello];

      try {
        temid = await V.parse(
          temid,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'temid',
        );
      } catch (error) {
        paramErr(res, req, error, { temid });
        return;
      }

      if (!token && !account) {
        _nologin(res);
        return;
      }

      if (token) {
        const share = await validShareState(token, 'file');

        if (share.state === 0) {
          _err(res, share.text)(req);
          return;
        }

        account = temid;
      }

      _success(res, 'ok', taskState.getTaskKeys(account));
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

export default route;
