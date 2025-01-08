import express from 'express';

import axios from 'axios';

import {
  batchDiffUpdateData,
  insertData,
  updateData,
  queryData,
  getTableRowCount,
  createSearchSql,
  fillString,
  createScoreSql,
} from '../../utils/sqlite.js';

import {
  _success,
  _nologin,
  _err,
  nanoid,
  isurl,
  validaString,
  _type,
  paramErr,
  validationValue,
  _nothing,
  errLog,
  syncUpdateData,
  createPagingData,
  uLog,
  getSplitWord,
} from '../../utils/utils.js';

import cheerio from './cheerio.js';

import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';

import timedTask from '../../utils/timedTask.js';

import {
  bookListMoveLocation,
  bookmarkMoveLocation,
  bmkGroupExist,
  cleanSiteInfo,
} from './bmk.js';

import { fieldLenght } from '../config.js';
import { validShareAddUserState, validShareState } from '../user/user.js';
import { getFriendDes } from '../chat/chat.js';
import _crypto from '../../utils/crypto.js';
import _path from '../../utils/path.js';
import jwt from '../../utils/jwt.js';
import { _d } from '../../data/data.js';

const route = express.Router();

// 分享
route.get('/share', async (req, res) => {
  try {
    const { id, pass = '' } = req.query;

    if (
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(pass, 0, fieldLenght.sharePass)
    ) {
      paramErr(res, req);
      return;
    }

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
      const des = await getFriendDes(account, acc);
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
      token: jwt.set(
        { type: 'share', data: { id, types: ['bookmk'] } },
        fieldLenght.shareTokenExp
      ),
    })(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 搜索书签
route.get('/search', async (req, res) => {
  try {
    let {
      word = '',
      pageNo = 1,
      pageSize = 20,
      account: acc = '',
      category = [],
    } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      !validaString(word, 0, fieldLenght.searchWord) ||
      !validaString(acc, 0, fieldLenght.id, 1) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLenght.maxPagesize ||
      !_type.isArray(category) ||
      category.length > 10 ||
      !category.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!acc && !account) {
      _nologin(res);
      return;
    }

    const valArr = [1, 1, acc || account];
    let where = 'WHERE group_state = ? AND state = ? AND account = ?';

    if (acc && acc !== account) {
      // 非本人只能获取公开的分组书签
      where += ` AND group_share = ?`;
      valArr.push(1);
    }

    if (category.length > 0) {
      where += ` AND group_id IN (${fillString(category.length)})`;
      valArr.push(...category);
    }

    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);

      const searchSql = createSearchSql(curSplit, ['title', 'link', 'des']);

      // 根据关键词排序
      const scoreSql = createScoreSql(curSplit, ['title', 'link', 'des']);

      where += ` AND (${searchSql.sql}) ${scoreSql.sql}`;

      valArr.push(...searchSql.valArr, ...scoreSql.valArr);
    } else {
      where += ` ORDER BY id DESC`;
    }

    // 匹配结果数
    const total = await getTableRowCount('bmk_bmk_group_view', where, valArr);

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];
    if (total > 0) {
      // 分页
      where += ` LIMIT ? OFFSET ?`;
      valArr.push(pageSize, offset);

      // 匹配数据
      data = await queryData(
        'bmk_bmk_group_view',
        'group_title,id,group_id,title,link,des',
        where,
        valArr
      );
    }

    _success(res, 'ok', {
      ...result,
      splitWord,
      data,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取列表
route.get('/list', async (req, res) => {
  try {
    const { id = '', account: acc = '' } = req.query;

    if (
      !validaString(id, 0, fieldLenght.id, 1) ||
      !validaString(acc, 0, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!acc && !account) {
      _nologin(res);
      return;
    }

    let home = [];
    let list = await queryData(
      'bmk_group',
      'id,title,share',
      `WHERE account = ? AND state = ? ORDER BY num ASC`,
      [acc || account, 1]
    );

    if (acc && acc !== account) {
      list = list
        .filter((item) => item.share === 1)
        .map((item) => ({ id: item.id, title: item.title }));
    }

    if (!id || !account) {
      _success(res, 'ok', { list, home });
      return;
    }

    let bms = await queryData(
      'bmk',
      'id,title,link,logo,des,group_id',
      `WHERE account = ? AND state = ? AND group_id = ? ORDER BY num ASC`,
      [acc || account, 1, id]
    );

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
});

// 删除网址描述缓存信息
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '000030') {
    await cleanSiteInfo();
  }
});

// 获取网站信息
route.get('/parse-site-info', async (req, res) => {
  const obj = { title: '', des: '' };
  let p = '',
    miss = '';

  const { u } = req.query;

  try {
    if (!isurl(u) || !validaString(u, 1, fieldLenght.url)) {
      paramErr(res, req);
      return;
    }

    // 检查接口是否开启
    if (!_d.pubApi.siteInfoApi && !req._hello.userinfo.account) {
      return _err(res, '接口未开放')(req, u, 1);
    }

    await uLog(req, `获取网站信息(${u})`);

    p = _path.normalize(
      `${appConfig.appData}/siteinfo/${_crypto.getStringHash(u)}.json`
    );

    miss = p + '.miss';

    // 缓存存在，则使用缓存
    if (await _f.exists(p)) {
      _success(res, 'ok', JSON.parse(await _f.fsp.readFile(p)));
      return;
    }

    if (await _f.exists(miss)) {
      _success(res, 'ok', obj);
      return;
    }

    await _f.mkdir(_path.normalize(`${appConfig.appData}/siteinfo`));

    const result = await axios({
      method: 'get',
      url: u,
      timeout: 5000,
    });

    const contentType = result.headers['content-type'];
    if (!contentType || !contentType.includes('text/html')) {
      throw new Error(`只允许获取HTML文件`);
    }

    const $ = cheerio.load(result.data);
    const $title = $('head title');
    const $des = $('head meta[name="description"]');

    obj.title = $title.text() || '';
    obj.des = $des.attr('content') || '';

    await _f.fsp.writeFile(p, JSON.stringify(obj));

    _success(res, 'ok', obj);
  } catch (error) {
    if (miss) {
      try {
        await _f.fsp.writeFile(miss, '');
      } catch (err) {
        await errLog(req, `${err}(${u})`);
      }
    }

    await errLog(req, `${error}(${u})`);
    _success(res, 'ok', obj);
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
route.post('/move-group', async (req, res) => {
  try {
    const { fromId, toId } = req.body;

    if (
      !validaString(fromId, 1, fieldLenght.id, 1) ||
      !validaString(toId, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await bookListMoveLocation(account, fromId, toId);

    syncUpdateData(req, 'bookmark');

    _success(res, '移动分组位置成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 书签移动
route.post('/move-bmk', async (req, res) => {
  try {
    const { groupId, fromId, toId } = req.body;

    if (
      !validaString(groupId, 1, fieldLenght.id, 1) ||
      !validaString(fromId, 1, fieldLenght.id, 1) ||
      !validaString(toId, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await bookmarkMoveLocation(account, groupId, fromId, toId);

    syncUpdateData(req, 'bookmark');

    _success(res, '移动书签位置成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 新建分组
route.post('/add-group', async (req, res) => {
  try {
    const { title } = req.body;

    if (!validaString(title, 1, fieldLenght.title)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const total = await getTableRowCount(
      'bmk_group',
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    if (total >= 200) {
      return _err(res, '分组限制200个')(req);
    }

    await insertData('bmk_group', [
      {
        title,
        account,
        num: total + 1,
      },
    ]);

    syncUpdateData(req, 'bookmark');

    _success(res, '添加分组成功')(req, title, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除分组
route.post('/delete-group', async (req, res) => {
  try {
    const { ids } = req.body;

    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    // 放入回收站
    await updateData(
      'bmk_group',
      { state: 0 },
      `WHERE id IN (${fillString(ids.length)}) AND state = ? AND account = ?`,
      [...ids, 1, account]
    );

    syncUpdateData(req, 'bookmark');
    syncUpdateData(req, 'trash');

    _success(res, '删除分组成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 分组状态
route.post('/group-share-state', async (req, res) => {
  try {
    const { share, ids } = req.body;

    if (
      !validationValue(share, [1, 0]) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'bmk_group',
      { share },
      `WHERE id IN (${fillString(ids.length)}) AND state = ? AND account = ?`,
      [...ids, 1, account]
    );

    syncUpdateData(req, 'bookmark');

    _success(res, `${share === 1 ? '公开' : '锁定'}分组成功`)(
      req,
      ids.length,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除自定义书签logo
route.get('/delete-logo', async (req, res) => {
  try {
    const { id } = req.query;

    if (!validaString(id, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'bmk',
      { logo: '' },
      `WHERE account = ? AND id = ? AND state = ?`,
      [account, id, 1]
    );

    syncUpdateData(req, 'bookmark');

    _success(res, '删除书签LOGO成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑分组
route.post('/edit-group', async (req, res) => {
  try {
    const { id, title, toId = '' } = req.body;

    if (
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(toId, 0, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'bmk_group',
      { title },
      `WHERE account = ? AND state = ? AND id = ?`,
      [account, 1, id]
    );

    if (toId) {
      await bookListMoveLocation(account, id, toId);
    }

    syncUpdateData(req, 'bookmark');

    _success(res, '更新分组标题成功')(req, title, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加书签
route.post('/add-bmk', async (req, res) => {
  try {
    let { bms, groupId } = req.body;

    if (
      !validaString(groupId, 1, fieldLenght.id, 1) ||
      !_type.isArray(bms) ||
      bms.length === 0 ||
      bms.length > fieldLenght.maxPagesize ||
      !bms.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.title, 1, fieldLenght.title) &&
          validaString(item.link, 1, fieldLenght.url) &&
          isurl(item.link) &&
          validaString(item.des, 0, fieldLenght.des)
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    // 添加书签的分组必须存在
    if (groupId !== 'home' && !(await bmkGroupExist(account, groupId))) {
      paramErr(res, req);
      return;
    }

    const total = await getTableRowCount(
      'bmk',
      `WHERE group_id = ? AND account = ? AND state = ?`,
      [groupId, account, 1]
    );

    // 计算添加的书签和现有的书签
    if (total + bms.length > fieldLenght.bmk) {
      return _err(res, `分组书签限制${fieldLenght.bmk}个`)(req);
    }

    bms = bms.map((item, i) => ({
      account,
      num: total + i + 1,
      group_id: groupId,
      title: item.title,
      link: item.link,
      des: item.des,
    }));

    await insertData('bmk', bms);

    syncUpdateData(req, 'bookmark');

    _success(res, '添加书签成功')(req, `${groupId}-${bms.length}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 编辑书签
route.post('/edit-bmk', async (req, res) => {
  try {
    const { groupId, id, title, link, des = '', toId = '' } = req.body;

    if (
      !validaString(groupId, 1, fieldLenght.id, 1) ||
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(toId, 0, fieldLenght.id, 1) ||
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(link, 1, fieldLenght.url) ||
      !isurl(link) ||
      !validaString(des, 0, fieldLenght.des)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'bmk',
      { title, link, des },
      `WHERE account = ? AND state = ? AND id = ? AND group_id = ?`,
      [account, 1, id, groupId]
    );

    if (toId) {
      await bookmarkMoveLocation(account, groupId, id, toId);
    }

    syncUpdateData(req, 'bookmark');

    _success(res, '更新书签信息成功')(req, `${title}-${link}-${des}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 书签移动到分组
route.post('/bmk-to-group', async (req, res) => {
  try {
    const { ids, groupId } = req.body;

    if (
      !validaString(groupId, 1, fieldLenght.id, 1) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    // 移动到的分组需要存在
    if (groupId !== 'home' && !(await bmkGroupExist(account, groupId))) {
      paramErr(res, req);
      return;
    }

    const total = await getTableRowCount(
      'bmk',
      `WHERE group_id = ? AND account = ? AND state = ?`,
      [groupId, account, 1]
    );

    // 计算分组书签数量
    if (total + ids.length > fieldLenght.bmk) {
      return _err(res, `分组书签限制${fieldLenght.bmk}个`)(req);
    }

    const ob = [
      {
        key: 'num',
        where: 'id',
        data: [],
      },
      {
        key: 'group_id',
        where: 'id',
        data: [],
      },
    ];

    ids.forEach((item, idx) => {
      ob[0].data.push({
        id: item,
        num: total + idx + 1,
      });
      ob[1].data.push({
        id: item,
        group_id: groupId,
      });
    });

    await batchDiffUpdateData(
      'bmk',
      ob,
      `WHERE account = ? AND state = ? AND id IN (${fillString(ids.length)})`,
      [account, 1, ...ids]
    );

    syncUpdateData(req, 'bookmark');

    _success(res, '书签移动分组成功')(req, `${ids.length}=>${groupId}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除书签
route.post('/delete-bmk', async (req, res) => {
  try {
    const { ids } = req.body;

    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLenght.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLenght.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'bmk',
      { state: 0 },
      `WHERE id IN (${fillString(ids.length)}) AND state = ? AND account = ?`,
      [...ids, 1, account]
    );

    syncUpdateData(req, 'bookmark');
    syncUpdateData(req, 'trash');

    _success(res, '删除书签成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 分享分组
route.post('/share', async (req, res) => {
  try {
    let { id, title, expireTime, pass = '' } = req.body;

    expireTime = parseInt(expireTime);
    if (
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(pass, 0, fieldLenght.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLenght.expTime
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const bms = await queryData(
      'bmk',
      'title,link,des',
      `WHERE account = ? AND state = ? AND group_id = ? ORDER BY num ASC`,
      [account, 1, id]
    );

    if (bms.length === 0) {
      _err(res, '当前分组为空')(req, id, 1);
      return;
    }

    const obj = {
      id: nanoid(),
      exp_time:
        expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(bms),
      account,
      type: 'bookmk',
    };

    await insertData('share', [obj]);

    syncUpdateData(req, 'sharelist');

    _success(res, '分享分组成功', { id: obj.id })(req, `${title}-${obj.id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 保存分享
route.post('/save-share', async (req, res) => {
  try {
    const { title, token } = req.body;

    if (
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(token, 0, fieldLenght.url)
    ) {
      paramErr(res, req);
      return;
    }

    const share = await validShareState(token, 'bookmk');

    if (share.state === 0) {
      _err(res, share.text)(req);
      return;
    }

    let arr = share.data.data;

    const { account } = req._hello.userinfo;

    const total = await getTableRowCount(
      'bmk_group',
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    if (total >= 200) {
      return _err(res, '分组限制200个')(req);
    }

    const pid = nanoid();

    await insertData('bmk_group', [
      {
        id: pid,
        title,
        account,
        num: total + 1,
      },
    ]);

    arr = arr.map((item, idx) => {
      const { title, link, des } = item;
      return {
        title,
        link,
        des,
        num: idx + 1,
        group_id: pid,
        account,
      };
    });

    await insertData('bmk', arr);

    syncUpdateData(req, 'bookmark');

    _success(res, '保存分享书签成功')(req, `${arr.length}=>${title}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 导入
route.post('/import', async (req, res) => {
  try {
    const { list } = req.body;

    if (
      !_type.isArray(list) ||
      !list.length > fieldLenght.bmkGroup ||
      !list.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.title, 1, fieldLenght.title) &&
          _type.isArray(item.list) &&
          item.list.length <= fieldLenght.bmk &&
          item.list.every(
            (y) =>
              validaString(y.title, 1, fieldLenght.title) &&
              isurl(y.link) &&
              validaString(y.link, 1, fieldLenght.url) &&
              validaString(y.des, 0, fieldLenght.des)
          )
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const total = await getTableRowCount(
      'bmk_group',
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    if (total + list.length > fieldLenght.bmkGroup) {
      return _err(res, `分组限制${fieldLenght.bmkGroup}个`)(req);
    }

    let count = 0;
    for (let i = 0; i < list.length; i++) {
      let { title, list: bms } = list[i];

      const groupId = nanoid();

      await insertData('bmk_group', [
        {
          id: groupId,
          title,
          account,
          num: total + 1 + i,
        },
      ]);

      bms = bms.map((item, i) => ({
        account,
        num: i + 1,
        group_id: groupId,
        title: item.title,
        link: item.link,
        des: item.des,
      }));

      count += bms.length;
      await insertData('bmk', bms);
    }

    syncUpdateData(req, 'bookmark');

    _success(res, '导入书签成功')(req, count, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 导出
route.get('/export', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const bms = await queryData(
      'bmk',
      'title,link,des,group_id',
      `WHERE state = ? AND account = ?`,
      [1, account]
    );

    let list = await queryData(
      'bmk_group',
      'id,title,id',
      `WHERE account = ? AND state = ? ORDER BY num ASC`,
      [account, 1]
    );

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
