import express from 'express';
import {
  _err,
  _nologin,
  _success,
  paramErr,
  validaString,
} from '../../utils/utils.js';
import { fieldLenght } from '../config.js';
import taskState from '../../utils/taskState.js';
import { validShareState } from '../user/user.js';
const route = express.Router();

// 获取任务信息
route.get('/info', async (req, res) => {
  try {
    const { key, token = '' } = req.query;

    let {
      temid,
      userinfo: { account },
    } = req._hello;

    if (
      !validaString(key, 1, fieldLenght.id * 2, 1) ||
      !validaString(token, 0, fieldLenght.url) ||
      !validaString(temid, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
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
      paramErr(res, req);
      return;
    }

    const task = taskState.get(key);

    _success(res, 'ok', { text: task ? task.text : '' });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 取消任务
route.post('/cancel', async (req, res) => {
  try {
    const { key, token = '' } = req.body;

    let {
      temid,
      userinfo: { account },
    } = req._hello;

    if (
      !validaString(key, 1, fieldLenght.id * 2, 1) ||
      !validaString(token, 0, fieldLenght.url) ||
      !validaString(temid, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
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
      paramErr(res, req);
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
});

// 获取任务列表
route.get('/list', async (req, res) => {
  try {
    const { token = '' } = req.query;

    let {
      temid,
      userinfo: { account },
    } = req._hello;

    if (
      !validaString(token, 0, fieldLenght.url) ||
      !validaString(temid, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
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

    _success(res, 'ok', taskState.getTaskList(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
