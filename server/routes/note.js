const express = require('express'),
  route = express.Router();
const {
  insertData,
  updateData,
  queryData,
  runSqlite,
  deleteData,
} = require('../utils/sqlite');
const {
  _success,
  _nologin,
  _err,
  nanoid,
  validaString,
  _type,
  validationValue,
  paramErr,
  getWordContent,
  getWordCount,
  createFillString,
  syncUpdateData,
  createPagingData,
  isValidDate,
  getSplitWord,
} = require('../utils/utils');
// 读取笔记
route.get('/read', async (req, res) => {
  try {
    const { v: id } = req.query;
    if (!validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const note = (await queryData('getnote', '*', `WHERE id=?`, [id]))[0];
    if (note) {
      let {
        username,
        share,
        name,
        data,
        account: acc,
        time,
        utime,
        visit_count,
        state,
        logo,
        email,
        category,
      } = note;
      await runSqlite(`update note set visit_count=visit_count+1 where id=?`, [
        id,
      ]);
      if ((share === 'y' && state === '0') || acc === account) {
        let own = 'n';
        if (note.account === account) {
          own = 'y';
        }
        if (account && own == 'n') {
          const fList = await queryData('friends', '*', `WHERE account=?`, [
            account,
          ]);
          const f = fList.find((item) => item.friend == acc);
          if (f) {
            username = f.des || username;
          }
        }
        _success(res, '读取笔记成功', {
          username,
          name,
          data,
          visit_count,
          account: acc,
          time,
          utime,
          own,
          logo,
          email,
          category,
        })(req, id, 1);
      } else {
        _err(res, '笔记未公开')(req, id, 1);
      }
    } else {
      _err(res, '笔记不存在')(req, id, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 搜索笔记
route.get('/search', async (req, res) => {
  try {
    let {
      acc = '',
      word = '',
      category = [],
      pageNo = 1,
      pageSize = 20,
    } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      !validaString(acc, 0, 50, 1) ||
      !validaString(word, 0, 100) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 200 ||
      !_type.isArray(category) ||
      !category.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    if (!acc && !account) {
      _nologin(res);
      return;
    }
    let list = await queryData(
      'note',
      `${word ? '*' : 'name,time,utime,id,share,visit_count,weight,category'}`,
      `WHERE state=? AND account = ?`,
      ['0', acc || account]
    );
    if (acc && acc !== account) {
      list = list.filter((item) => item.share === 'y');
    }
    if (category.length > 0) {
      list = list.filter((item) =>
        category.some((y) => item.category.includes(y))
      );
    }
    list.sort((a, b) => b.time - a.time);
    list.sort((a, b) => b.weight - a.weight);
    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);
      const arr = [];
      list.forEach((item) => {
        let {
          name,
          data,
          id,
          time,
          utime,
          share,
          visit_count,
          weight,
          category,
        } = item;
        data = data.replace(/[\n\r]/g, '');
        const sNum =
          getWordCount(splitWord, data) + getWordCount(splitWord, name);
        if (sNum > 0) {
          let con = [];
          const wc = getWordContent(splitWord, data);
          let idx = wc.findIndex(
            (item) => item.value.toLowerCase() == splitWord[0].toLowerCase()
          );
          let start = 0,
            end = 0;
          if (idx >= 0) {
            if (idx > 15) {
              start = idx - 15;
              end = idx + 15;
            } else {
              end = 30;
            }
          } else {
            end = 30;
          }
          con = wc.slice(start, end);
          arr.push({
            id,
            share,
            name,
            visit_count,
            con,
            weight,
            sNum,
            category,
            time,
            utime,
          });
        }
      });
      if (arr.length > 0) {
        arr.sort((a, b) => {
          return b.sNum - a.sNum;
        });
      }
      list = arr;
    }
    _success(res, 'ok', {
      ...createPagingData(list, pageSize, pageNo),
      splitWord,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 获取分类
route.get('/category', async (req, res) => {
  try {
    const { acc = '' } = req.query;
    if (!validaString(acc, 0, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const list = await queryData('note_category', '*', `WHERE account=?`, [
      acc || account,
    ]);
    list.reverse();
    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});
//拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});
// 笔记状态
route.post('/state', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { ids, flag = 'n' } = req.body;
    if (
      !_type.isArray(ids) ||
      !validationValue(flag, ['n', 'y']) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'note',
      { share: flag },
      `WHERE id IN (${createFillString(ids.length)}) AND account=? AND state=?`,
      [...ids, account, '0']
    );
    syncUpdateData(req, 'note');
    _success(res, `${flag == 'n' ? '锁定' : '公开'}笔记成功`)(
      req,
      ids.length,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除笔记
route.post('/delete', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { ids } = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    ids = ids.filter((item) => !['about', 'tips'].includes(item));
    await updateData(
      'note',
      { state: '1' },
      `WHERE id IN (${createFillString(ids.length)}) AND account=? AND state=?`,
      [...ids, account, '0']
    );
    syncUpdateData(req, 'note');
    syncUpdateData(req, 'trash');
    _success(res, '删除笔记成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑笔记
route.post('/edit', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { id, name, data = '' } = req.body;
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(name, 1, 100) ||
      !validaString(data)
    ) {
      paramErr(res, req);
      return;
    }
    const time = Date.now();
    const change = await updateData(
      'note',
      {
        name,
        data,
        utime: time,
      },
      `WHERE id=? AND account=?`,
      [id, account]
    );
    if (change.changes == 0) {
      id = nanoid();
      await insertData('note', [
        {
          id,
          name,
          data,
          time,
          share: 'n',
          account,
          visit_count: '0',
          utime: time,
          state: '0',
        },
      ]);
      syncUpdateData(req, 'note');
      _success(res, '新增笔记成功', { id })(req, id, 1);
    } else {
      syncUpdateData(req, 'note', id);
      syncUpdateData(req, 'trash');
      _success(res, '更新笔记成功')(req, id, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
route.post('/edit-info', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { id, name, time, utime, visit_count } = req.body;
    visit_count = parseInt(visit_count);
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(name, 1, 100) ||
      !isValidDate(time) ||
      !isValidDate(utime) ||
      isNaN(visit_count) ||
      visit_count < 0
    ) {
      paramErr(res, req);
      return;
    }
    time = new Date(time + ' 00:00:00').getTime();
    utime = new Date(utime + ' 00:00:00').getTime();
    if (time > utime) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'note',
      {
        name,
        time,
        utime,
        visit_count,
      },
      `WHERE id=? AND account=?`,
      [id, account]
    );
    syncUpdateData(req, 'note', id);
    syncUpdateData(req, 'trash');
    _success(res, '更新笔记信息成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 置顶权重
route.post('/weight', async (req, res) => {
  try {
    let { id, weight } = req.body;
    weight = parseInt(weight);
    if (
      isNaN(weight) ||
      weight < 0 ||
      weight > 9999 ||
      !validaString(id, 1, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await updateData('note', { weight }, `WHERE id=? AND account=?`, [
      id,
      account,
    ]);
    syncUpdateData(req, 'note');
    _success(res, '设置笔记权重成功')(req, `${id}-${weight}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑笔记分类
route.post('/set-category', async (req, res) => {
  try {
    const { id, category } = req.body;
    if (
      !validaString(id, 1, 50, 1) ||
      !_type.isArray(category) ||
      category.length > 10 ||
      !category.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await updateData(
      'note',
      { category: category.join('-') },
      `WHERE account=? AND id=?`,
      [account, id]
    );
    syncUpdateData(req, 'note');
    _success(res, '更新分类成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑分类
route.post('/edit-category', async (req, res) => {
  try {
    const { title, id } = req.body;
    if (!validaString(title, 1, 30) || !validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await updateData('note_category', { title }, `WHERE id=? AND account=?`, [
      id,
      account,
    ]);
    syncUpdateData(req, 'category');
    _success(res, '编辑分类标题成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 添加分类
route.post('/add-category', async (req, res) => {
  try {
    const { title } = req.body;
    if (!validaString(title, 1, 30)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const id = nanoid();
    await insertData('note_category', [{ id, title, account }]);
    syncUpdateData(req, 'category');
    _success(res, '添加分类成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除分类
route.get('/delete-category', async (req, res) => {
  try {
    const { id } = req.query;
    if (!validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await deleteData('note_category', `WHERE id=? AND account=?`, [
      id,
      account,
    ]);
    syncUpdateData(req, 'category');
    _success(res, '删除分类成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
