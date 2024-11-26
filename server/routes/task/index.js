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
const route = express.Router();

// 验证登录态
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 获取任务信息
route.get('/info', async (req, res) => {
  try {
    const { key } = req.query;
    const { account } = req._hello.userinfo;

    if (
      !validaString(key, 1, fieldLenght.id * 2, 1) ||
      !key.startsWith(`${account}_`)
    ) {
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
    const { key } = req.body;
    const { account } = req._hello.userinfo;

    if (
      !validaString(key, 1, fieldLenght.id * 2, 1) ||
      !key.startsWith(`${account}_`)
    ) {
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
    const { account } = req._hello.userinfo;

    _success(res, 'ok', taskState.getTaskList(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
