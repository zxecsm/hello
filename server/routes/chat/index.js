const express = require('express'),
  route = express.Router();

const configObj = require('../../data/config');
const msg = require('../../data/msg');
const _f = require('../../utils/f');

const {
  insertData,
  updateData,
  queryData,
  deleteData,
  createSearchSql,
  getTableRowCount,
  batchDeleteData,
  fillString,
} = require('../../utils/sqlite');

const {
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  mergefile,
  validaString,
  validationValue,
  paramErr,
  getTimePath,
  createPagingData,
  isTextFile,
  isRoot,
  errLog,
  isurl,
  _type,
  getSplitWord,
  unique,
  getSongInfo,
} = require('../../utils/utils');
const { fieldLenght } = require('../config');
const { getSuffix } = require('../file/file');

const { getUserInfo } = require('../user/user');

const {
  getFriendDes,
  markAsRead,
  hdHelloMsg,
  saveChatMsg,
  sendNotifyMsg,
  sendNotificationsToCustomAddresses,
  becomeFriends,
  heperMsgAndForward,
  getChatUserList,
} = require('./chat');

// 收信接口
route.all('/:chat_id/sendMessage', async (req, res) => {
  try {
    const { method } = req._hello;

    let text = '';
    if (method === 'get') {
      text = req.query.text;
    } else if (method === 'post') {
      text = req.body.text;

      if (!text) {
        text = req.query.text;
      }
    }

    const { chat_id } = req.params;

    if (
      !validaString(chat_id, 1, fieldLenght.id, 1) ||
      !validaString(text, 1, fieldLenght.chatContent)
    ) {
      paramErr(res, req);
      return;
    }

    const user = (
      await queryData(
        'user',
        'account',
        `WHERE state = ? AND chat_id = ? AND receive_chat_state = ?`,
        [1, chat_id, 1]
      )
    )[0];

    if (!user) {
      _err(res, 'Hello助手未开启收信接口')(req);
      return;
    }

    await heperMsgAndForward(req, user.account, text);

    _success(res, '接收Hello助手消息成功')(req, text, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

//拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 设置备注
route.post('/setdes', async (req, res) => {
  try {
    const { account: acc, des = '' } = req.body;

    if (
      !validaString(acc, 1, fieldLenght.id, 1) ||
      !validaString(des, 0, fieldLenght.chatDes) ||
      acc === 'hello'
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (account === acc || acc === 'chang') {
      _err(res, '设置备注失败')(req, acc, 1);
      return;
    }

    const change = await updateData(
      'friends',
      { des, update_at: Date.now() },
      `WHERE friend = ? AND account = ?`,
      [acc, account]
    );

    if (change.changes === 0) {
      const user = await getUserInfo(acc, 'account');

      if (user) {
        await becomeFriends(account, acc);
      } else {
        _err(res, '用户不存在')(req, acc, 1);
        return;
      }
    }

    _success(res, '设置备注成功')(req, `${acc}-${des}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取备注
route.get('/getdes', async (req, res) => {
  try {
    const { account: acc } = req.query,
      { account } = req._hello.userinfo;

    if (
      !validaString(acc, 1, fieldLenght.id, 1) ||
      acc === account ||
      acc === 'chang' ||
      acc === 'hello'
    ) {
      paramErr(res, req);
      return;
    }

    const user = await getUserInfo(acc, 'username,hide,update_at');

    if (!user) {
      _err(res, '用户不存在')(req, acc, 1);
      return;
    }

    user.des = await getFriendDes(account, acc);

    user.online = true;

    if (user.hide === 1 || Date.now() - user.update_at >= 1000 * 30) {
      user.online = false;
    }

    const con = msg.getConnect()[acc];

    _success(res, 'ok', {
      username: user.username,
      des: user.des,
      online: user.online,
      os: con ? con.onlines.map((item) => item.os) : [],
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取消息
route.get('/read-msg', async (req, res) => {
  try {
    let { account: acc, type, flag = '', word = '' } = req.query;
    type = parseInt(type);

    if (
      !validaString(acc, 1, fieldLenght.id, 1) ||
      !validaString(flag, 0, fieldLenght.id, 1) ||
      !validaString(word, 0, fieldLenght.searchWord) ||
      isNaN(type) ||
      !validationValue(type, [0, 1, 2])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    // 标记已读
    await markAsRead(account, acc);

    let where = 'WHERE';
    const valArr = [];

    let offsetWhere = `WHERE create_at < (
          SELECT create_at FROM chat WHERE id = ?
      ) AND`;
    const offsetValArr = [flag];

    if (acc === 'chang') {
      where += ` flag = ?`;
      offsetWhere += ` flag = ?`;
      valArr.push('chang');
    } else {
      where += ` flag IN (?,?)`;
      offsetWhere += ` flag IN (?,?)`;
      valArr.push(`${account}-${acc}`, `${acc}-${account}`);
    }

    offsetValArr.push(...valArr);

    let splitWord = [];

    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);

      const searchSql = createSearchSql(curSplit, ['username', 'content']);

      where += ` AND (${searchSql.sql})`;
      offsetWhere += ` AND (${searchSql.sql})`;

      valArr.push(...searchSql.valArr);
      offsetValArr.push(...searchSql.valArr);
    }

    let offset = 0;
    if (flag) {
      offsetWhere += ' ORDER BY create_at ASC';
      offset = await getTableRowCount(
        'chat_user_view',
        offsetWhere,
        offsetValArr
      );
    }

    const pageSize = 100;
    let list = [];

    const fields = `logo,email,username,_from,_to,id,create_at,content,hash,size,type,flag`;
    if (type === 0) {
      //打开聊天框
      where += ` ORDER BY create_at DESC LIMIT ?`;
      valArr.push(pageSize);
      list = await queryData('chat_user_view', fields, where, valArr);
      list.reverse();
    } else if (type === 1) {
      //向上滚动
      if (offset <= 0) {
        list = [];
      } else {
        offset = offset - pageSize <= 0 ? 0 : offset - pageSize;
        where += ` ORDER BY create_at ASC LIMIT ? OFFSET ?`;
        valArr.push(pageSize, offset);
        list = await queryData('chat_user_view', fields, where, valArr);
      }
    } else if (type === 2) {
      //新消息
      where += ` ORDER BY create_at ASC LIMIT ? OFFSET ?`;
      valArr.push(pageSize, offset + 1);
      list = await queryData('chat_user_view', fields, where, valArr);
    }

    const accIds = unique(list.map((item) => item._from));
    const friends = await queryData(
      'friends',
      'friend,des',
      `WHERE account = ? AND friend IN (${fillString(accIds.length)})`,
      [account, ...accIds]
    );

    list = list.map((item) => {
      item.des = '';
      const f = friends.find((y) => y.friend === item._from);
      if (f) {
        item.des = f.des;
      }
      return item;
    });

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 文件过期
route.get('/expired', async (req, res) => {
  try {
    const { hash } = req.query;

    if (!validaString(hash, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const file = (await queryData('upload', 'url', `WHERE id = ?`, [hash]))[0];

    if (file) {
      const u = `${configObj.filepath}/upload/${file.url}`;

      if (_f.c.existsSync(u)) {
        _success(res, 'ok', {
          isText: isTextFile(u),
        });
        return;
      }
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 接收信息
const chatType = {
  text: '文字',
  image: '图片',
  file: '文件',
  voice: '语音',
};

route.post('/send-msg', async (req, res) => {
  try {
    let { to, content } = req.body;

    if (
      !validaString(to, 1, fieldLenght.id, 1) ||
      !validaString(content, 1, fieldLenght.chatContent)
    ) {
      paramErr(res, req);
      return;
    }

    let log = to;
    if (to !== 'chang' && to !== 'hello') {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        _err(res, '用户不存在')(req, to, 1);
        return;
      }

      log = `${user.username}-${user.account}`;
    }

    const obj = {
      _to: to,
      content,
      type: 'text',
    };

    const { account } = req._hello.userinfo;

    const msg = await saveChatMsg(account, obj);
    await sendNotifyMsg(req, obj._to, 'addmsg', obj);

    if (to === 'hello') {
      await hdHelloMsg(req, content, obj.type);
    }

    sendNotificationsToCustomAddresses(req, msg).catch((err) => {
      errLog(req, `发送通知到自定义地址失败(${err})`);
    });

    _success(res, `发送${chatType[obj.type]}消息成功`)(
      req,
      `${content}=>${log}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 转发消息
route.post('/forward', async (req, res) => {
  try {
    const { to, id } = req.body;

    if (
      !validaString(to, 1, fieldLenght.id, 1) ||
      !validaString(id, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    let log = to;
    if (to !== 'chang' && to !== 'hello') {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        _err(res, '用户不存在')(req, to, 1);
        return;
      }

      log = `${user.username}-${user.account}`;
    }

    const chat = (await queryData('chat', '*', `WHERE id = ?`, [id]))[0];

    if (!chat) {
      _err(res, '转发的信息不存在')(req, id, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const { flag, hash } = chat;

    if (flag !== 'chang' && !flag.includes(account)) {
      _err(res, '无权转发')(req, id, 1);
      return;
    }

    chat._to = to;

    if (hash) {
      await updateData('upload', { update_at: Date.now() }, `WHERE id = ?`, [
        hash,
      ]);
    }

    delete chat.id;

    const msg = await saveChatMsg(account, chat);
    await sendNotifyMsg(req, to, 'addmsg', chat);

    if (to === 'hello') {
      await hdHelloMsg(req, chat.content, chat.type);
    }

    sendNotificationsToCustomAddresses(req, msg).catch((err) => {
      errLog(req, `发送通知到自定义地址失败(${err})`);
    });

    _success(res, '信息转发成功')(req, `${msg.content}=>${log}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 未读消息
route.get('/news', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const group = await getTableRowCount(
      'friends',
      `WHERE account = ? AND read = ? AND friend = ?`,
      [account, 0, 'chang']
    );

    const friend = await getTableRowCount(
      'friends',
      `WHERE account = ? AND read = ? AND friend != ?`,
      [account, 0, 'chang']
    );

    _success(res, 'ok', {
      group,
      friend,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除消息
route.post('/delete-msg', async (req, res) => {
  try {
    const { id = '', to } = req.body;

    if (
      !validaString(id, 0, fieldLenght.id, 1) ||
      !validaString(to, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let log = to;
    if (to !== 'chang' && to !== 'hello') {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        _err(res, '用户不存在')(req, to, 1);
        return;
      }

      log = `${user.username}-${user.account}`;
    }

    if (id) {
      await deleteData('chat', `WHERE id = ? AND _from = ?`, [id, account]);
      await sendNotifyMsg(req, to, 'del', id);

      _success(res, '撤回消息成功')(req, `${id}=>${log}`, 1);
    } else {
      if (to === 'chang') {
        if (isRoot(req)) {
          await batchDeleteData('chat', 'id', `WHERE _to = ?`, ['chang']);

          await sendNotifyMsg(req, to, 'clear');

          _success(res, '清空消息成功')(req, log, 1);
        } else {
          _err(res, '无权清空消息')(req, to, 1);
        }
      } else {
        await batchDeleteData('chat', 'id', `WHERE flag = ? OR flag = ?`, [
          `${account}-${to}`,
          `${to}-${account}`,
        ]);

        await sendNotifyMsg(req, to, 'clear');

        _success(res, '清空消息成功')(req, log, 1);
      }
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 抖一下
route.post('/shake-msg', async (req, res) => {
  try {
    const { to } = req.body;
    const { account } = req._hello.userinfo;

    if (
      !validaString(to, 1, fieldLenght.id, 1) ||
      to === 'chang' ||
      to === account ||
      to === 'hello'
    ) {
      paramErr(res, req);
      return;
    }

    const user = await getUserInfo(to, 'hide,update_at,username');

    if (!user) {
      _err(res, '用户不存在')(req, to, 1);
      return;
    }

    if (user.hide === 1 || Date.now() - user.update_at > 1000 * 30) {
      _err(res, '对方已离线')(req, to, 1);
      return;
    }

    await sendNotifyMsg(req, to, 'shake');

    _success(res, '抖了一下')(req, `${user.username}-${to}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 成员
route.get('/user-list', async (req, res) => {
  try {
    let { pageNo = 1, pageSize = 10 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLenght.chatPageSize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const total = await getTableRowCount('user', `WHERE state = ?`, [1]);

    const offset = (pageNo - 1) * pageSize;

    const users = await getChatUserList(account, pageSize, offset);

    const n = Date.now();
    const cons = msg.getConnect();

    const list = users.map((u) => {
      const {
        username,
        account: acc,
        update_at,
        logo,
        hide,
        email,
        des,
        read,
      } = u;

      const con = cons[acc];

      const obj = {
        username,
        account: acc,
        logo,
        online: 1,
        des: des === null ? '' : des,
        email,
        os: con ? con.onlines.map((item) => item.os) : [],
        read: read === null ? 1 : read,
      };

      if (
        (hide === 1 || n - update_at > 1000 * 30) &&
        account !== acc &&
        acc !== 'hello'
      ) {
        obj.online = 0;
      }

      return obj;
    });

    _success(res, 'ok', {
      ...createPagingData([...Array(total)], pageSize, pageNo),
      data: list,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 接收文件
route.post('/up', async (req, res) => {
  try {
    const { name, HASH } = req.query;

    if (
      !validaString(name, 1, 20, 1) ||
      !/^_[0-9]+$/.test(name) ||
      !validaString(HASH, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const path = `${configObj.filepath}/tem/${account}_${HASH}`;

    await _f.mkdir(path);
    await receiveFiles(req, path, name, 50);

    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 接收语音
route.post('/up-voice', async (req, res) => {
  try {
    const { HASH, name, to } = req.query;

    if (
      !/\.wav$/.test(name) ||
      !validaString(name, 1, fieldLenght.filename) ||
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(to, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let log = to;
    if (to !== 'chang' && to !== 'hello') {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        _err(res, '用户不存在')(req, to, 1);
        return;
      }

      log = `${user.username}-${user.account}`;
    }

    const time = Date.now();

    const timePath = getTimePath(time);
    const tDir = `${configObj.filepath}/upload/${timePath}`;
    const tName = `${HASH}.${getSuffix(name)[1]}`;

    await _f.mkdir(tDir);
    await receiveFiles(req, tDir, tName, 3);

    const fobj = {
      id: HASH,
      url: `${timePath}/${tName}`,
      update_at: time,
    };

    const { duration } = await getSongInfo(`${tDir}/${tName}`);

    const obj = {
      _to: to,
      content: '语音',
      hash: HASH,
      type: 'voice',
      size: duration,
    };

    const change = await updateData(
      'upload',
      { update_at: time, url: fobj.url },
      `WHERE id = ?`,
      [HASH]
    );

    if (change.changes === 0) {
      await insertData('upload', [fobj]);
    }

    const msg = await saveChatMsg(account, obj);
    await sendNotifyMsg(req, obj._to, 'addmsg', obj);

    if (to === 'hello') {
      await hdHelloMsg(req, obj.content, obj.type);
    }

    sendNotificationsToCustomAddresses(req, msg).catch((err) => {
      errLog(req, `发送通知到自定义地址失败(${err})`);
    });

    _success(res, '发送语音消息成功', fobj)(req, `${obj.content}=>${log}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 合并文件
route.post('/merge', async (req, res) => {
  try {
    let { HASH, count, name, to, type } = req.body;
    count = parseInt(count);

    if (
      !validaString(name, 1, fieldLenght.filename) ||
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(to, 1, fieldLenght.id, 1) ||
      !validationValue(type, ['image', 'file']) ||
      isNaN(count) ||
      count < 1
    ) {
      paramErr(res, req);
      return;
    }

    let log = to;
    if (to !== 'chang' && to !== 'hello') {
      let user = await getUserInfo(to, 'account,username');

      if (!user) {
        _err(res, '用户不存在')(req, to, 1);
        return;
      }

      log = `${user.username}-${user.account}`;
    }

    const { account } = req._hello.userinfo;

    const suffix = getSuffix(name)[1];
    const time = Date.now();
    const timePath = getTimePath(time);

    const tDir = `${configObj.filepath}/upload/${timePath}`;
    const tName = `${HASH}${suffix ? `.${suffix}` : ''}`;

    await _f.mkdir(tDir);
    await mergefile(
      count,
      `${configObj.filepath}/tem/${account}_${HASH}`,
      `${tDir}/${tName}`
    );

    const fobj = {
      id: HASH,
      url: `${timePath}/${tName}`,
      update_at: time,
    };

    const stat = await _f.p.stat(`${tDir}/${tName}`);

    const obj = {
      _to: to,
      content: name,
      hash: HASH,
      type,
      size: stat.size,
    };

    const change = await updateData(
      'upload',
      { update_at: time, url: fobj.url },
      `WHERE id = ?`,
      [HASH]
    );

    if (change.changes === 0) {
      await insertData('upload', [fobj]);
    }

    if (type === 'image') {
      obj.content = tName;
    }

    const msg = await saveChatMsg(account, obj);
    await sendNotifyMsg(req, obj._to, 'addmsg', obj);

    if (to === 'hello') {
      await hdHelloMsg(req, obj.content, type);
    }

    sendNotificationsToCustomAddresses(req, msg).catch((err) => {
      errLog(req, `发送通知到自定义地址失败(${err})`);
    });

    _success(res, `发送${chatType[type]}消息成功`)(
      req,
      `${obj.content}=>${log}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 断点续传
route.post('/breakpoint', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let path = `${configObj.filepath}/tem/${account}_${HASH}`,
      arr = [];

    if (_f.c.existsSync(path)) {
      arr = await _f.p.readdir(path);
    }

    _success(res, 'ok', arr);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 检查上传文件是否重复
route.post('/repeat', async (req, res) => {
  try {
    const { HASH, type, name, to } = req.body;

    if (
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(name, 1, fieldLenght.filename) ||
      !validationValue(type, ['image', 'file']) ||
      !validaString(to, 1, fieldLenght.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const upload = (
      await queryData('upload', 'url', `WHERE id = ?`, [HASH])
    )[0];

    if (upload) {
      const p = `${configObj.filepath}/upload/${upload.url}`;

      if (_f.c.existsSync(p)) {
        let log = to;
        if (to !== 'chang' && to !== 'hello') {
          const user = await getUserInfo(to, 'account,username');

          if (!user) {
            _err(res, '用户不存在')(req, to, 1);
            return;
          }

          log = `${user.username}-${user.account}`;
        }

        await updateData('upload', { update_at: Date.now() }, `WHERE id = ?`, [
          HASH,
        ]);

        const suffix = getSuffix(name)[1];

        const tName = `${HASH}${suffix ? `.${suffix}` : ''}`;

        const stat = await _f.p.stat(p);

        const obj = {
          _to: to,
          content: name,
          hash: HASH,
          type,
          size: stat.size,
        };

        if (type === 'image') {
          obj.content = tName;
        }

        const { account } = req._hello.userinfo;

        const msg = await saveChatMsg(account, obj);
        await sendNotifyMsg(req, obj._to, 'addmsg', obj);

        if (to === 'hello') {
          await hdHelloMsg(req, obj.content, type);
        }

        sendNotificationsToCustomAddresses(req, msg).catch((err) => {
          errLog(req, `发送通知到自定义地址失败(${err})`);
        });

        _success(res, `发送${chatType[type]}消息成功`)(
          req,
          `${obj.content}=>${log}`,
          1
        );
        return;
      }
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 配置转发消息接口
route.post('/forward-msg-link', async (req, res) => {
  try {
    const { state, type, link = '', header = {}, body = {} } = req.body;

    if (
      !validationValue(state, [1, 0]) ||
      !validationValue(type, ['get', 'post']) ||
      !validaString(link, 0, fieldLenght.url) ||
      !_type.isObject(header) ||
      !_type.isObject(body) ||
      (state === 1 && !isurl(link))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'user',
      {
        forward_msg_state: state,
        forward_msg_link: JSON.stringify({
          type,
          link,
          body,
          header,
        }),
      },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    _success(res, `${state === 1 ? '配置' : '关闭'}转发消息接口成功`)(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

module.exports = route;
