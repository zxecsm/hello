import express from 'express';

import { db } from '../../utils/sqlite.js';

import {
  _success,
  _nologin,
  _err,
  paramErr,
  _nothing,
  syncUpdateData,
  createPagingData,
  getSplitWord,
  validate,
} from '../../utils/utils.js';

import timedTask from '../../utils/timedTask.js';

import {
  bookListMoveLocation,
  bookmarkMoveLocation,
  bmkGroupExist,
  cleanSiteInfo,
  updateBmkGroupOrder,
  updateBmkOrder,
} from './bmk.js';

import { fieldLength } from '../config.js';
import { validShareAddUserState, validShareState } from '../user/user.js';
import { getFriendInfo } from '../chat/chat.js';
import jwt from '../../utils/jwt.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';

const route = express.Router();

// 分享
route.post(
  '/get-share',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      pass: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.sharePass),
    })
  ),
  async (req, res) => {
    try {
      const { id, pass } = req._vdata;

      // 验证分享状态，获取分享数据
      const share = await validShareAddUserState(req, ['bookmk'], id, pass);

      if (share.state === 0) {
        _err(res, share.text)(req, id, 1);
        return;
      }

      if (share.state === 3) {
        _nothing(res, share.text);
        return;
      }

      let {
        username,
        logo,
        email,
        exp_time,
        title,
        account: acc,
        data,
      } = share.data;

      const { account } = req._hello.userinfo;

      // 如果非自己的分享
      if (account && account != acc) {
        const f = await getFriendInfo(account, acc, 'des');
        const des = f ? f.des : '';
        // 有设置备注则返回备注
        username = des || username;
      }

      _success(res, '获取书签分享成功', {
        username,
        logo,
        email,
        exp_time,
        account: acc,
        data,
        title,
        token: await jwt.set(
          { type: 'share', data: { id, types: ['bookmk'] } },
          fieldLength.shareTokenExp
        ),
      })(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 搜索书签
route.post(
  '/search',
  validate(
    'body',
    V.object({
      word: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(20)
        .min(1)
        .max(fieldLength.maxPagesize),
      account: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
      category: V.array(
        V.string().trim().min(1).max(fieldLength.id).alphanumeric()
      )
        .default([])
        .max(10),
    })
  ),
  async (req, res) => {
    try {
      const { word, pageNo, pageSize, account: acc, category } = req._vdata;

      const { account } = req._hello.userinfo;

      if (!acc && !account) {
        _nologin(res);
        return;
      }

      // 非本人只能获取公开的分组书签
      const bmdb = db('bmk_bmk_group_view').where({
        account: acc || account,
        state: 1,
        group_state: 1,
      });

      if (acc && acc !== account) {
        // 非本人只能获取公开的分组书签
        bmdb.where({ group_share: 1 });
      }

      if (category.length > 0) {
        bmdb.where({ group_id: { in: category } });
      }

      let splitWord = [];
      if (word) {
        splitWord = getSplitWord(word);

        const curSplit = splitWord.slice(0, 10);
        curSplit[0] = { value: curSplit[0], weight: 10 };
        bmdb.search(curSplit, ['title', 'link', 'des'], { sort: true });
      } else {
        bmdb.orderBy('serial', 'DESC');
      }

      // 匹配结果数
      const total = await bmdb.count();

      const result = createPagingData(Array(total), pageSize, pageNo);

      const offset = (result.pageNo - 1) * pageSize;

      let data = [];
      if (total > 0) {
        // 分页
        data = await bmdb
          .page(pageSize, offset)
          .select('group_title,id,group_id,title,link,des,logo')
          .find();

        data.forEach((item) => {
          if (!item.group_title) {
            item.group_title = '未知分组';
          }
        });
      }

      _success(res, 'ok', {
        ...result,
        splitWord,
        data,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      id: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
      account: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id, account: acc } = req._vdata;

      const { account } = req._hello.userinfo;

      if (!acc && !account) {
        _nologin(res);
        return;
      }

      let home = [];
      let list = await db('bmk_group')
        .select('id,title,share')
        .where({ account: acc || account, state: 1 })
        .orderBy('num', 'ASC')
        .find();

      if (acc && acc !== account) {
        list = list
          .filter((item) => item.share === 1)
          .map((item) => ({ id: item.id, title: item.title }));
      }

      if (!id || !account) {
        _success(res, 'ok', { list, home });
        return;
      }

      let bms = await db('bmk')
        .select('id,title,link,logo,des,group_id')
        .where({
          account: acc || account,
          state: 1,
          group_id: id,
        })
        .orderBy('num', 'ASC')
        .find();

      bms = bms.map((item, idx) => ({ ...item, num: idx }));
      list = list.map((item, idx) => ({ ...item, num: idx }));

      if (id === 'home') {
        home = bms;
      } else {
        list = list.map((item) => {
          if (item.id === id) {
            item.item = bms;
          }
          return item;
        });
      }

      _success(res, 'ok', { list, home });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除网址描述缓存信息
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '001000') {
    await cleanSiteInfo();
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

// 分组移动
route.post(
  '/move-group',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { fromId, toId } = req._vdata;

      const { account } = req._hello.userinfo;

      await bookListMoveLocation(account, fromId, toId);

      syncUpdateData(req, 'bookmark');

      _success(res, '移动分组位置成功')(req, `${fromId}=>${toId}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 书签移动
route.post(
  '/move-bmk',
  validate(
    'body',
    V.object({
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { groupId, fromId, toId } = req._vdata;

      const { account } = req._hello.userinfo;

      await bookmarkMoveLocation(account, groupId, fromId, toId);

      syncUpdateData(req, 'bookmark');

      _success(res, '移动书签位置成功')(
        req,
        `${groupId}: ${fromId}=>${toId}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 新建分组
route.post(
  '/add-group',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
    })
  ),
  async (req, res) => {
    try {
      const { title } = req._vdata;

      const { account } = req._hello.userinfo;

      const total = await db('bmk_group')
        .where({
          account,
          state: 1,
        })
        .count();

      if (total >= fieldLength.bmkGroup) {
        return _err(res, `分组限制${fieldLength.bmkGroup}个`)(req);
      }

      await updateBmkGroupOrder(account);

      await db('bmk_group').insert({
        id: nanoid(),
        create_at: new Date(),
        title,
        account,
        num: total + 1,
      });

      syncUpdateData(req, 'bookmark');

      _success(res, '添加分组成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除分组
route.post(
  '/delete-group',
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
      const { ids } = req._vdata;

      const { account } = req._hello.userinfo;

      // 放入回收站
      await db('bmk_group')
        .where({ id: { in: ids }, state: 1, account })
        .update({ state: 0 });

      syncUpdateData(req, 'bookmark');
      syncUpdateData(req, 'trash');

      _success(res, '删除分组成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 分组状态
route.post(
  '/group-share-state',
  validate(
    'body',
    V.object({
      share: V.number().toInt().enum([0, 1]),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { share, ids } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('bmk_group')
        .where({ id: { in: ids }, state: 1, account })
        .update({ share });

      syncUpdateData(req, 'bookmark');

      _success(res, `${share === 1 ? '公开' : '锁定'}分组成功`)(
        req,
        ids.length,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除自定义书签logo
route.get(
  '/delete-logo',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('bmk').where({ account, id, state: 1 }).update({ logo: '' });

      syncUpdateData(req, 'bookmark');

      _success(res, '删除书签LOGO成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑分组
route.post(
  '/edit-group',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      toId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id, title, toId } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('bmk_group').where({ account, state: 1, id }).update({ title });

      if (toId) {
        await bookListMoveLocation(account, id, toId);
      }

      syncUpdateData(req, 'bookmark');

      _success(res, '更新分组标题成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 添加书签
route.post(
  '/add-bmk',
  validate(
    'body',
    V.object({
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      bms: V.array(
        V.object({
          title: V.string().trim().min(1).max(fieldLength.title),
          link: V.string().trim().min(1).max(fieldLength.url).httpUrl(),
          des: V.string().trim().default('').allowEmpty().max(fieldLength.des),
        })
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      let { bms, groupId } = req._vdata;

      const { account } = req._hello.userinfo;

      // 添加书签的分组必须存在
      if (groupId !== 'home' && !(await bmkGroupExist(account, groupId))) {
        paramErr(res, req);
        return;
      }

      const total = await db('bmk')
        .where({ account, state: 1, group_id: groupId })
        .count();

      // 计算添加的书签和现有的书签
      if (total + bms.length > fieldLength.bmk) {
        return _err(res, `分组书签限制${fieldLength.bmk}个`)(req);
      }

      await updateBmkOrder(account, groupId);
      const create_at = Date.now();

      bms = bms.map((item, i) => ({
        id: nanoid(),
        create_at,
        account,
        num: total + i + 1,
        group_id: groupId,
        title: item.title,
        link: item.link,
        des: item.des,
      }));
      await db('bmk').insertMany(bms);

      syncUpdateData(req, 'bookmark');

      _success(res, '添加书签成功')(req, `${groupId}-${bms.length}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑书签
route.post(
  '/edit-bmk',
  validate(
    'body',
    V.object({
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      link: V.string().trim().min(1).max(fieldLength.url).httpUrl(),
      des: V.string().trim().default('').allowEmpty().max(fieldLength.des),
    })
  ),
  async (req, res) => {
    try {
      const { groupId, id, title, link, des, toId } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('bmk')
        .where({ account, state: 1, id, group_id: groupId })
        .update({ title, link, des });

      if (toId) {
        await bookmarkMoveLocation(account, groupId, id, toId);
      }

      syncUpdateData(req, 'bookmark');

      _success(res, '更新书签信息成功')(
        req,
        `${groupId}: ${id}-${title}-${link}-${des}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 书签移动到分组
route.post(
  '/bmk-to-group',
  validate(
    'body',
    V.object({
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { ids, groupId } = req._vdata;

      const { account } = req._hello.userinfo;

      // 移动到的分组需要存在
      if (groupId !== 'home' && !(await bmkGroupExist(account, groupId))) {
        paramErr(res, req);
        return;
      }

      const total = await db('bmk')
        .where({ group_id: groupId, account, state: 1 })
        .count();

      // 计算分组书签数量
      if (total + ids.length > fieldLength.bmk) {
        return _err(res, `分组书签限制${fieldLength.bmk}个`)(req);
      }

      await updateBmkOrder(account, groupId);

      const ob = [
        {
          field: 'num',
          match: 'id',
          items: [],
        },
        {
          field: 'group_id',
          match: 'id',
          items: [],
        },
      ];

      ids.forEach((item, idx) => {
        ob[0].items.push({
          id: item,
          num: total + idx + 1,
        });
        ob[1].items.push({
          id: item,
          group_id: groupId,
        });
      });

      await db('bmk').batchDiffUpdate(ob, {
        account,
        state: 1,
        id: { in: ids },
      });

      syncUpdateData(req, 'bookmark');

      _success(res, '书签移动分组成功')(req, `${ids.length}=>${groupId}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除书签
route.post(
  '/delete-bmk',
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
      const { ids } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('bmk')
        .where({ id: { in: ids }, state: 1, account })
        .update({ state: 0 });

      syncUpdateData(req, 'bookmark');
      syncUpdateData(req, 'trash');

      _success(res, '删除书签成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 分享分组
route.post(
  '/share',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      expireTime: V.number().toInt().max(fieldLength.expTime),
      pass: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.sharePass),
    })
  ),
  async (req, res) => {
    try {
      const { id, title, expireTime, pass } = req._vdata;

      const { account } = req._hello.userinfo;

      const bms = await db('bmk')
        .select('title,link,des')
        .where({ account, state: 1, group_id: id })
        .orderBy('num', 'asc')
        .find();

      if (bms.length === 0) {
        _err(res, '当前分组为空')(req, id, 1);
        return;
      }

      const obj = {
        id: nanoid(),
        create_at: Date.now(),
        exp_time:
          expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
        title,
        pass,
        data: JSON.stringify(bms),
        account,
        type: 'bookmk',
      };
      await db('share').insert(obj);

      syncUpdateData(req, 'sharelist');

      _success(res, '分享分组成功', { id: obj.id })(
        req,
        `${id}: ${title}-${obj.id}-${bms.length}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 保存分享
route.post(
  '/save-share',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      token: V.string().trim().min(1).max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const { title, token } = req._vdata;

      const share = await validShareState(token, 'bookmk');

      if (share.state === 0) {
        _err(res, share.text)(req);
        return;
      }

      let arr = share.data.data;

      const { account } = req._hello.userinfo;

      const total = await db('bmk_group').where({ account, state: 1 }).count();

      if (total >= 200) {
        return _err(res, '分组限制200个')(req);
      }

      const pid = nanoid();
      const create_at = Date.now();

      await updateBmkGroupOrder(account);

      await db('bmk_group').insert({
        id: pid,
        create_at,
        title,
        account,
        num: total + 1,
      });
      arr = arr.map((item, idx) => {
        const { title, link, des } = item;
        return {
          id: nanoid(),
          create_at,
          title,
          link,
          des,
          num: idx + 1,
          group_id: pid,
          account,
        };
      });
      await db('bmk').insertMany(arr);

      syncUpdateData(req, 'bookmark');

      _success(res, '保存分享书签成功')(req, `${arr.length}=>${title}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 导入
route.post(
  '/import',
  validate(
    'body',
    V.object({
      list: V.array(
        V.object({
          title: V.string().trim().min(1).max(fieldLength.title),
          list: V.array(
            V.object({
              title: V.string().trim().min(1).max(fieldLength.title),
              link: V.string().trim().min(1).max(fieldLength.url).httpUrl(),
              des: V.string()
                .trim()
                .default('')
                .allowEmpty()
                .max(fieldLength.des),
            })
          )
            .min(1)
            .max(fieldLength.bmk),
        })
      )
        .min(1)
        .max(fieldLength.bmkGroup),
    })
  ),
  async (req, res) => {
    try {
      const { list } = req._vdata;

      const { account } = req._hello.userinfo;

      const total = await db('bmk_group').where({ account, state: 1 }).count();

      if (total + list.length > fieldLength.bmkGroup) {
        return _err(res, `分组限制${fieldLength.bmkGroup}个`)(req);
      }

      await updateBmkGroupOrder(account);

      let count = 0;
      const create_at = Date.now();
      for (let i = 0; i < list.length; i++) {
        let { title, list: bms } = list[i];

        const groupId = nanoid();

        await db('bmk_group').insert({
          create_at,
          id: groupId,
          title,
          account,
          num: total + 1 + i,
        });
        bms = bms.map((item, i) => ({
          id: nanoid(),
          create_at,
          account,
          num: i + 1,
          group_id: groupId,
          title: item.title,
          link: item.link,
          des: item.des,
        }));

        count += bms.length;
        await db('bmk').insertMany(bms);
      }

      syncUpdateData(req, 'bookmark');

      _success(res, '导入书签成功')(req, count, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 导出
route.get('/export', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const bms = await db('bmk')
      .select('title,link,des,group_id')
      .where({ account, state: 1 })
      .find();

    let list = await db('bmk_group')
      .select('id,title')
      .where({ account, state: 1 })
      .orderBy('num', 'asc')
      .find();

    list.unshift({ id: 'home', title: '主页' });

    list = list.map((item) => {
      const children = bms.filter((y) => y.group_id === item.id);
      return {
        title: item.title,
        children: children.map((item) => ({
          title: item.title,
          link: item.link,
          des: item.des,
        })),
      };
    });

    _success(res, '导出书签成功', list)(req, bms.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
