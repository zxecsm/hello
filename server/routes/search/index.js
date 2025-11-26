import express from 'express';

import { db } from '../../utils/sqlite.js';

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
  isurl,
  isValidColor,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';
import { readSearchConfig, writeSearchConfig } from './search.js';
import nanoid from '../../utils/nanoid.js';

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
    _success(res, 'ok', await readSearchConfig(req._hello.userinfo.account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加搜索引擎
route.post('/add-engine', async (req, res) => {
  try {
    const { title, link, color = '' } = req.body;
    if (
      !validaString(title, 1, fieldLength.title) ||
      !validaString(link, 1, fieldLength.url) ||
      (color && !isValidColor(color)) ||
      !isurl(link) ||
      !link.includes('{{}}')
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    const item = {
      id: nanoid(),
      title,
      color,
      link,
      logo: '',
    };

    if (Array.isArray(config.searchEngineData)) {
      config.searchEngineData.push(item);
    } else {
      config.searchEngineData = [item];
    }

    await writeSearchConfig(account, config);
    syncUpdateData(req, 'searchConfig');

    _success(res, '添加搜索引擎成功')(req, `${title}-${link}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑搜索引擎
route.post('/edit-engine', async (req, res) => {
  try {
    const { title, link, color = '', id } = req.body;
    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(title, 1, fieldLength.title) ||
      !validaString(link, 1, fieldLength.url) ||
      (color && !isValidColor(color)) ||
      !isurl(link) ||
      !link.includes('{{}}')
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    if (Array.isArray(config.searchEngineData)) {
      const idx = config.searchEngineData.findIndex((s) => s.id === id);
      if (idx >= 0) {
        config.searchEngineData[idx] = {
          ...config.searchEngineData[idx],
          title,
          color,
          link,
        };
        await writeSearchConfig(account, config);
        syncUpdateData(req, 'searchConfig');
      }
    }

    _success(res, '修改搜索引擎成功')(req, `${title}-${link}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除搜索引擎
route.post('/delete-engine', async (req, res) => {
  try {
    const { id } = req.body;
    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    let log = '';
    if (Array.isArray(config.searchEngineData)) {
      config.searchEngineData = config.searchEngineData.filter((s) => {
        if (s.id === id) {
          log = `${s.title}-${s.link}`;
        }
        return s.id !== id;
      });
      await writeSearchConfig(account, config);
      syncUpdateData(req, 'searchConfig');
    }

    _success(res, '删除搜索引擎成功')(req, `${id}${log ? `-${log}` : ''}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 切换搜索引擎
route.post('/change-engine', async (req, res) => {
  try {
    const { id } = req.body;
    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    config.searchengineid = id;

    await writeSearchConfig(account, config);
    syncUpdateData(req, 'searchConfig');

    _success(res, '切换搜索引擎成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清除搜索引擎LOGO
route.post('/delete-engine-logo', async (req, res) => {
  try {
    const { id } = req.body;
    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    let log = '';
    if (Array.isArray(config.searchEngineData)) {
      const idx = config.searchEngineData.findIndex((s) => s.id === id);
      if (idx >= 0) {
        log = `${config.searchEngineData[idx].title}-${config.searchEngineData[idx].link}`;
        config.searchEngineData[idx] = {
          ...config.searchEngineData[idx],
          logo: '',
        };
        await writeSearchConfig(account, config);
        syncUpdateData(req, 'searchConfig');
      }
    }

    _success(res, '删除搜索引擎LOGO成功')(
      req,
      `${id}${log ? `-${log}` : ''}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加翻译接口
route.post('/add-translator', async (req, res) => {
  try {
    const { title, link } = req.body;
    if (
      !validaString(title, 1, fieldLength.title) ||
      !validaString(link, 1, fieldLength.url) ||
      !isurl(link) ||
      !link.includes('{{}}')
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    const item = {
      id: nanoid(),
      title,
      link,
      logo: '',
    };

    if (Array.isArray(config.translatorData)) {
      config.translatorData.push(item);
    } else {
      config.translatorData = [item];
    }

    await writeSearchConfig(account, config);
    syncUpdateData(req, 'searchConfig');

    _success(res, '添加翻译接口成功')(req, `${title}-${link}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑翻译接口
route.post('/edit-translator', async (req, res) => {
  try {
    const { title, link, id } = req.body;
    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(title, 1, fieldLength.title) ||
      !validaString(link, 1, fieldLength.url) ||
      !isurl(link) ||
      !link.includes('{{}}')
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    if (Array.isArray(config.translatorData)) {
      const idx = config.translatorData.findIndex((t) => t.id === id);
      if (idx >= 0) {
        config.translatorData[idx] = {
          ...config.translatorData[idx],
          title,
          link,
        };
        await writeSearchConfig(account, config);
        syncUpdateData(req, 'searchConfig');
      }
    }

    _success(res, '修改翻译接口成功')(req, `${title}-${link}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除翻译接口
route.post('/delete-translator', async (req, res) => {
  try {
    const { id } = req.body;
    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    let log = '';
    if (Array.isArray(config.translatorData)) {
      config.translatorData = config.translatorData.filter((t) => {
        if (t.id === id) {
          log = `${t.title}-${t.link}`;
        }
        return t.id !== id;
      });
      await writeSearchConfig(account, config);
      syncUpdateData(req, 'searchConfig');
    }

    _success(res, '删除翻译接口成功')(req, `${id}${log ? `-${log}` : ''}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 切换翻译接口
route.post('/change-translator', async (req, res) => {
  try {
    const { id } = req.body;
    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    config.translatorid = id;

    await writeSearchConfig(account, config);
    syncUpdateData(req, 'searchConfig');

    _success(res, '切换翻译接口成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清除翻译接口LOGO
route.post('/delete-translator-logo', async (req, res) => {
  try {
    const { id } = req.body;
    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;
    const config = await readSearchConfig(account);

    let log = '';
    if (Array.isArray(config.translatorData)) {
      const idx = config.translatorData.findIndex((t) => t.id === id);
      if (idx >= 0) {
        log = `${config.translatorData[idx].title}-${config.translatorData[idx].link}`;
        config.translatorData[idx] = {
          ...config.translatorData[idx],
          logo: '',
        };
        await writeSearchConfig(account, config);
        syncUpdateData(req, 'searchConfig');
      }
    }

    _success(res, '删除翻译接口LOGO成功')(
      req,
      `${id}${log ? `-${log}` : ''}`,
      1
    );
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

    const historydb = db('history').where({ account, state: 1 });

    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);
      curSplit[0] = { value: curSplit[0], weight: 10 };
      historydb.search(curSplit, ['content'], { sort: true });
    } else {
      historydb.orderBy('serial', 'desc');
    }

    const total = await historydb.count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];
    if (total > 0) {
      data = await historydb.select('id,content').page(pageSize, offset).find();
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
    await db('history').where({ account, content }).delete();

    await db('history').insert({
      id: nanoid(),
      create_at: Date.now(),
      content,
      account,
    });

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
      const list = await db('history')
        .where({ account, state: 1 })
        .select('id,content')
        .orderBy('serial', 'desc')
        .limit(10)
        .find();

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

    const bmkGroup = await db('bmk_group')
      .select('id,title')
      .where({
        account,
        state: 1,
      })
      .find();

    bmkGroup.push({ id: 'home', title: '主页' });

    const splitWord = getSplitWord(word);

    const curSplit = splitWord.slice(0, 10);
    curSplit[0] = { value: curSplit[0], weight: 10 };
    const historyList = await db('history')
      .select('id,content')
      .where({ account, state: 1 })
      .search(curSplit, ['content'], { sort: true })
      .limit(100)
      .find();
    const bmkList = await db('bmk')
      .select('id,title,link,des,group_id')
      .where({ account, state: 1 })
      .search(curSplit, ['title', 'link', 'des'], { sort: true })
      .limit(100)
      .find();
    const noteList = await db('note')
      .select('id,title')
      .where({ account, state: 1 })
      .search(curSplit, ['title'], { sort: true })
      .limit(100)
      .find();

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

    await db('history')
      .where({ id: { in: ids }, account, state: 1 })
      .update({
        state: 0,
      });

    syncUpdateData(req, 'history');
    syncUpdateData(req, 'trash');

    _success(res, '删除搜索历史成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
