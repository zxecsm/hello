import express from 'express';

import { db } from '../../utils/sqlite.js';

import { syncUpdateData, createPagingData, getSplitWord } from '../../utils/utils.js';

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
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 分享
route.post(
  '/get-share',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      pass: V.string().trim().default('').allowEmpty().max(fieldLength.sharePass),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, pass, captchaId } = res.locals.ctx;

    // 验证分享状态，获取分享数据
    const share = await validShareAddUserState(res, ['bookmk'], id, pass, captchaId);

    if (share.state === 0) {
      return resp.notFound(res, share.text)();
    }

    if (share.state === 2) {
      return resp.success(res, share.text, {
        id: share.id,
        needCaptcha: share.needCaptcha,
      })();
    }

    if (share.state === 3) {
      return resp.ok(res, share.text)();
    }

    let { username, logo, email, exp_time, title, account: acc, data } = share.data;

    const { account } = res.locals.hello.userinfo;

    // 如果非自己的分享
    if (account && account != acc) {
      const f = await getFriendInfo(account, acc, 'des');
      const des = f ? f.des : '';
      // 有设置备注则返回备注
      username = des || username;
    }

    resp.success(res, '获取书签分享成功', {
      username,
      logo,
      email,
      exp_time,
      account: acc,
      data,
      title,
      token: await jwt.set(
        { type: 'share', data: { id, types: ['bookmk'] } },
        fieldLength.shareTokenExp,
      ),
    })();
  }),
);

// 搜索书签
route.post(
  '/search',
  validate(
    'body',
    V.object({
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(20).min(1).max(fieldLength.maxPagesize),
      account: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      category: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .default([])
        .max(10),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { word, pageNo, pageSize, account: acc, category } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (!acc && !account) {
      return resp.unauthorized(res)();
    }

    // 非本人只能获取公开的分组书签
    const bmdb = db('bmk AS b')
      .join('bmk_group AS g', { 'b.group_id': { value: 'g.id', raw: true } }, { type: 'LEFT' })
      .where({
        'b.account': acc || account,
        'b.state': 1,
        'g.state': 1,
      });

    if (acc && acc !== account) {
      // 非本人只能获取公开的分组书签
      bmdb.where({ 'g.share': 1 });
    }

    if (category.length > 0) {
      bmdb.where({ 'b.group_id': { in: category } });
    }

    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);
      curSplit[0] = { value: curSplit[0], weight: 10 };
      bmdb.search(curSplit, ['b.title', 'b.link', 'b.des'], { sort: true });
    } else {
      bmdb.orderBy('b.serial', 'DESC');
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
        .select('g.title AS group_title,b.id,b.group_id,b.title,b.link,b.des,b.logo')
        .find();

      data.forEach((item) => {
        if (!item.group_title) {
          item.group_title = '未知分组';
        }
      });
    }

    resp.success(res, 'ok', {
      ...result,
      splitWord,
      data,
    })();
  }),
);

// 获取列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      id: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      account: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, account: acc } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (!acc && !account) {
      return resp.unauthorized(res)();
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
      return resp.success(res, 'ok', { list, home })();
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

    resp.success(res, 'ok', { list, home })();
  }),
);

// 删除网址描述缓存信息
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '001000') {
    await cleanSiteInfo();
  }
});

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

// 分组移动
route.post(
  '/move-group',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { fromId, toId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await bookListMoveLocation(account, fromId, toId);

    syncUpdateData(res, 'bookmark');

    resp.success(res, '移动分组位置成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { groupId, fromId, toId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await bookmarkMoveLocation(account, groupId, fromId, toId);

    syncUpdateData(res, 'bookmark');

    resp.success(res, '移动书签位置成功')();
  }),
);

// 新建分组
route.post(
  '/add-group',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const total = await db('bmk_group')
      .where({
        account,
        state: 1,
      })
      .count();

    if (total >= fieldLength.bmkGroup) {
      return resp.forbidden(res, `分组限制${fieldLength.bmkGroup}个`)();
    }

    await updateBmkGroupOrder(account);

    await db('bmk_group').insert({
      id: nanoid(),
      create_at: Date.now(),
      title,
      account,
      num: total + 1,
    });

    syncUpdateData(res, 'bookmark');

    resp.success(res, '添加分组成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    // 放入回收站
    await db('bmk_group')
      .where({ id: { in: ids }, state: 1, account })
      .update({ state: 0 });

    syncUpdateData(res, 'bookmark');
    syncUpdateData(res, 'trash');

    resp.success(res, '删除分组成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { share, ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('bmk_group')
      .where({ id: { in: ids }, state: 1, account })
      .update({ share });

    syncUpdateData(res, 'bookmark');

    resp.success(res, `${share === 1 ? '公开' : '锁定'}分组成功`)();
  }),
);

// 删除自定义书签logo
route.get(
  '/delete-logo',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('bmk').where({ account, id, state: 1 }).update({ logo: '' });

    syncUpdateData(res, 'bookmark');

    resp.success(res, '删除书签LOGO成功')();
  }),
);

// 编辑分组
route.post(
  '/edit-group',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      toId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, title, toId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('bmk_group').where({ account, state: 1, id }).update({ title });

    if (toId) {
      await bookListMoveLocation(account, id, toId);
    }

    syncUpdateData(res, 'bookmark');

    resp.success(res, '更新分组标题成功')();
  }),
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
        }),
      )
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    let { bms, groupId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    // 添加书签的分组必须存在
    if (groupId !== 'home' && !(await bmkGroupExist(account, groupId))) {
      return resp.badRequest(res)('书签分组不存在', 1);
    }

    const total = await db('bmk').where({ account, state: 1, group_id: groupId }).count();

    // 计算添加的书签和现有的书签
    if (total + bms.length > fieldLength.bmk) {
      return resp.forbidden(res, `分组书签限制${fieldLength.bmk}个`)();
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

    syncUpdateData(res, 'bookmark');

    resp.success(res, '添加书签成功')();
  }),
);

// 编辑书签
route.post(
  '/edit-bmk',
  validate(
    'body',
    V.object({
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      link: V.string().trim().min(1).max(fieldLength.url).httpUrl(),
      des: V.string().trim().default('').allowEmpty().max(fieldLength.des),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { groupId, id, title, link, des, toId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('bmk')
      .where({ account, state: 1, id, group_id: groupId })
      .update({ title, link, des });

    if (toId) {
      await bookmarkMoveLocation(account, groupId, id, toId);
    }

    syncUpdateData(res, 'bookmark');

    resp.success(res, '更新书签信息成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids, groupId } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    // 移动到的分组需要存在
    if (groupId !== 'home' && !(await bmkGroupExist(account, groupId))) {
      return resp.badRequest(res)('书签分组不存在', 1);
    }

    const total = await db('bmk').where({ group_id: groupId, account, state: 1 }).count();

    // 计算分组书签数量
    if (total + ids.length > fieldLength.bmk) {
      return resp.forbidden(res, `分组书签限制${fieldLength.bmk}个`)();
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

    syncUpdateData(res, 'bookmark');

    resp.success(res, '书签移动分组成功')();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('bmk')
      .where({ id: { in: ids }, state: 1, account })
      .update({ state: 0 });

    syncUpdateData(res, 'bookmark');
    syncUpdateData(res, 'trash');

    resp.success(res, '删除书签成功')();
  }),
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
      pass: V.string().trim().default('').allowEmpty().max(fieldLength.sharePass),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, title, expireTime, pass } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const bms = await db('bmk')
      .select('title,link,des')
      .where({ account, state: 1, group_id: id })
      .orderBy('num', 'asc')
      .find();

    if (bms.length === 0) {
      return resp.forbidden(res, '当前分组为空')();
    }

    const obj = {
      id: nanoid(),
      create_at: Date.now(),
      exp_time: expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(bms),
      account,
      type: 'bookmk',
    };
    await db('share').insert(obj);

    syncUpdateData(res, 'sharelist');

    resp.success(res, '分享分组成功', { id: obj.id })();
  }),
);

// 保存分享
route.post(
  '/save-share',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      token: V.string().trim().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, token } = res.locals.ctx;

    const share = await validShareState(token, 'bookmk');

    if (share.state === 0) {
      return resp.forbidden(res, share.text)();
    }

    let arr = share.data.data;

    const { account } = res.locals.hello.userinfo;

    const total = await db('bmk_group').where({ account, state: 1 }).count();

    if (total >= 200) {
      return resp.forbidden(res, '分组限制200个')();
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

    syncUpdateData(res, 'bookmark');

    resp.success(res, '保存分享书签成功')();
  }),
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
              des: V.string().trim().default('').allowEmpty().max(fieldLength.des),
            }),
          )
            .min(1)
            .max(fieldLength.bmk),
        }),
      )
        .min(1)
        .max(fieldLength.bmkGroup),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { list } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const total = await db('bmk_group').where({ account, state: 1 }).count();

    if (total + list.length > fieldLength.bmkGroup) {
      return resp.forbidden(res, `分组限制${fieldLength.bmkGroup}个`)();
    }

    await updateBmkGroupOrder(account);

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

      await db('bmk').insertMany(bms);
    }

    syncUpdateData(res, 'bookmark');

    resp.success(res, '导入书签成功')();
  }),
);

// 导出
route.get(
  '/export',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

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

    resp.success(res, '导出书签成功', list)();
  }),
);

export default route;
