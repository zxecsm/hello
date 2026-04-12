import express from 'express';

import { db } from '../../utils/sqlite.js';

import {
  getWordCount,
  getSplitWord,
  syncUpdateData,
  createPagingData,
  isValidColor,
} from '../../utils/utils.js';

import { fieldLength } from '../config.js';
import { readSearchConfig, writeSearchConfig } from './search.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 验证登录态
route.use(
  asyncHandler((_, res, next) => {
    if (res.locals.hello.userinfo.account) {
      next();
    } else {
      resp.unauthorized(res)();
    }
  }),
);

// 配置
route.get(
  '/config',
  asyncHandler(async (_, res) => {
    resp.success(res, 'ok', await readSearchConfig(res.locals.hello.userinfo.account))();
  }),
);

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
      color: V.string().trim().default('').allowEmpty().custom(isValidColor, '必须 #XXXXXX 格式'),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, link, color } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
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
    syncUpdateData(res, 'searchConfig');

    resp.success(res, '添加搜索引擎成功')();
  }),
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
      color: V.string().trim().default('').custom(isValidColor, '必须 #XXXXXX 格式'),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, link, color, id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
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
        syncUpdateData(res, 'searchConfig');
      }
    }

    resp.success(res, '修改搜索引擎成功')();
  }),
);

// 删除搜索引擎
route.post(
  '/delete-engine',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const config = await readSearchConfig(account);

    if (Array.isArray(config.searchEngineData)) {
      config.searchEngineData = config.searchEngineData.filter((s) => s.id !== id);
      await writeSearchConfig(account, config);
      syncUpdateData(res, 'searchConfig');
    }

    resp.success(res, '删除搜索引擎成功')();
  }),
);

// 切换搜索引擎
route.post(
  '/change-engine',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const config = await readSearchConfig(account);

    config.searchengineid = id;

    await writeSearchConfig(account, config);
    syncUpdateData(res, 'searchConfig');

    resp.success(res, '切换搜索引擎成功')();
  }),
);

// 清除搜索引擎LOGO
route.post(
  '/delete-engine-logo',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const config = await readSearchConfig(account);

    if (Array.isArray(config.searchEngineData)) {
      const idx = config.searchEngineData.findIndex((s) => s.id === id);
      if (idx >= 0) {
        config.searchEngineData[idx] = {
          ...config.searchEngineData[idx],
          logo: '',
        };
        await writeSearchConfig(account, config);
        syncUpdateData(res, 'searchConfig');
      }
    }

    resp.success(res, '删除搜索引擎LOGO成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, link } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
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
    syncUpdateData(res, 'searchConfig');

    resp.success(res, '添加翻译接口成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, link, id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
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
        syncUpdateData(res, 'searchConfig');
      }
    }

    resp.success(res, '修改翻译接口成功')();
  }),
);

// 删除翻译接口
route.post(
  '/delete-translator',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
    const config = await readSearchConfig(account);

    if (Array.isArray(config.translatorData)) {
      config.translatorData = config.translatorData.filter((t) => {
        return t.id !== id;
      });
      await writeSearchConfig(account, config);
      syncUpdateData(res, 'searchConfig');
    }

    resp.success(res, '删除翻译接口成功')();
  }),
);

// 切换翻译接口
route.post(
  '/change-translator',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const config = await readSearchConfig(account);

    config.translatorid = id;

    await writeSearchConfig(account, config);
    syncUpdateData(res, 'searchConfig');

    resp.success(res, '切换翻译接口成功')();
  }),
);

// 清除翻译接口LOGO
route.post(
  '/delete-translator-logo',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
    const config = await readSearchConfig(account);

    if (Array.isArray(config.translatorData)) {
      const idx = config.translatorData.findIndex((t) => t.id === id);
      if (idx >= 0) {
        config.translatorData[idx] = {
          ...config.translatorData[idx],
          logo: '',
        };
        await writeSearchConfig(account, config);
        syncUpdateData(res, 'searchConfig');
      }
    }

    resp.success(res, '删除翻译接口LOGO成功')();
  }),
);

// 分词
route.get(
  '/split-word',
  validate(
    'query',
    V.object({
      word: V.string().trim().min(1).max(fieldLength.searchWord),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { word } = res.locals.ctx;

    resp.success(res, '获取分词成功', getSplitWord(word))();
  }),
);

// 搜索历史
route.get(
  '/history-list',
  validate(
    'query',
    V.object({
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(80).min(1).max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { word, pageNo, pageSize } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

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

    resp.success(res, 'ok', {
      ...result,
      data,
      splitWord,
    })();
  }),
);

// 保存搜索历史
route.post(
  '/save',
  validate(
    'body',
    V.object({
      content: V.string().trim().min(1).max(fieldLength.searchHistory),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { content } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    // 删除重复历史记录
    await db('history').where({ account, content }).delete();

    await db('history').insert({
      id: nanoid(),
      create_at: Date.now(),
      content,
      account,
    });

    syncUpdateData(res, 'history');

    resp.success(res, '保存搜索记录成功')();
  }),
);

// 搜索 历史、笔记、书签
route.get(
  '/list',
  validate(
    'query',
    V.object({
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { word } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (!word) {
      // 没有输入返回历史记录最新10条
      const list = await db('history')
        .where({ account, state: 1 })
        .select('id,content')
        .orderBy('serial', 'desc')
        .limit(10)
        .find();

      return resp.success(res, 'ok', {
        list: list.map((item) => {
          return {
            ...item,
            type: 'ss',
          };
        }),
        splitWord: [],
      })();
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

    resp.success(res, 'ok', { list, splitWord })();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('history')
      .where({ id: { in: ids }, account, state: 1 })
      .update({
        state: 0,
      });

    syncUpdateData(res, 'history');
    syncUpdateData(res, 'trash');

    resp.success(res, '删除搜索历史成功')();
  }),
);

export default route;
