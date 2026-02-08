import express from 'express';

import { db, searchSql } from '../../utils/sqlite.js';

import {
  _success,
  _nologin,
  _err,
  paramErr,
  getWordContent,
  syncUpdateData,
  createPagingData,
  isValidDate,
  getSplitWord,
  uLog,
  validate,
} from '../../utils/utils.js';

import { getFriendInfo } from '../chat/chat.js';
import { fieldLength } from '../config.js';
import { parseMarkDown, saveNoteHistory } from './note.js';
import _f from '../../utils/f.js';
import nanoid from '../../utils/nanoid.js';
import appConfig from '../../data/config.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

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
  async (req, res) => {
    try {
      const { v: id, download } = req[kValidate];

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

        const { account } = req[kHello].userinfo;

        // 公开并且未删除 或 是自己的
        if ((share === 1 && state === 1) || acc === account) {
          if (account && note.account !== account) {
            const f = await getFriendInfo(account, acc, 'des');
            const des = f ? f.des : '';

            username = des || username;
          }

          if (download === 1) {
            res.send(content);
            uLog(req, `下载笔记成功(${id})`);
          } else {
            _success(res, '读取笔记成功', {
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
            })(req, id, 1);
          }
        } else {
          _err(res, '笔记未公开')(req, id, 1);
        }
      } else {
        _err(res, '笔记不存在')(req, id, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      let { account: acc, word, category, pageNo, pageSize } = req[kValidate];

      const { account } = req[kHello].userinfo;

      if (!acc && !account) {
        _nologin(res);
        return;
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
          let { title, content, id, create_at, update_at, share, visit_count, top, category } =
            item;

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

      _success(res, 'ok', {
        ...result,
        data: list,
        splitWord,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { account: acc } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const list = await db('note_category')
        .select('id,title')
        .where({ account: acc || account })
        .orderBy('serial', 'DESC')
        .find();

      _success(res, 'ok', list);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 笔记历史状态
route.post(
  '/history-state',
  validate(
    'body',
    V.object({
      state: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  async (req, res) => {
    try {
      const { state } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('user').where({ account, state: 1 }).update({ note_history: state });

      _success(res, `${state === 0 ? '关闭' : '开启'}笔记历史记录成功`)(req);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);
route.get('/history-state', async (req, res) => {
  try {
    const { note_history } = req[kHello].userinfo;
    _success(res, 'ok', { note_history });
  } catch (error) {
    _err(res)(req, error);
  }
});

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
  async (req, res) => {
    try {
      const { ids, share } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('note')
        .where({ id: { in: ids }, account, state: 1 })
        .update({ share });

      syncUpdateData(req, 'note');

      _success(res, `${share === 0 ? '锁定' : '公开'}笔记成功`)(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      let { ids } = req[kValidate];

      ids = ids.filter((item) => ![appConfig.aboutid, appConfig.tipsid].includes(item)); // 过滤关于和tips

      const { account } = req[kHello].userinfo;

      if (ids.length > 0) {
        await db('note')
          .where({ id: { in: ids }, account, state: 1 })
          .update({ state: 0 });

        syncUpdateData(req, 'note');

        syncUpdateData(req, 'trash');
      }

      _success(res, '删除笔记成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { title, content } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const create_at = Date.now();
      await db('note').insert({
        id: nanoid(),
        create_at,
        title,
        content,
        update_at: create_at,
        account,
      });

      _success(res, '上传笔记成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      let { id, title, content } = req[kValidate];

      const time = Date.now();

      const { account, note_history } = req[kHello].userinfo;

      const note = await db('note').select('content').where({ id, account }).findOne();

      if (note) {
        // 保存笔记历史版本
        if (note_history === 1) {
          await saveNoteHistory(req, id, note.content);
          syncUpdateData(req, 'file');
        }

        await db('note').where({ id, account }).update({
          title,
          content,
          update_at: time,
        });

        syncUpdateData(req, 'note', id);

        syncUpdateData(req, 'trash');

        _success(res, '更新笔记成功')(req, `${title}-${id}`, 1);
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

        syncUpdateData(req, 'note');

        _success(res, '新增笔记成功', { id })(req, `${title}-${id}`, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

// 编辑笔记信息
route.post(
  '/edit-info',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      create_at: V.string()
        .trim()
        .custom((v) => isValidDate(v), '必须 YYYY-MM-DD 格式'),
      update_at: V.string()
        .trim()
        .custom((v) => isValidDate(v), '必须 YYYY-MM-DD 格式'),
      visit_count: V.number().toInt().min(0),
    }),
  ),
  async (req, res) => {
    try {
      let { id, title, create_at, update_at, visit_count } = req[kValidate];

      create_at = new Date(create_at + ' 00:00:00').getTime();
      update_at = new Date(update_at + ' 00:00:00').getTime();

      if (create_at > update_at) {
        paramErr(res, req, 'create_at 不能大于 update_at', 'body');
        return;
      }

      const { account } = req[kHello].userinfo;

      await db('note').where({ id, account }).update({
        title,
        create_at,
        update_at,
        visit_count,
      });

      syncUpdateData(req, 'note', id);

      syncUpdateData(req, 'trash');

      _success(res, '更新笔记信息成功')(req, `${title}-${id}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { id, top } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('note').where({ id, account }).update({ top });

      syncUpdateData(req, 'note');

      _success(res, '设置笔记权重成功')(req, `${id}-${top}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { id, category } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const categoryStr = category.join('-');
      await db('note').where({ id, account }).update({ category: categoryStr });

      syncUpdateData(req, 'note', id);

      _success(res, '更新分类成功')(req, `${id}: ${categoryStr}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { title, id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('note_category').where({ id, account }).update({ title });

      syncUpdateData(req, 'category', id);

      _success(res, '编辑分类标题成功')(req, `${title}-${id}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { title } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const total = await db('note_category').count();

      if (total >= fieldLength.maxNoteCategory) {
        _err(res, `类型限制${fieldLength.maxNoteCategory}`)(req);
        return;
      }
      await db('note_category').insert({
        id: nanoid(),
        create_at: Date.now(),
        title,
        account,
      });

      syncUpdateData(req, 'category');

      _success(res, '添加分类成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('note_category').where({ id, account }).delete();

      syncUpdateData(req, 'category', id);

      _success(res, '删除分类成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

export default route;
