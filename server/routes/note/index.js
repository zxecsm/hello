import express from 'express';

import { db, searchSql } from '../../utils/sqlite.js';

import {
  getWordContent,
  syncUpdateData,
  createPagingData,
  isValidDate,
  getSplitWord,
} from '../../utils/utils.js';

import { getFriendInfo } from '../chat/chat.js';
import { fieldLength } from '../config.js';
import { parseMarkDown, saveNoteHistory } from './note.js';
import _f from '../../utils/f.js';
import nanoid from '../../utils/nanoid.js';
import appConfig from '../../data/config.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 读取笔记
route.get(
  '/read',
  validate(
    'query',
    V.object({
      v: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      download: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { v: id, download } = res.locals.ctx;

    const note = await db('note AS n')
      .join('user AS u', { 'n.account': { value: 'u.account', raw: true } }, { type: 'LEFT' })
      .select(
        'u.account,u.username,u.logo,u.email,n.create_at,n.update_at,n.title,n.state,n.share,n.content,n.visit_count,n.category',
      )
      .where({ 'n.id': id })
      .findOne();

    if (note) {
      let {
        username,
        share,
        title,
        content,
        account: acc,
        create_at,
        update_at,
        visit_count,
        state,
        logo,
        email,
        category,
      } = note;

      await db('note').where({ id }).increment({ visit_count: 1 });

      const { account } = res.locals.hello.userinfo;

      // 公开并且未删除 或 是自己的
      if ((share === 1 && state === 1) || acc === account) {
        if (account && note.account !== account) {
          const f = await getFriendInfo(account, acc, 'des');
          const des = f ? f.des : '';

          username = des || username;
        }

        if (download === 1) {
          res.send(content);
        } else {
          resp.success(res, '读取笔记成功', {
            username,
            title,
            content,
            visit_count,
            account: acc,
            create_at,
            update_at,
            logo,
            email,
            category,
          })();
        }
      } else {
        resp.forbidden(res, '笔记未公开')();
      }
    } else {
      resp.notFound(res, '笔记不存在')();
    }
  }),
);

// 搜索笔记
route.post(
  '/search',
  validate(
    'body',
    V.object({
      account: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(20).min(1).max(fieldLength.maxPagesize),
      category: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .default([])
        .max(10),
    }),
  ),
  asyncHandler(async (_, res) => {
    let { account: acc, word, category, pageNo, pageSize } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (!acc && !account) {
      return resp.unauthorized(res)();
    }

    const notedb = db('note').where({ account: acc || account, state: 1 });

    let isOwn = true;

    if (acc && acc !== account) {
      // 非自己只能访问公开的
      isOwn = false;
      notedb.where({ share: 1 });
    }

    if (category.length > 0) {
      let hasLocked = false;

      const idx = category.findIndex((item) => item === 'locked');
      if (idx >= 0) {
        category.splice(idx, 1);
        hasLocked = true;
      }

      if (category.length > 0) {
        // 分类
        const categorySql = searchSql(
          category,
          category.map(() => 'category'),
        );

        if (isOwn) {
          if (hasLocked) {
            notedb.where(
              { share: 0 },
              {
                process({ clause, params }) {
                  return {
                    clause: `((${clause}) OR ${categorySql.clause})`,
                    params: [...params, ...categorySql.params],
                  };
                },
              },
            );
          } else {
            notedb.search(
              category,
              category.map(() => 'category'),
            );
          }
        } else {
          notedb.search(
            category,
            category.map(() => 'category'),
          );
        }
      } else {
        if (isOwn && hasLocked) {
          notedb.where({ share: 0 });
        }
      }
    }

    let splitWord = [];

    if (word) {
      // 搜索
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);
      curSplit[0] = { value: curSplit[0], weight: 10 };
      notedb.search(curSplit, ['title', 'content'], { sort: true });
    } else {
      notedb.orderBy('top', 'DESC').orderBy('create_at', 'DESC');
    }

    const total = await notedb.count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;

      list = await notedb
        .select('title,create_at,update_at,id,share,content,visit_count,top,category')
        .page(pageSize, offset)
        .find();

      const noteCategory = await db('note_category')
        .select('id,title')
        .where({ account: acc || account })
        .find();

      list = list.map((item) => {
        let { title, content, id, create_at, update_at, share, visit_count, top, category } = item;

        let con = [];
        let images = [];

        if (content) {
          const { text, images: img } = parseMarkDown(content);
          content = text.replace(/[\n\r]/g, '');
          images = img;

          if (word) {
            // 提取关键词
            const wc = getWordContent(splitWord, content);

            const idx = wc.findIndex(
              (item) => item.value.toLowerCase() === splitWord[0].toLowerCase(),
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
          }

          if (con.length === 0) {
            con = [
              {
                value: content.slice(0, fieldLength.notePreviewLength),
                type: 'text',
              },
            ];
            if (content.length > fieldLength.notePreviewLength) {
              con.push({ type: 'icon', value: '...' });
            }
          }
        }

        const cArr = category.split('-').filter(Boolean);
        const categoryArr = noteCategory.filter((item) => cArr.includes(item.id));

        return {
          id,
          share,
          title,
          visit_count,
          con,
          top,
          category,
          categoryArr,
          create_at,
          update_at,
          images,
        };
      });
    }

    resp.success(res, 'ok', {
      ...result,
      data: list,
      splitWord,
    })();
  }),
);

// 获取分类
route.get(
  '/category',
  validate(
    'query',
    V.object({
      account: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account: acc } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const list = await db('note_category')
      .select('id,title')
      .where({ account: acc || account })
      .orderBy('serial', 'DESC')
      .find();

    resp.success(res, 'ok', list)();
  }),
);

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

// 笔记历史状态
route.post(
  '/history-state',
  validate(
    'body',
    V.object({
      state: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { state } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('user').where({ account, state: 1 }).update({ note_history: state });

    resp.success(res, `${state === 0 ? '关闭' : '开启'}笔记历史记录成功`)();
  }),
);
route.get(
  '/history-state',
  asyncHandler(async (_, res) => {
    const { note_history } = res.locals.hello.userinfo;
    resp.success(res, 'ok', { note_history })();
  }),
);

// 笔记状态
route.post(
  '/state',
  validate(
    'body',
    V.object({
      share: V.number().toInt().default(0).enum([0, 1]),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids, share } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('note')
      .where({ id: { in: ids }, account, state: 1 })
      .update({ share });

    syncUpdateData(res, 'note');

    resp.success(res, `${share === 0 ? '锁定' : '公开'}笔记成功`)();
  }),
);

// 删除笔记
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
    let { ids } = res.locals.ctx;

    ids = ids.filter((item) => ![appConfig.aboutid, appConfig.tipsid].includes(item)); // 过滤关于和tips

    const { account } = res.locals.hello.userinfo;

    if (ids.length > 0) {
      await db('note')
        .where({ id: { in: ids }, account, state: 1 })
        .update({ state: 0 });

      syncUpdateData(res, 'note');

      syncUpdateData(res, 'trash');
    }

    resp.success(res, '删除笔记成功')();
  }),
);

// 上传笔记
route.post(
  '/up-note',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      content: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.noteSize,
          `笔记内容不能超过: ${fieldLength.noteSize} 字节`,
        ),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, content } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const create_at = Date.now();
    await db('note').insert({
      id: nanoid(),
      create_at,
      title,
      content,
      update_at: create_at,
      account,
    });

    resp.success(res, '上传笔记成功')();
  }),
);

// 编辑笔记
route.post(
  '/edit',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      content: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.noteSize,
          `笔记内容不能超过: ${fieldLength.noteSize} 字节`,
        ),
    }),
  ),
  asyncHandler(async (_, res) => {
    let { id, title, content } = res.locals.ctx;

    const time = Date.now();

    const { account, note_history } = res.locals.hello.userinfo;

    const note = await db('note').select('content').where({ id, account }).findOne();

    if (note) {
      // 保存笔记历史版本
      if (note_history === 1) {
        await saveNoteHistory(res, id, note.content);
        syncUpdateData(res, 'file');
      }

      await db('note').where({ id, account }).update({
        title,
        content,
        update_at: time,
      });

      syncUpdateData(res, 'note', id);

      syncUpdateData(res, 'trash');

      resp.success(res, '更新笔记成功')();
    } else {
      id = nanoid();

      await db('note').insert({
        id,
        create_at: time,
        title,
        content,
        update_at: time,
        account,
      });

      syncUpdateData(res, 'note');

      resp.success(res, '新增笔记成功', { id })();
    }
  }),
);

// 编辑笔记信息
route.post(
  '/edit-info',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      create_at: V.string().trim().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      update_at: V.string().trim().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      visit_count: V.number().toInt().min(0),
    }),
  ),
  asyncHandler(async (_, res) => {
    let { id, title, create_at, update_at, visit_count } = res.locals.ctx;

    create_at = new Date(create_at + ' 00:00:00').getTime();
    update_at = new Date(update_at + ' 00:00:00').getTime();

    if (create_at > update_at) {
      return resp.badRequest(res)('create_at 不能大于 update_at', 1);
    }

    const { account } = res.locals.hello.userinfo;

    await db('note').where({ id, account }).update({
      title,
      create_at,
      update_at,
      visit_count,
    });

    syncUpdateData(res, 'note', id);

    syncUpdateData(res, 'trash');

    resp.success(res, '更新笔记信息成功')();
  }),
);

// 置顶权重
route.post(
  '/top',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      top: V.number().toInt().min(0).max(fieldLength.top),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, top } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('note').where({ id, account }).update({ top });

    syncUpdateData(res, 'note');

    resp.success(res, '设置笔记权重成功')();
  }),
);

// 编辑笔记分类
route.post(
  '/set-category',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      category: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .default([])
        .max(10),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, category } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const categoryStr = category.join('-');
    await db('note').where({ id, account }).update({ category: categoryStr });

    syncUpdateData(res, 'note', id);

    resp.success(res, '更新分类成功')();
  }),
);

// 编辑分类
route.post(
  '/edit-category',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.noteCategoryTitle),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('note_category').where({ id, account }).update({ title });

    syncUpdateData(res, 'category', id);

    resp.success(res, '编辑分类标题成功')();
  }),
);

// 添加分类
route.post(
  '/add-category',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.noteCategoryTitle),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const total = await db('note_category').count();

    if (total >= fieldLength.maxNoteCategory) {
      return resp.forbidden(res, `类型限制${fieldLength.maxNoteCategory}`)();
    }
    await db('note_category').insert({
      id: nanoid(),
      create_at: Date.now(),
      title,
      account,
    });

    syncUpdateData(res, 'category');

    resp.success(res, '添加分类成功')();
  }),
);

// 删除分类
route.get(
  '/delete-category',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('note_category').where({ id, account }).delete();

    syncUpdateData(res, 'category', id);

    resp.success(res, '删除分类成功')();
  }),
);

export default route;
