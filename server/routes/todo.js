const express = require('express'),
  route = express.Router();
const {
  queryData,
  updateData,
  deleteData,
  insertData,
} = require('../utils/sqlite');
const {
  _nologin,
  _err,
  _success,
  nanoid,
  validaString,
  paramErr,
  syncUpdateData,
  createPagingData,
  _type,
  createFillString,
} = require('../utils/utils');

//拦截器
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
    const { account } = req._hello.userinfo;
    let { pageNo = 1, pageSize = 40 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 200
    ) {
      paramErr(res, req);
      return;
    }
    const list = await queryData('todo', '*', `WHERE account=?`, [account]);
    const undoneCount = list.filter((item) => item.state === '0').length;
    list.sort((a, b) => {
      return b.time - a.time;
    });
    list.sort((a, b) => a.state - b.state);
    _success(res, 'ok', {
      ...createPagingData(list, pageSize, pageNo),
      undoneCount,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 增加待办
route.post('/add', async (req, res) => {
  try {
    const { data } = req.body;
    if (!validaString(data, 1, 500)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const id = nanoid();
    await insertData('todo', [
      {
        id,
        account,
        data,
        time: Date.now(),
        state: '0',
      },
    ]);
    syncUpdateData(req, 'todolist');
    _success(res, `添加待办成功`)(req, id, 1);
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
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await deleteData(
      'todo',
      `WHERE id IN (${createFillString(ids.length)}) AND account=?`,
      [...ids, account]
    );
    syncUpdateData(req, 'todolist');
    _success(res, `删除待办成功`)(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 待办状态
route.get('/state', async (req, res) => {
  try {
    const { id, flag = '' } = req.query;
    const { account } = req._hello.userinfo;
    if (!validaString(id, 1, 50, 1) || !validaString(flag)) {
      paramErr(res, req);
      return;
    }
    let obj = {};
    if (flag) {
      obj = {
        state: '0',
        time: Date.now(),
      };
    } else {
      obj = { state: '1' };
    }
    await updateData('todo', obj, `WHERE id=? AND account=?`, [id, account]);
    syncUpdateData(req, 'todolist');
    _success(res, flag ? '标记为未完成' : '标记为已完成')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑待办
route.post('/edit', async (req, res) => {
  try {
    const { id, data } = req.body;
    const { account } = req._hello.userinfo;
    if (!validaString(id, 1, 50, 1) || !validaString(data, 1, 500)) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'todo',
      { data, time: Date.now() },
      `WHERE id=? AND account=?`,
      [id, account]
    );
    syncUpdateData(req, 'todolist');
    _success(res, '编辑待办成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
