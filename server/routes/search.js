const express = require('express'),
  route = express.Router();
const {
  insertData,
  updateData,
  deleteData,
  queryData,
} = require('../utils/sqlite');
const {
  _success,
  _nologin,
  _err,
  nanoid,
  validaString,
  _type,
  paramErr,
  getWordCount,
  getSplitWord,
  createFillString,
  syncUpdateData,
  createPagingData,
  getSearchConfig,
} = require('../utils/utils');

//拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});
// 配置
route.get('/config', async (req, res) => {
  try {
    _success(res, 'ok', await getSearchConfig());
  } catch (error) {
    _err(res)(req, error);
  }
});
// 分词
route.get('/split-word', async (req, res) => {
  try {
    const { word } = req.query;
    if (!validaString(word, 1, 100)) {
      paramErr(res, req);
      return;
    }
    _success(res, '获取分词成功', getSplitWord(word))(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 搜索历史
route.get('/history-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { word = '', pageNo = 1, pageSize = 80 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      !validaString(word, 0, 100) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 200
    ) {
      paramErr(res, req);
      return;
    }
    let list = await queryData('history', '*', `WHERE state=? AND account=?`, [
      '0',
      account,
    ]);
    list.reverse();
    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);
      const sArr = [];
      list.forEach((v) => {
        const { data } = v;
        const flag = getWordCount(splitWord, data);
        if (flag > 0) {
          sArr.push({
            ...v,
            flag,
          });
        }
      });
      if (sArr.length > 0) {
        sArr.sort((a, b) => {
          return b.flag - a.flag;
        });
      }
      list = sArr;
    }
    list = list.map((item) => {
      delete item.state;
      delete item.flag;
      return item;
    });
    _success(res, 'ok', {
      ...createPagingData(list, pageSize, pageNo),
      splitWord,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 保存搜索历史
route.post('/save', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { data } = req.body;
    if (!validaString(data, 1, 100)) {
      paramErr(res, req);
      return;
    }
    await deleteData('history', `WHERE account=? AND data=?`, [account, data]);
    const id = nanoid();
    await insertData('history', [
      {
        id,
        data,
        account,
        state: '0',
      },
    ]);
    syncUpdateData(req, 'history');
    _success(res, '保存搜索记录成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
function sortSliceRes(list) {
  return list
    .sort((a, b) => {
      return b.sNum - a.sNum;
    })
    .slice(0, 100);
}
// 搜索 历史、笔记、书签、笔记、音乐
route.get('/list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { word = '' } = req.query;
    if (!validaString(word, 0, 100)) {
      paramErr(res, req);
      return;
    }
    const hList = await queryData(
      'history',
      'id,data',
      `WHERE state=? AND account=?`,
      ['0', account]
    ); //搜索历史
    hList.reverse();
    if (!word) {
      _success(res, 'ok', {
        list: hList.slice(0, 10).map((item) => {
          return {
            ...item,
            type: 'ss',
          };
        }),
        splitWord: [],
      });
      return;
    }
    const splitWord = getSplitWord(word);
    const list = [],
      noteList = await queryData(
        'note',
        'id,name',
        `WHERE state=? AND account=?`,
        ['0', account]
      ), //笔记
      bmkList = await queryData(
        'bookmk',
        'name,link,des,id,listid',
        `WHERE state=? AND account=?`,
        ['0', account]
      ),
      booklist = await queryData(
        'booklist',
        '*',
        `WHERE state=? AND account=?`,
        ['0', account]
      ),
      musicList = await queryData('musics', '*'),
      userList = await queryData('user', 'username,account', `WHERE state=?`, [
        '0',
      ]),
      farr = await queryData('friends', '*', `WHERE account=?`, [account]);
    booklist.push({ id: 'home' });
    musicList.reverse();
    noteList.reverse();
    bmkList.reverse();
    userList.reverse();
    let temList = [];
    hList.forEach((v) => {
      //包含搜索词的历史记录
      const { data } = v;
      const sNum = getWordCount(splitWord, data);
      if (sNum > 0) {
        temList.push({ ...v, type: 'ss', sNum });
      }
    });
    list.push(...sortSliceRes(temList));
    temList = [];
    userList.forEach((v) => {
      const { username, account: acc } = v;
      let des = '';
      const f = farr.find((item) => item.friend == acc);
      if (f) {
        des = f.des;
      }
      const sNum = getWordCount(splitWord, username + (des || ''));
      if (sNum > 0) {
        temList.push({
          ...v,
          id: acc,
          type: 'user',
          des,
          sNum,
        });
      }
    });
    list.push(...sortSliceRes(temList));
    temList = [];
    noteList.forEach((item) => {
      //笔记名包含搜索词的笔记
      const { name } = item;
      const sNum = getWordCount(splitWord, name);
      if (sNum > 0) {
        temList.push({ ...item, type: 'note', sNum });
      }
    });
    list.push(...sortSliceRes(temList));
    temList = [];
    const bookListObj = {};
    booklist.forEach((item) => {
      bookListObj[item.id] = item;
    });
    bmkList.forEach((item) => {
      //包含搜索词的书签
      const { name, link, des, listid } = item,
        n = `${name}${link}${des || ''}`;
      const group = bookListObj[listid];
      const sNum = getWordCount(splitWord, n);
      if (sNum > 0) {
        temList.push({
          ...item,
          type: 'bmk',
          sNum,
          group,
        });
      }
    });
    list.push(...sortSliceRes(temList));
    temList = [];
    musicList.forEach((item) => {
      const { title, artist } = item,
        n = `${artist}${title}`;
      const sNum = getWordCount(splitWord, n);
      if (sNum > 0) {
        temList.push({
          ...item,
          type: 'music',
          sNum,
        });
      }
    });
    list.push(...sortSliceRes(temList));
    list.sort((a, b) => {
      return b.sNum - a.sNum;
    });
    _success(res, 'ok', { list, splitWord });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除历史记录
route.post('/delete', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
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
    await updateData(
      'history',
      { state: '1' },
      `WHERE id IN (${createFillString(ids.length)}) AND account=? AND state=?`,
      [...ids, account, '0']
    );
    syncUpdateData(req, 'history');
    syncUpdateData(req, 'trash');
    _success(res, '删除搜索历史成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
