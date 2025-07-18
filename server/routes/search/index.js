import express from 'express';

import {
  insertData,
  updateData,
  deleteData,
  queryData,
  fillString,
  createSearchSql,
  createScoreSql,
  getTableRowCount,
} from '../../utils/sqlite.js';

import {
  _success,
  _nologin,
  _err,
  validaString,
  _type,
  paramErr,
  getWordCount,
  getSplitWord,
  syncUpdateData,
  createPagingData,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';
import { getSearchConfig } from './search.js';

const route = express.Router();

// 验证登录态
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

    if (!validaString(word, 1, fieldLength.searchWord)) {
      paramErr(res, req);
      return;
    }

    _success(res, '获取分词成功', getSplitWord(word))(req, word, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 搜索历史
route.get('/history-list', async (req, res) => {
  try {
    let { word = '', pageNo = 1, pageSize = 80 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      !validaString(word, 0, fieldLength.searchWord) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLength.maxPagesize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let where = `WHERE account = ? AND state = ?`;

    const valArr = [account, 1];

    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);

      const searchSql = createSearchSql(curSplit, ['content']);

      const scoreSql = createScoreSql(curSplit, ['content']);

      where += ` AND (${searchSql.sql}) ${scoreSql.sql}`;

      valArr.push(...searchSql.valArr, ...scoreSql.valArr);
    } else {
      where += ` ORDER BY create_at DESC`;
    }

    const total = await getTableRowCount('history', where, valArr);

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];
    if (total > 0) {
      where += ` LIMIT ? OFFSET ?`;

      valArr.push(pageSize, offset);

      data = await queryData('history', 'id,content', where, valArr);
    }

    _success(res, 'ok', {
      ...result,
      data,
      splitWord,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 保存搜索历史
route.post('/save', async (req, res) => {
  try {
    const { content } = req.body;

    if (!validaString(content, 1, fieldLength.searchHistory)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    // 删除重复历史记录
    await deleteData('history', `WHERE account = ? AND content = ?`, [
      account,
      content,
    ]);

    await insertData('history', [
      {
        content,
        account,
      },
    ]);

    syncUpdateData(req, 'history');

    _success(res, '保存搜索记录成功')(req, content, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 搜索 历史、笔记、书签
route.get('/list', async (req, res) => {
  try {
    const { word = '' } = req.query;

    if (!validaString(word, 0, fieldLength.searchWord)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!word) {
      // 没有输入返回历史记录最新10条
      const list = await queryData(
        'history',
        'id,content',
        `WHERE state = ? AND account = ? ORDER BY create_at DESC LIMIT ?`,
        [1, account, 10]
      );

      _success(res, 'ok', {
        list: list.map((item) => {
          return {
            ...item,
            type: 'ss',
          };
        }),
        splitWord: [],
      });
      return;
    }

    const bmkGroup = await queryData(
      'bmk_group',
      'id,title',
      `WHERE state = ? AND account = ?`,
      [1, account]
    );

    bmkGroup.push({ id: 'home', title: '主页' });

    const splitWord = getSplitWord(word);

    const curSplit = splitWord.slice(0, 10);

    let historyWhere = `WHERE state = ? AND account = ?`,
      bmkWhere = historyWhere,
      noteWhere = historyWhere;

    const hValArr = [1, account],
      bValArr = [1, account],
      nValArr = [1, account];

    // 关键词搜索
    const hSearchSql = createSearchSql(curSplit, ['content']);
    const bSearchSql = createSearchSql(curSplit, ['title', 'link', 'des']);
    const nSearchSql = createSearchSql(curSplit, ['title']);

    // 根据关键词排序
    const hScoreSql = createScoreSql(curSplit, ['content']);
    const bScoreSql = createScoreSql(curSplit, ['title', 'link', 'des']);
    const nScoreSql = createScoreSql(curSplit, ['title']);

    historyWhere += ` AND (${hSearchSql.sql}) ${hScoreSql.sql} LIMIT 100`;
    hValArr.push(...hSearchSql.valArr, ...hScoreSql.valArr);

    bmkWhere += ` AND (${bSearchSql.sql}) ${bScoreSql.sql} LIMIT 100`;
    bValArr.push(...bSearchSql.valArr, ...bScoreSql.valArr);

    noteWhere += ` AND (${nSearchSql.sql}) ${nScoreSql.sql} LIMIT 100`;
    nValArr.push(...nSearchSql.valArr, ...nScoreSql.valArr);

    const historyList = await queryData(
      'history',
      'id,content',
      historyWhere,
      hValArr
    );

    const bmkList = await queryData(
      'bmk',
      'id,title,link,des,group_id',
      bmkWhere,
      bValArr
    );

    const noteList = await queryData('note', 'id,title', noteWhere, nValArr);

    const list = [];
    historyList.forEach((h) => {
      const sNum = getWordCount(splitWord, h.content);
      if (sNum > 0) {
        list.push({ ...h, type: 'ss', sNum });
      }
    });

    noteList.forEach((item) => {
      const sNum = getWordCount(splitWord, item.title);
      if (sNum > 0) {
        list.push({ ...item, type: 'note', sNum });
      }
    });

    const groupObj = {};
    bmkGroup.forEach((item) => {
      groupObj[item.id] = item;
    });

    // 添加分组信息
    bmkList.forEach((item) => {
      const { title, link, des, group_id, id } = item,
        n = `${title}${link}${des}`;

      const groupInfo = groupObj[group_id];

      if (!groupInfo) return;

      const sNum = getWordCount(splitWord, n);

      if (sNum > 0) {
        list.push({
          id,
          title,
          link,
          des,
          type: 'bmk',
          sNum,
          group_title: groupInfo.title,
        });
      }
    });

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
    const { ids } = req.body;

    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'history',
      { state: 0 },
      `WHERE id IN (${fillString(ids.length)}) AND account = ? AND state = ?`,
      [...ids, account, 1]
    );

    syncUpdateData(req, 'history');
    syncUpdateData(req, 'trash');

    _success(res, '删除搜索历史成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
