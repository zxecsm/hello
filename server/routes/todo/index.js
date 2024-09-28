const express = require('express'),
  route = express.Router();

const {
  queryData,
  updateData,
  deleteData,
  insertData,
  fillString,
  getTableRowCount,
} = require('../../utils/sqlite');

const {
  _nologin,
  _err,
  _success,
  validaString,
  paramErr,
  syncUpdateData,
  createPagingData,
  _type,
  validationValue,
} = require('../../utils/utils');
const { fieldLenght } = require('../config');

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
    let { pageNo = 1, pageSize = 40 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLenght.maxPagesize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const offset = (pageNo - 1) * pageSize;

    const total = await getTableRowCount('todo', `WHERE account = ?`, [
      account,
    ]);

    let data = [],
      undoneCount = 0;

    if (total > 0) {
      undoneCount = await getTableRowCount(
        'todo',
        `WHERE account = ? AND state = ?`,
        [account, 1]
      );

      data = await queryData(
        'todo',
        'id,content,state,update_at',
        `WHERE account = ? ORDER BY state DESC, update_at DESC LIMIT ? OFFSET ?`,
        [account, pageSize, offset]
      );
    }

    _success(res, 'ok', {
      ...createPagingData([...Array(total)], pageSize, pageNo),
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

    if (!validaString(content, 1, fieldLenght.todoContent)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await insertData('todo', [
      {
        account,
        content,
        update_at: Date.now(),
      },
    ]);

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
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await deleteData(
      'todo',
      `WHERE id IN (${fillString(ids.length)}) AND account = ?`,
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
    let { id, state } = req.query;
    state = +state;

    if (
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validationValue(state, [1, 0])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'todo',
      { state, update_at: Date.now() },
      `WHERE id = ? AND account = ?`,
      [id, account]
    );

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
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(content, 1, fieldLenght.todoContent)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'todo',
      { content, update_at: Date.now() },
      `WHERE id = ? AND account = ?`,
      [id, account]
    );

    syncUpdateData(req, 'todolist');

    _success(res, '编辑待办成功')(req, content, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

module.exports = route;
