const express = require('express'),
  route = express.Router();
const { default: axios } = require('axios');
const {
  batchUpdateData,
  insertData,
  updateData,
  queryData,
} = require('../utils/sqlite');
const {
  bookSort,
  _success,
  _nologin,
  _err,
  nanoid,
  isurl,
  validaString,
  _type,
  paramErr,
  validationValue,
  getWordCount,
  splitWord,
  createFillString,
  _nothing,
  isValid,
  errLog,
  syncUpdateData,
  isImgFile,
  createPagingData,
  uLog,
  readMenu,
  _delDir,
  writelog,
} = require('../utils/utils');
const cheerio = require('cheerio');
const shareVerify = require('../utils/shareVerify');
const configObj = require('../data/config');
const _f = require('../utils/f');
const timedTask = require('../utils/timedTask');
// 分享
route.get('/share', async (req, res) => {
  try {
    const { id, pass = '' } = req.query;
    if (!validaString(id, 1, 50, 1) || !validaString(pass, 0, 20)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const ip = req._hello.ip;
    if (shareVerify.verify(ip, id)) {
      const share = (
        await queryData('getshare', '*', `WHERE id=? AND type=?`, [
          id,
          'bookmk',
        ])
      )[0];
      if (!share) {
        _err(res, '分享已取消')(req, id, 1);
        return;
      }
      if (isValid(share.valid)) {
        _err(res, '分享已过期')(req, id, 1);
        return;
      }
      if (share.pass && pass !== share.pass) {
        if (pass) {
          shareVerify.add(ip, id);
        }
        await errLog(req, `提取码错误(${id})`);
        _nothing(res, '提取码错误');
        return;
      }
      if (account && account != share.account) {
        const fArr = await queryData('friends', '*', `WHERE account=?`, [
          account,
        ]);
        const f = fArr.find((item) => item.friend == share.account);
        if (f) {
          share.username = f.des || share.username;
        }
      }
      _success(res, '获取书签分享成功', {
        ...share,
        data: JSON.parse(share.data),
      })(req, id, 1);
    } else {
      _err(res, '提取码多次错误，请10分钟后再试')(req, id, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 搜索书签
route.get('/search', async (req, res) => {
  try {
    let { word = '', pageNo = 1, pageSize = 20, acc = '' } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      !validaString(word, 0, 100) ||
      !validaString(acc, 0, 50, 1) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 200
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    let list = [];
    let booklist = await queryData(
      'booklist',
      '*',
      `WHERE state=? AND account=?`,
      ['0', acc || account]
    );
    if (acc && acc !== account) {
      booklist = booklist.filter((item) => item.share === 'y');
      list = await queryData('bookmk', '*', `WHERE state=? AND account=?`, [
        '0',
        acc,
      ]);
      list = list.filter((item) => booklist.some((y) => y.id == item.listid));
    } else {
      if (account) {
        booklist.push({ id: 'home' });
        list = await queryData('bookmk', '*', `WHERE state=? AND account=?`, [
          '0',
          account,
        ]);
      } else {
        _nologin(res);
        return;
      }
    }
    const bookListObj = {};
    booklist.forEach((item) => {
      bookListObj[item.id] = item;
    });
    list = list.map((item) => ({ ...item, group: bookListObj[item.listid] }));
    list.reverse();
    if (word) {
      word = splitWord(word);
      list = list.map((item) => {
        const { name, link, des } = item;
        item.snum = getWordCount(word, '' + name + link + des);
        return item;
      });
      list.sort((a, b) => b.snum - a.snum);
      list = list.filter((item) => item.snum > 0);
    }
    _success(res, 'ok', {
      ...createPagingData(list, pageSize, pageNo),
      splitWord: word,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '003000') {
    const now = Date.now();
    const sList = await readMenu(`${configObj.filepath}/siteinfo`);
    let num = 0;
    for (let i = 0; i < sList.length; i++) {
      const { name, path, time } = sList[i];
      if (now - time > 7 * 24 * 60 * 60 * 1000) {
        await _delDir(`${path}/${name}`);
        num++;
      }
    }
    if (num) {
      await writelog(false, `删除过期网站信息：${num}`, 'user');
    }
  }
});
// 获取网站信息
route.get('/parse-site-info', async (req, res) => {
  const obj = { title: '', des: '' };
  let p = '';
  try {
    const { url } = req.query;
    if (!isurl(url) || !validaString(url, 1, 1000)) {
      paramErr(res, req);
      return;
    }
    await uLog(req, `获取网站信息(${url})`);
    p = `${configObj.filepath}/siteinfo/${encodeURIComponent(url)}.json`;
    if (_f.c.existsSync(p)) {
      _success(res, 'ok', JSON.parse(await _f.p.readFile(p)));
      return;
    }
    const result = await axios({
      method: 'get',
      url,
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
    await _f.mkdir(`${configObj.filepath}/siteinfo`);
    await _f.p.writeFile(p, JSON.stringify(obj));
    _success(res, 'ok', obj);
  } catch (error) {
    if (p) {
      try {
        await _f.mkdir(`${configObj.filepath}/siteinfo`);
        await _f.p.writeFile(p, JSON.stringify(obj));
        // eslint-disable-next-line no-unused-vars
      } catch (error) {}
    }
    await errLog(req, error);
    _success(res, 'ok', obj);
  }
});
// 获取列表
route.get('/list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { id = '' } = req.query;
    if (!validaString(id, 0, 50, 1)) {
      paramErr(res, req);
      return;
    }
    let home = [];
    let list = bookSort(
      await queryData('booklist', '*', `WHERE state=? AND account=?`, [
        '0',
        account,
      ])
    );
    if (!id) {
      _success(res, 'ok', { list, home });
      return;
    }
    let bms = bookSort(
      await queryData(
        'bookmk',
        '*',
        `WHERE listid=? AND state=? AND account=?`,
        [id, '0', account]
      )
    );
    bms = bms.map((item, idx) => ({ ...item, num: idx }));
    list = list.map((item, idx) => ({ ...item, num: idx }));
    if (id == 'home') {
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
async function bookListMoveLocation(account, fromId, toId) {
  if (fromId == toId) return;
  const list = bookSort(
    await queryData('booklist', 'id,num', `WHERE account=? AND state=?`, [
      account,
      '0',
    ])
  );
  const fIdx = list.findIndex((item) => item.id === fromId),
    tIdx = list.findIndex((item) => item.id === toId);
  if (fIdx >= 0 && tIdx >= 0) {
    list.splice(tIdx, 0, ...list.splice(fIdx, 1));
    let ob = {
      where: 'id',
      key: 'num',
      data: [],
    };
    list.forEach((item, i) => {
      ob.data.push({
        id: item.id,
        num: i,
      });
    });
    await batchUpdateData('booklist', [ob]);
  }
}
// 分组移动
route.post('/move-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { fromId, toId } = req.body;
    if (!validaString(fromId, 1, 50, 1) || !validaString(toId, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    await bookListMoveLocation(account, fromId, toId);
    syncUpdateData(req, 'bookmark');
    _success(res, '移动分组位置成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
async function bookmarkMoveLocation(account, listId, fromId, toId) {
  if (fromId == toId) return;
  const bms = bookSort(
    await queryData(
      'bookmk',
      'id,num',
      `WHERE listid=? AND state=? AND account=?`,
      [listId, '0', account]
    )
  );
  const fIdx = bms.findIndex((item) => item.id === fromId),
    tIdx = bms.findIndex((item) => item.id === toId);
  if (fIdx >= 0 && tIdx >= 0) {
    bms.splice(tIdx, 0, ...bms.splice(fIdx, 1));
    let ob = {
      where: 'id',
      key: 'num',
      data: [],
    };
    bms.forEach((item, i) => {
      ob.data.push({
        id: item.id,
        num: i,
      });
    });
    await batchUpdateData('bookmk', [ob]);
  }
}
// 书签移动
route.post('/move-bmk', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { listId, fromId, toId } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !validaString(fromId, 1, 50, 1) ||
      !validaString(toId, 1, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    await bookmarkMoveLocation(account, listId, fromId, toId);
    syncUpdateData(req, 'bookmark');
    _success(res, '移动书签位置成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 新建分组
route.post('/add-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { name } = req.body;
    if (!validaString(name, 1, 100)) {
      paramErr(res, req);
      return;
    }
    const total =
      (
        await queryData('booklist', 'MAX(num)', `WHERE account=? AND state=?`, [
          account,
          '0',
        ])
      )[0]['MAX(num)'] || 0;
    const id = nanoid();
    await insertData('booklist', [
      {
        id,
        name,
        account,
        num: total + 1,
        share: 'n',
        state: '0',
      },
    ]);
    syncUpdateData(req, 'bookmark');
    _success(res, '添加分组成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除分组
route.post('/delete-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { ids } = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'booklist',
      { state: '1' },
      `WHERE id IN (${createFillString(ids.length)}) AND state=? AND account=?`,
      [...ids, '0', account]
    );
    syncUpdateData(req, 'bookmark');
    syncUpdateData(req, 'trash');
    _success(res, '删除分组成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 分组状态
route.post('/list-state', async (req, res) => {
  try {
    const { share, ids } = req.body;
    const { account } = req._hello.userinfo;
    if (
      !validationValue(share, ['y', 'n']) ||
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'booklist',
      { share },
      `WHERE id IN (${createFillString(ids.length)}) AND state=? AND account=?`,
      [...ids, '0', account]
    );
    syncUpdateData(req, 'bookmark');
    _success(res, `${share == 'y' ? '公开' : '锁定'}分组成功`)(
      req,
      ids.length,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});
// 书签logo
route.post('/change-logo', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { id, logo = '' } = req.body;
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(logo, 0, 100) ||
      (logo && !isImgFile(logo))
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'bookmk',
      { logo },
      `WHERE account=? AND id=? AND state=?`,
      [account, id, '0']
    );
    syncUpdateData(req, 'bookmark');
    _success(res, '更新书签LOGO成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑分组
route.post('/edit-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { id, name, toId = '' } = req.body;
    if (
      !validaString(name, 1, 100) ||
      !validaString(id, 1, 50, 1) ||
      !validaString(toId, 0, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'booklist',
      { name },
      `WHERE account=? AND state=? AND id=?`,
      [account, '0', id]
    );
    if (toId) {
      await bookListMoveLocation(account, id, toId);
    }
    syncUpdateData(req, 'bookmark');
    _success(res, '更新分组标题成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 添加书签
route.post('/add-bmk', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { bms, listId } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !_type.isArray(bms) ||
      bms.length == 0 ||
      bms.length > 200 ||
      !bms.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, 100) &&
          validaString(item.link, 1, 1000) &&
          isurl(item.link) &&
          validaString(item.des, 0, 300)
      )
    ) {
      paramErr(res, req);
      return;
    }
    if (listId !== 'home') {
      const bList = (
        await queryData(
          'booklist',
          'id',
          `WHERE account=? AND state=? AND id=?`,
          [account, '0', listId]
        )
      )[0];
      if (!bList) {
        paramErr(res, req);
        return;
      }
    }
    const total =
      (
        await queryData(
          'bookmk',
          'MAX(num)',
          `WHERE listid=? AND account=? AND state=?`,
          [listId, account, '0']
        )
      )[0]['MAX(num)'] || 0;
    bms = bms.map((item, i) => ({
      id: nanoid(),
      account,
      num: total + i + 1,
      listid: listId,
      state: '0',
      name: item.name,
      link: item.link,
      logo: '',
      des: item.des,
    }));
    await insertData('bookmk', bms);
    syncUpdateData(req, 'bookmark');
    _success(res, '添加书签成功')(req, `${listId}-${bms.length}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 编辑书签
route.post('/edit-bmk', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { listId, id, name, link, des, toId = '' } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !validaString(id, 1, 50, 1) ||
      !validaString(toId, 0, 50, 1) ||
      !validaString(name, 1, 100) ||
      !validaString(link, 1, 1000) ||
      !isurl(link) ||
      !validaString(des, 0, 300)
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'bookmk',
      { name, link, des },
      `WHERE account=? AND state=? AND id=? AND listid=?`,
      [account, '0', id, listId]
    );
    if (toId) {
      await bookmarkMoveLocation(account, listId, id, toId);
    }
    syncUpdateData(req, 'bookmark');
    _success(res, '更新书签信息成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 书签移动到分组
route.post('/bmk-to-list', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { ids, listId } = req.body;
    if (
      !validaString(listId, 1, 50, 1) ||
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    if (listId !== 'home') {
      const bList = await queryData(
        'booklist',
        'id',
        `WHERE account=? AND state=? AND id=?`,
        [account, '0', listId]
      );
      if (bList.length === 0) {
        paramErr(res, req);
        return;
      }
    }
    const total =
      (
        await queryData(
          'bookmk',
          'MAX(num)',
          `WHERE listid=? AND account=? AND state=?`,
          [listId, account, '0']
        )
      )[0]['MAX(num)'] || 0;
    const ob = [
      {
        key: 'num',
        where: 'id',
        data: [],
      },
      {
        key: 'listid',
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
        listid: listId,
      });
    });
    await batchUpdateData('bookmk', ob, `account="${account}" AND state="0"`);
    syncUpdateData(req, 'bookmark');
    _success(res, '书签移动分组成功')(req, `${ids.length}=>${listId}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除书签
route.post('/delete-bmk', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { ids } = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'bookmk',
      { state: '1' },
      `WHERE id IN (${createFillString(ids.length)}) AND state=? AND account=?`,
      [...ids, '0', account]
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
    const { account } = req._hello.userinfo;
    let rId = nanoid(),
      { id, title, valid, pass = '' } = req.body;
    valid = parseInt(valid);
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(title, 1, 100) ||
      !validaString(pass, 0, 20) ||
      isNaN(valid) ||
      valid > 999
    ) {
      paramErr(res, req);
      return;
    }
    const arr = bookSort(
      await queryData(
        'bookmk',
        '*',
        `WHERE listid=? AND state=? AND account=?`,
        [id, '0', account]
      )
    );
    if (arr.length === 0) {
      _err(res, '当前分组为空')(req, id, 1);
      return;
    }
    const obj = {
      id: rId,
      valid: valid == 0 ? 0 : Date.now() + valid * 24 * 60 * 60 * 1000,
      title,
      pass,
      data: JSON.stringify(arr),
      account,
      type: 'bookmk',
    };
    await insertData('share', [obj]);
    syncUpdateData(req, 'sharelist');
    _success(res, '分享分组成功', { id: rId })(req, obj.id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 保存分享
route.get('/save-share', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { id, name, pass = '' } = req.query;
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(name, 1, 100) ||
      !validaString(pass, 0, 20)
    ) {
      paramErr(res, req);
      return;
    }
    let arr = await queryData('share', '*', `WHERE id=? AND type=?`, [
      id,
      'bookmk',
    ]);
    if (arr.length === 0) {
      _err(res, '分享已被取消')(req, id, 1);
      return;
    }
    if (isValid(arr[0].valid)) {
      _err(res, '分享已过期')(req, id, 1);
      return;
    }
    if (arr[0].pass !== pass) {
      _err(res, '提取码错误')(req, id, 1);
      return;
    }
    arr = JSON.parse(arr[0].data);
    const total =
      (
        await queryData('booklist', 'MAX(num)', `WHERE account=? AND state=?`, [
          account,
          '0',
        ])
      )[0]['MAX(num)'] || 0;
    const pid = nanoid();
    await insertData('booklist', [
      {
        id: pid,
        name,
        account,
        num: total + 1,
        share: 'n',
        state: '0',
      },
    ]);
    arr = arr.map((item) => {
      const { name, link, des, num } = item;
      return {
        name,
        link,
        des,
        num,
        state: '0',
        id: nanoid(),
        listid: pid,
        account,
        logo: '',
      };
    });
    await insertData('bookmk', arr);
    syncUpdateData(req, 'bookmark');
    _success(res, '保存分享书签成功')(req, `${arr.length}=>${pid}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 导入
route.post('/import', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { list } = req.body;
    if (
      !_type.isArray(list) ||
      !list.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, 100) &&
          _type.isArray(item.list) &&
          item.list.every(
            (y) =>
              validaString(y.name, 1, 100) &&
              isurl(y.url) &&
              validaString(y.url, 1, 1000)
          )
      )
    ) {
      paramErr(res, req);
      return;
    }
    const total =
      (
        await queryData('booklist', 'MAX(num)', `WHERE account=? AND state=?`, [
          account,
          '0',
        ])
      )[0]['MAX(num)'] || 0;
    let count = 0;
    for (let i = 0; i < list.length; i++) {
      let { name, list: bms } = list[i];
      const listId = nanoid();
      await insertData('booklist', [
        {
          id: listId,
          name,
          account,
          num: total + 1 + i,
          share: 'n',
          state: '0',
        },
      ]);
      bms = bms.map((item, i) => ({
        id: nanoid(),
        account,
        num: i + 1,
        listid: listId,
        state: '0',
        name: item.name,
        link: item.url,
        logo: '',
        des: '',
      }));
      count += bms.length;
      await insertData('bookmk', bms);
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
    const bms = await queryData('bookmk', '*', `WHERE state=? AND account=?`, [
      '0',
      account,
    ]);
    let list = await queryData('booklist', '*', `WHERE state=? AND account=?`, [
      '0',
      account,
    ]);
    list.push({ id: 'home', name: '主页' });
    list = list.map((item) => {
      const children = bms.filter((y) => y.listid == item.id);
      return {
        name: item.name,
        children,
      };
    });
    _success(res, '导出书签成功', list)(req, bms.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
