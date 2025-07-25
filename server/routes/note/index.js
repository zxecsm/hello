import express from 'express';

import {
  insertData,
  updateData,
  queryData,
  deleteData,
  incrementField,
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
  validationValue,
  paramErr,
  getWordContent,
  syncUpdateData,
  createPagingData,
  isValidDate,
  getSplitWord,
  nanoid,
  uLog,
} from '../../utils/utils.js';

import { getFriendInfo } from '../chat/chat.js';
import { fieldLength } from '../config.js';
import { parseMarkDown, saveNoteHistory } from './note.js';
import _f from '../../utils/f.js';

const route = express.Router();

// 读取笔记
route.get('/read', async (req, res) => {
  try {
    let { v: id, download = 0 } = req.query;
    download = parseInt(download);

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validationValue(download, [0, 1])
    ) {
      paramErr(res, req);
      return;
    }

    const note = (
      await queryData(
        'note_user_view',
        'account,username,logo,email,create_at,update_at,title,state,share,content,visit_count,category',
        `WHERE id = ?`,
        [id]
      )
    )[0];

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

      await incrementField('note', { visit_count: 1 }, `WHERE id = ?`, [id]);

      const { account } = req._hello.userinfo;

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
});

// 搜索笔记
route.post('/search', async (req, res) => {
  try {
    let {
      account: acc = '',
      word = '',
      category = [],
      pageNo = 1,
      pageSize = 20,
    } = req.body;

    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      !validaString(acc, 0, fieldLength.id, 1) ||
      !validaString(word, 0, fieldLength.searchWord) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLength.maxPagesize ||
      !_type.isArray(category) ||
      category.length > 10 ||
      !category.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!acc && !account) {
      _nologin(res);
      return;
    }

    let where = 'WHERE state = ? AND account = ?';

    const valArr = [1, acc || account];

    let isOwn = true;

    if (acc && acc !== account) {
      // 非自己只能访问公开的
      isOwn = false;
      where += ` AND share = ?`;
      valArr.push(1);
    }

    if (category.length > 0) {
      let hasLocked = false;

      const idx = category.findIndex((item) => item === 'locked');
      if (idx >= 0) {
        category.splice(idx, 1);
        if (isOwn) {
          where += ` AND (share = ?`;
          valArr.push(0);
          hasLocked = true;
        }
      }

      if (category.length > 0) {
        // 分类
        const categorySql = createSearchSql(
          category,
          category.map(() => 'category')
        );

        if (hasLocked) {
          where += ` OR ${categorySql.sql})`;
        } else {
          where += ` AND (${categorySql.sql})`;
        }

        valArr.push(...categorySql.valArr);
      } else {
        if (hasLocked) {
          where += ')';
        }
      }
    }

    let splitWord = [];

    if (word) {
      // 搜索
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);

      const searchSql = createSearchSql(curSplit, ['title', 'content']);

      const scoreSql = createScoreSql(curSplit, ['title', 'content']);

      where += ` AND (${searchSql.sql}) ${scoreSql.sql}`;

      valArr.push(...searchSql.valArr, ...scoreSql.valArr);
    } else {
      where += ` ORDER BY top DESC, create_at DESC`;
    }

    const total = await getTableRowCount('note', where, valArr);

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;

      where += ` LIMIT ? OFFSET ?`;

      valArr.push(pageSize, offset);

      list = await queryData(
        'note',
        'title,create_at,update_at,id,share,content,visit_count,top,category',
        where,
        valArr
      );

      const noteCategory = await queryData(
        'note_category',
        'id,title',
        `WHERE account = ?`,
        [acc || account]
      );

      list = list.map((item) => {
        let {
          title,
          content,
          id,
          create_at,
          update_at,
          share,
          visit_count,
          top,
          category,
        } = item;

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
              (item) => item.value.toLowerCase() === splitWord[0].toLowerCase()
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

        const cArr = category.split('-').filter((item) => item);
        const categoryArr = noteCategory.filter((item) =>
          cArr.includes(item.id)
        );

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
});

// 获取分类
route.get('/category', async (req, res) => {
  try {
    const { account: acc = '' } = req.query;

    if (!validaString(acc, 0, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const list = await queryData(
      'note_category',
      'id,title',
      `WHERE account = ? ORDER BY create_at DESC`,
      [acc || account]
    );

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 验证登录态
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
    const { ids, share = 0 } = req.body;

    if (
      !_type.isArray(ids) ||
      !validationValue(share, [0, 1]) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'note',
      { share },
      `WHERE id IN (${fillString(ids.length)}) AND account = ? AND state = ?`,
      [...ids, account, 1]
    );

    syncUpdateData(req, 'note');

    _success(res, `${share === 0 ? '锁定' : '公开'}笔记成功`)(
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
    let { ids } = req.body;

    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    ids = ids.filter((item) => !['about', 'tips'].includes(item)); // 过滤关于和tips

    const { account } = req._hello.userinfo;

    await updateData(
      'note',
      { state: 0 },
      `WHERE id IN (${fillString(ids.length)}) AND account = ? AND state = ?`,
      [...ids, account, 1]
    );

    syncUpdateData(req, 'note');

    syncUpdateData(req, 'trash');

    _success(res, '删除笔记成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 上传笔记
route.post('/up-note', async (req, res) => {
  try {
    let { title, content = '' } = req.body;

    if (
      !validaString(title, 1, fieldLength.title) ||
      !validaString(content, 0, 0, 0, 1) ||
      _f.getTextSize(content) > fieldLength.noteSize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await insertData('note', [
      {
        title,
        content,
        update_at: Date.now(),
        account,
      },
    ]);

    _success(res, '上传笔记成功')(req, title, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑笔记
route.post('/edit', async (req, res) => {
  try {
    let { id, title, content = '' } = req.body;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(title, 1, fieldLength.title) ||
      !validaString(content, 0, 0, 0, 1) ||
      _f.getTextSize(content) > fieldLength.noteSize
    ) {
      paramErr(res, req);
      return;
    }

    const time = Date.now();

    const { account } = req._hello.userinfo;

    const note = (
      await queryData('note', 'content', `WHERE id = ? AND account = ?`, [
        id,
        account,
      ])
    )[0];

    if (note) {
      // 保存笔记历史版本
      await saveNoteHistory(req, id, note.content);

      await updateData(
        'note',
        {
          title,
          content,
          update_at: time,
        },
        `WHERE id = ? AND account = ?`,
        [id, account]
      );

      syncUpdateData(req, 'file');

      syncUpdateData(req, 'note', id);

      syncUpdateData(req, 'trash');

      _success(res, '更新笔记成功')(req, `${title}-${id}`, 1);
    } else {
      id = nanoid();

      await insertData('note', [
        {
          id,
          title,
          content,
          update_at: time,
          account,
        },
      ]);

      syncUpdateData(req, 'note');

      _success(res, '新增笔记成功', { id })(req, `${title}-${id}`, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑笔记信息
route.post('/edit-info', async (req, res) => {
  try {
    let { id, title, create_at, update_at, visit_count } = req.body;
    visit_count = parseInt(visit_count);

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(title, 1, fieldLength.title) ||
      !isValidDate(create_at) ||
      !isValidDate(update_at) ||
      isNaN(visit_count) ||
      visit_count < 0
    ) {
      paramErr(res, req);
      return;
    }

    create_at = new Date(create_at + ' 00:00:00').getTime();
    update_at = new Date(update_at + ' 00:00:00').getTime();

    if (create_at > update_at) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'note',
      {
        title,
        create_at,
        update_at,
        visit_count,
      },
      `WHERE id = ? AND account = ?`,
      [id, account]
    );

    syncUpdateData(req, 'note', id);

    syncUpdateData(req, 'trash');

    _success(res, '更新笔记信息成功')(req, `${title}-${id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 置顶权重
route.post('/top', async (req, res) => {
  try {
    let { id, top } = req.body;
    top = parseInt(top);

    if (
      isNaN(top) ||
      top < 0 ||
      top > fieldLength.top ||
      !validaString(id, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData('note', { top }, `WHERE id = ? AND account = ?`, [
      id,
      account,
    ]);

    syncUpdateData(req, 'note');

    _success(res, '设置笔记权重成功')(req, `${id}-${top}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑笔记分类
route.post('/set-category', async (req, res) => {
  try {
    const { id, category } = req.body;

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !_type.isArray(category) ||
      category.length > 10 ||
      !category.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const categoryStr = category.join('-');
    await updateData(
      'note',
      { category: categoryStr },
      `WHERE account = ? AND id = ?`,
      [account, id]
    );

    syncUpdateData(req, 'note', id);

    _success(res, '更新分类成功')(req, `${id}: ${categoryStr}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑分类
route.post('/edit-category', async (req, res) => {
  try {
    const { title, id } = req.body;

    if (
      !validaString(title, 1, fieldLength.noteCategoryTitle) ||
      !validaString(id, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'note_category',
      { title },
      `WHERE id = ? AND account = ?`,
      [id, account]
    );

    syncUpdateData(req, 'category', id);

    _success(res, '编辑分类标题成功')(req, `${title}-${id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加分类
route.post('/add-category', async (req, res) => {
  try {
    const { title } = req.body;

    if (!validaString(title, 1, fieldLength.noteCategoryTitle)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const total = await getTableRowCount('note_category');

    if (total >= fieldLength.maxNoteCategory) {
      _err(res, `类型限制${fieldLength.maxNoteCategory}`)(req);
      return;
    }

    await insertData('note_category', [{ title, account }]);

    syncUpdateData(req, 'category');

    _success(res, '添加分类成功')(req, title, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除分类
route.get('/delete-category', async (req, res) => {
  try {
    const { id } = req.query;

    if (!validaString(id, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await deleteData('note_category', `WHERE id = ? AND account = ?`, [
      id,
      account,
    ]);

    syncUpdateData(req, 'category', id);

    _success(res, '删除分类成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
