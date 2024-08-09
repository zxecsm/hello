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
  isValidDate,
  isurl,
  validationValue,
} = require('../utils/utils');

//拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});
function computerDay(start, end) {
  const total = end - start; // 总时间
  let past = Date.now() - start; // 过去
  past > total ? (past = total) : past < 0 ? (past = 0) : null;
  const percent = parseInt((past / total) * 100); // 百分比
  const remain = total - past; // 剩下
  return { total, past, remain, percent };
}
// 倒计时列表
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
    const list = (
      await queryData('count_down', '*', `WHERE account=?`, [account])
    ).map((item) => {
      const { start, end } = item;
      return {
        ...item,
        ...computerDay(start, end),
      };
    });
    const expireCount = list.filter(
      (item) => item.state === '0' && item.remain < 2 * 1000 * 60 * 60 * 24
    ).length;
    list.sort((a, b) => a.end - b.end);
    list.sort((a, b) => b.top - a.top);
    _success(res, 'ok', {
      ...createPagingData(list, pageSize, pageNo),
      expireCount,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 增加
route.post('/add', async (req, res) => {
  try {
    let { title, start, end, link = '' } = req.body;
    if (
      !validaString(title, 1, 200) ||
      !isValidDate(start) ||
      !isValidDate(end) ||
      (link && (!validaString(link, 1, 1000) || !isurl(link)))
    ) {
      paramErr(res, req);
      return;
    }
    start = new Date(start + ' 00:00:00').getTime();
    end = new Date(end + ' 00:00:00').getTime();
    if (start >= end) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const id = nanoid();
    await insertData('count_down', [
      {
        id,
        account,
        title,
        start,
        end,
        link,
        state: '0',
        top: '0',
      },
    ]);
    syncUpdateData(req, 'countlist');
    _success(res, `添加倒计时成功`)(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除
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
      'count_down',
      `WHERE id IN (${createFillString(ids.length)}) AND account=?`,
      [...ids, account]
    );
    syncUpdateData(req, 'countlist');
    _success(res, `删除倒计时成功`)(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑
route.post('/edit', async (req, res) => {
  try {
    let { id, title, start, end, link = '' } = req.body;
    const { account } = req._hello.userinfo;
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(title, 1, 200) ||
      !isValidDate(start) ||
      !isValidDate(end) ||
      (link && (!validaString(link, 1, 1000) || !isurl(link)))
    ) {
      paramErr(res, req);
      return;
    }
    start = new Date(start + ' 00:00:00').getTime();
    end = new Date(end + ' 00:00:00').getTime();
    if (start >= end) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'count_down',
      {
        title,
        start,
        end,
        link,
      },
      `WHERE id=? AND account=?`,
      [id, account]
    );
    syncUpdateData(req, 'countlist');
    _success(res, '更新倒计时成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 置顶权重
route.post('/top', async (req, res) => {
  try {
    let { id, top } = req.body;
    top = parseInt(top);
    if (isNaN(top) || top < 0 || top > 9999 || !validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await updateData('count_down', { top }, `WHERE id=? AND account=?`, [
      id,
      account,
    ]);
    syncUpdateData(req, 'countlist');
    _success(res, '修改倒计时权重成功')(req, `${id}-${top}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 状态
route.post('/state', async (req, res) => {
  try {
    let { id, state } = req.body;
    if (!validationValue(state, ['0', '1']) || !validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await updateData('count_down', { state }, `WHERE id=? AND account=?`, [
      id,
      account,
    ]);
    syncUpdateData(req, 'countlist');
    _success(res, '修改倒计时状态成功')(req, `${id}-${state}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
