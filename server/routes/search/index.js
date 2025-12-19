import express from 'express';

import { db } from '../../utils/sqlite.js';

import {
  _success,
  _nologin,
  _err,
  getWordCount,
  getSplitWord,
  syncUpdateData,
  createPagingData,
  isValidColor,
  validate,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';
import { readSearchConfig, writeSearchConfig } from './search.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 配置
route.get('/config', async (req, res) => {
  try {
    _success(res, 'ok', await readSearchConfig(req[kHello].userinfo.account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加搜索引擎
route.post(
  '/add-engine',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      link: V.string()
        .trim()
        .min(1)
        .max(fieldLength.url)
        .httpUrl()
        .custom((v) => v.includes('{{}}'), '必须包含{{}}'),
      color: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom((v) => (v ? isValidColor(v) : true), '必须 #XXXXXX 格式'),
    })
  ),
  async (req, res) => {
    try {
      const { title, link, color } = req[kValidate];
      const { account } = req[kHello].userinfo;
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
  }
);

// 编辑搜索引擎
route.post(
  '/edit-engine',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      link: V.string()
        .trim()
        .min(1)
        .max(fieldLength.url)
        .httpUrl()
        .custom((v) => v.includes('{{}}'), '必须包含{{}}'),
      color: V.string()
        .trim()
        .default('')
        .custom((v) => (v ? isValidColor(v) : true), '必须 #XXXXXX 格式'),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { title, link, color, id } = req[kValidate];
      const { account } = req[kHello].userinfo;
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
  }
);

// 删除搜索引擎
route.post(
  '/delete-engine',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];
      const { account } = req[kHello].userinfo;
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
  }
);

// 切换搜索引擎
route.post(
  '/change-engine',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const config = await readSearchConfig(account);

      config.searchengineid = id;

      await writeSearchConfig(account, config);
      syncUpdateData(req, 'searchConfig');

      _success(res, '切换搜索引擎成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 清除搜索引擎LOGO
route.post(
  '/delete-engine-logo',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];
      const { account } = req[kHello].userinfo;
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
  }
);

// 添加翻译接口
route.post(
  '/add-translator',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      link: V.string()
        .trim()
        .min(1)
        .max(fieldLength.url)
        .httpUrl()
        .custom((v) => v.includes('{{}}'), '必须包含{{}}'),
    })
  ),
  async (req, res) => {
    try {
      const { title, link } = req[kValidate];

      const { account } = req[kHello].userinfo;
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
  }
);

// 编辑翻译接口
route.post(
  '/edit-translator',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      link: V.string()
        .trim()
        .min(1)
        .max(fieldLength.url)
        .httpUrl()
        .custom((v) => v.includes('{{}}'), '必须包含{{}}'),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { title, link, id } = req[kValidate];

      const { account } = req[kHello].userinfo;
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
  }
);

// 删除翻译接口
route.post(
  '/delete-translator',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;
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
  }
);

// 切换翻译接口
route.post(
  '/change-translator',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const config = await readSearchConfig(account);

      config.translatorid = id;

      await writeSearchConfig(account, config);
      syncUpdateData(req, 'searchConfig');

      _success(res, '切换翻译接口成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 清除翻译接口LOGO
route.post(
  '/delete-translator-logo',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;
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
  }
);

// 分词
route.get(
  '/split-word',
  validate(
    'query',
    V.object({
      word: V.string().trim().min(1).max(fieldLength.searchWord),
    })
  ),
  async (req, res) => {
    try {
      const { word } = req[kValidate];

      _success(res, '获取分词成功', getSplitWord(word))(req, word, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 搜索历史
route.get(
  '/history-list',
  validate(
    'query',
    V.object({
      word: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(80)
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { word, pageNo, pageSize } = req[kValidate];

      const { account } = req[kHello].userinfo;

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
        data = await historydb
          .select('id,content')
          .page(pageSize, offset)
          .find();
      }

      _success(res, 'ok', {
        ...result,
        data,
        splitWord,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 保存搜索历史
route.post(
  '/save',
  validate(
    'body',
    V.object({
      content: V.string().trim().min(1).max(fieldLength.searchHistory),
    })
  ),
  async (req, res) => {
    try {
      const { content } = req[kValidate];

      const { account } = req[kHello].userinfo;

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
  }
);

// 搜索 历史、笔记、书签
route.get(
  '/list',
  validate(
    'query',
    V.object({
      word: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.searchWord),
    })
  ),
  async (req, res) => {
    try {
      const { word } = req[kValidate];

      const { account } = req[kHello].userinfo;

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
  }
);

// 删除历史记录
route.post(
  '/delete',
  validate(
    'body',
    V.object({
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { ids } = req[kValidate];

      const { account } = req[kHello].userinfo;

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
  }
);

export default route;
