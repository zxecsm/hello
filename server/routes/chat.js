const express = require('express'),
  route = express.Router();

const configObj = require('../data/config');
const msg = require('../data/msg');
const _f = require('../utils/f');
const {
  insertData,
  updateData,
  queryData,
  deleteData,
} = require('../utils/sqlite');
const {
  formatDate,
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  mergefile,
  nanoid,
  validaString,
  validationValue,
  paramErr,
  getWordCount,
  getTimePath,
  getSuffix,
  hdChatSendMsg,
  createPagingData,
  isTextFile,
  isRoot,
  becomeFriends,
  saveChatMsg,
  helloHelperMsg,
  uLog,
  forwardMsg,
  errLog,
  isurl,
  _type,
  heperMsgAndForward,
  getSplitWord,
} = require('../utils/utils');
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
    if (!validaString(chat_id, 1, 50, 1) || !validaString(text, 1, 2500)) {
      paramErr(res, req);
      return;
    }
    const user = (
      await queryData(
        'user',
        'account',
        `WHERE state=? AND chat_id=? AND receive_chat_state=?`,
        ['0', chat_id, 'y']
      )
    )[0];
    if (!user) {
      _err(res, 'Hello助手未开启收信接口，或接口已失效')(req);
      return;
    }
    await heperMsgAndForward(req, user.account, text);
    _success(res, '接收Hello助手消息成功')(req, msg.id, 1);
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
    const { account } = req._hello.userinfo;
    const { acc, des = '' } = req.body;
    if (!validaString(acc, 1, 50, 1) || !validaString(des, 0, 20)) {
      paramErr(res, req);
      return;
    }
    if (account === acc || acc === 'chang' || acc === 'hello') {
      _err(res, '设置备注失败')(req, acc, 1);
      return;
    }
    const time = Date.now();
    const change = await updateData(
      'friends',
      { des, time },
      `WHERE friend=? AND account=?`,
      [acc, account]
    );
    if (change.changes == 0) {
      const user = (
        await queryData('user', 'account', `WHERE state = ? AND account = ?`, [
          '0',
          acc,
        ])
      )[0];
      if (user) {
        await becomeFriends(account, acc);
      } else {
        _err(res, '用户不存在')(req, acc, 1);
        return;
      }
    }
    _success(res, '设置备注成功')(req, acc, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 获取备注
route.get('/getdes', async (req, res) => {
  try {
    const { acc } = req.query,
      { account } = req._hello.userinfo;
    if (
      !validaString(acc, 1, 50, 1) ||
      acc == account ||
      acc == 'chang' ||
      acc === 'hello'
    ) {
      paramErr(res, req);
      return;
    }
    const user = (
      await queryData(
        'user',
        'username,hide,time',
        `WHERE state = ? AND account = ?`,
        ['0', acc]
      )
    )[0];
    if (!user) {
      _err(res, '用户不存在')(req, acc, 1);
      return;
    }
    user.des = '';
    const fArr = await queryData('friends', '*', `WHERE account=?`, [account]);
    const f = fArr.find((item) => item.friend == acc);
    if (f) {
      user.des = f.des;
    }
    user.online = true;
    if (user.hide === 'y' || Date.now() - user.time >= 1000 * 30) {
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
    const account = req._hello.userinfo.account;
    let { acc, type, flag = '', word = '' } = req.query;
    type = parseInt(type);
    if (
      !validaString(acc, 1, 50, 1) ||
      !validaString(flag, 0, 50, 1) ||
      !validaString(word, 0, 100) ||
      isNaN(type) ||
      !validationValue(type, [0, 1, 2])
    ) {
      paramErr(res, req);
      return;
    }
    let msgs = [];
    let list = [];
    // 标记已读
    if (account !== acc) {
      const time = Date.now();
      const change = await updateData(
        'friends',
        { islooK: 'y', time },
        `WHERE friend=? AND account=?`,
        [acc, account]
      );
      if (change.changes == 0) {
        if (acc === 'chang') {
          await insertData('friends', [
            {
              account,
              friend: 'chang',
              time,
              islooK: 'y',
              des: '',
            },
          ]);
        } else {
          if (acc === 'hello') {
            await becomeFriends(account, acc);
          } else {
            const user = (
              await queryData(
                'user',
                'account',
                `WHERE state = ? AND account = ?`,
                ['0', acc]
              )
            )[0];
            if (user) {
              await becomeFriends(account, acc);
            }
          }
        }
      }
    }
    //读取消息
    if (acc === 'chang') {
      msgs = await queryData('getchat', '*', `WHERE flag=?`, ['chang']);
    } else {
      msgs = await queryData('getchat', '*', `WHERE flag in(?,?)`, [
        `${account}-${acc}`,
        `${acc}-${account}`,
      ]);
    }
    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);
      msgs = msgs.filter((item) => {
        const { name, data, date } = item;
        const str = name + data + date;
        return getWordCount(splitWord, str) > 0;
      });
    }
    let flagStr = '';
    msgs = msgs.map((item) => {
      const d =
        item.date ||
        formatDate({ template: '{0}-{1}-{2}', timestamp: item.time });
      if (d === flagStr) {
        item.showTime = 'n';
      } else {
        item.showTime = 'y';
      }
      flagStr = d;
      return item;
    });
    // 获取消息
    if (msgs.length > 0) {
      if (+type === 0) {
        //打开聊天框
        list = msgs.slice(-50);
      } else if (+type === 1) {
        //向上滚动
        const idx = msgs.findIndex((v) => v.id === flag);
        if (idx < 0) {
          list = [];
        } else {
          const st = idx - 50 <= 0 ? 0 : idx - 50;
          list = msgs.slice(st, idx);
        }
      } else if (+type === 2) {
        //新消息
        const idx = msgs.findIndex((v) => v.id === flag);
        if (msgs.length - 1 == idx) {
          list = [];
        } else {
          list = msgs.slice(idx + 1);
        }
      }
      const friends = await queryData('friends', '*', `WHERE account=?`, [
        account,
      ]);
      list = list.map((item) => {
        item.des = '';
        const f = friends.find((y) => y.friend == item._from);
        if (f) {
          item.des = f.des;
        }
        return item;
      });
      _success(res, 'ok', list);
    } else {
      _success(res, 'ok', []);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 文件过期
route.get('/expired', async (req, res) => {
  try {
    const { hash } = req.query;
    if (!validaString(hash, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const file = (await queryData('upload', 'url', `WHERE id=?`, [hash]))[0];
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
async function hdHelloMsg(req, data, type) {
  try {
    let { receive_chat_state, chat_id, account } = req._hello.userinfo;
    const stopMsgText =
      '接口为关闭状态\n\n回复 start 开启接口 或 update 开启并更新接口';
    let msgText = `收信接口：\nGET：/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;
    const text = data.trim();
    if (type === 'text' && text === 'update') {
      chat_id = nanoid();
      await updateData(
        'user',
        { receive_chat_state: 'y', chat_id },
        `WHERE account=? AND state=?`,
        [account, '0']
      );
      msgText = `收信接口：\nGET：/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;
      await uLog(req, `更新收信接口成功(${chat_id})`);
    } else if (type === 'text' && text === 'stop') {
      await updateData(
        'user',
        { receive_chat_state: 'n' },
        `WHERE account=? AND state=?`,
        [account, '0']
      );
      msgText = stopMsgText;
      await uLog(req, `关闭收信接口成功(${chat_id})`);
    } else if (type === 'text' && text === 'start') {
      await updateData(
        'user',
        { receive_chat_state: 'y' },
        `WHERE account=? AND state=?`,
        [account, '0']
      );
      await uLog(req, `开启收信接口成功(${chat_id})`);
    } else {
      if (receive_chat_state === 'n') {
        msgText = stopMsgText;
      }
      await uLog(req, `查看收信接口成功(${chat_id})`);
    }
    await helloHelperMsg(account, msgText);
  } catch (error) {
    throw error;
  }
}
// 接收信息
const chatType = {
  text: '文字',
  image: '图片',
  file: '文件',
  voice: '语音',
};
route.post('/send-msg', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { _to, data, size = '', hash = '', type } = req.body;
    if (
      !validaString(_to, 1, 50, 1) ||
      !validaString(data, 1, 2500) ||
      !validaString(hash, 0, 50, 1) ||
      !validationValue(type, ['text', 'image', 'file', 'voice']) ||
      !validaString(size, 0, 20)
    ) {
      paramErr(res, req);
      return;
    }
    if (_to !== 'chang' && _to !== 'hello') {
      const user = (
        await queryData('user', 'account', `WHERE state = ? AND account = ?`, [
          '0',
          _to,
        ])
      )[0];
      if (!user) {
        _err(res, '用户不存在')(req, _to, 1);
        return;
      }
    }
    const obj = {
      _to,
      data,
      size,
      hash,
      type,
    };
    const msg = await saveChatMsg(account, obj);
    await hdChatSendMsg(req, obj._to, 'addmsg', obj);
    if (_to === 'hello') {
      await hdHelloMsg(req, data, type);
    }
    forwardMsg(req, msg).catch((err) => {
      errLog(req, `转发信息失败(${err})`);
    });
    _success(res, `发送${chatType[type]}消息成功`)(req, `${msg.id}=>${_to}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 转发消息
route.post('/forward', async (req, res) => {
  try {
    const { to, id } = req.body;
    if (!validaString(to, 1, 50, 1) || !validaString(id, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    if (to !== 'chang' && to !== 'hello') {
      const user = (
        await queryData('user', 'account', `WHERE state = ? AND account = ?`, [
          '0',
          to,
        ])
      )[0];
      if (!user) {
        _err(res, '用户不存在')(req, to, 1);
        return;
      }
    }
    const chat = (await queryData('chat', '*', `WHERE id=?`, [id]))[0];
    if (!chat) {
      _err(res, '转发的信息不存在')(req, id, 1);
      return;
    }
    const { flag, hash } = chat;
    if (flag !== 'chang' && !flag.includes(account)) {
      _err(res, '无权转发')(req, id, 1);
      return;
    }
    chat._to = to;
    if (hash) {
      await updateData('upload', { time: Date.now() }, `WHERE id=?`, [hash]);
    }
    const msg = await saveChatMsg(account, chat);
    await hdChatSendMsg(req, to, 'addmsg', chat);
    if (to === 'hello') {
      await hdHelloMsg(req, chat.data, chat.type);
    }
    forwardMsg(req, msg).catch((err) => {
      errLog(req, `转发信息失败(${err})`);
    });
    _success(res, '信息转发成功')(req, `${msg.id}=>${to}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 未读消息
route.get('/news', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const fList = await queryData('friends', '*', `WHERE account=?`, [account]);
    _success(res, 'ok', {
      group: fList.some(
        (item) => item.friend === 'chang' && item.islook === 'n'
      )
        ? 1
        : 0,
      friend: fList.some(
        (item) => item.friend !== 'chang' && item.islook === 'n'
      )
        ? 1
        : 0,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除消息
route.post('/delete-msg', async (req, res) => {
  try {
    const { id = '', acc } = req.body;
    if (!validaString(id, 0, 50, 1) || !validaString(acc, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    if (id) {
      await deleteData('chat', `WHERE id=? AND _from=?`, [id, account]);
      await hdChatSendMsg(req, acc, 'del', id);
      _success(res, '撤回消息成功')(req, `${id}=>${acc}`, 1);
    } else {
      if (acc === 'chang') {
        if (isRoot(req)) {
          await deleteData('chat', `WHERE _to=?`, ['chang']);
          await hdChatSendMsg(req, acc, 'clear');
          _success(res);
        } else {
          _err(res, '无权清空消息')(req, acc, 1);
        }
      } else {
        await deleteData('chat', `WHERE flag in(?,?)`, [
          `${account}-${acc}`,
          `${acc}-${account}`,
        ]);
        await hdChatSendMsg(req, acc, 'clear');
        _success(res, '清空消息成功')(req, acc, 1);
      }
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 抖一下
route.post('/shake-msg', async (req, res) => {
  try {
    const { acc } = req.body;
    const { account } = req._hello.userinfo;
    if (!validaString(acc, 1, 50, 1) || acc === 'chang' || acc === account) {
      paramErr(res, req);
      return;
    }
    const user = (
      await queryData('user', 'hide,time', `WHERE state = ? AND account = ?`, [
        '0',
        acc,
      ])
    )[0];
    if (!user) {
      _err(res, '用户不存在')(req, acc, 1);
      return;
    }
    if (user.hide === 'y' || Date.now() - user.time > 1000 * 30) {
      _err(res, '对方已离线')(req, acc, 1);
      return;
    }
    await hdChatSendMsg(req, acc, 'shake');
    _success(res, '抖了一下')(req, acc, 1);
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
      pageSize > 100
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const list = [],
      fList = await queryData('friends', '*', `WHERE account=?`, [account]); //用户所在的所有聊天室
    const users = await queryData('user', '*', `WHERE state = ?`, ['0']);
    const n = Date.now();
    const cons = msg.getConnect();
    users.push({
      account: 'hello',
      username: 'Hello助手',
      logo: '',
    });
    users.forEach((w) => {
      //遍历所有用户
      const { username, account: acc, time, logo, hide, email } = w;
      const con = cons[acc];
      const obj = {
        username,
        account: acc,
        logo,
        online: 'y',
        des: '',
        email,
        time: 0,
        os: con ? con.onlines.map((item) => item.os) : [],
      };
      if (
        (hide === 'y' || n - time > 1000 * 30) &&
        account !== acc &&
        acc !== 'hello'
      ) {
        obj.online = 'n';
      }
      if (account === acc) {
        obj.time = n;
      }
      const f = fList.find((item) => item.friend == acc);
      if (f) {
        obj.islook = f.islook;
        obj.time = f.time;
        obj.des = f.des;
      }
      list.push(obj);
    });
    list.sort((a, b) => b.time - a.time);
    _success(res, 'ok', createPagingData(list, pageSize, pageNo));
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
      !validaString(HASH, 1, 50, 1)
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
    const { HASH, name, _to, size = '' } = req.query;
    if (
      !/\.wav$/.test(name) ||
      !validaString(name, 1, 255) ||
      !validaString(HASH, 1, 50, 1) ||
      !validaString(_to, 1, 50, 1) ||
      !validaString(size, 0, 20)
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    if (_to !== 'chang' && _to !== 'hello') {
      const user = (
        await queryData('user', 'account', `WHERE state = ? AND account = ?`, [
          '0',
          _to,
        ])
      )[0];
      if (!user) {
        _err(res, '用户不存在')(req, _to, 1);
        return;
      }
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
      time,
    };
    const change = await updateData(
      'upload',
      { time, url: fobj.url },
      `WHERE id=?`,
      [HASH]
    );
    if (change.changes == 0) {
      await insertData('upload', [fobj]);
    }
    const obj = {
      _to,
      data: '语音',
      size,
      hash: HASH,
      type: 'voice',
    };
    const msg = await saveChatMsg(account, obj);
    await hdChatSendMsg(req, obj._to, 'addmsg', obj);
    if (_to === 'hello') {
      await hdHelloMsg(req, obj.data, obj.type);
    }
    forwardMsg(req, msg).catch((err) => {
      errLog(req, `转发信息失败(${err})`);
    });
    _success(res, '发送语音消息成功', fobj)(req, `${msg.id}=>${obj._to}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 合并文件
route.post('/merge', async (req, res) => {
  try {
    let { HASH, count, name, _to, size = '', type } = req.body;
    count = parseInt(count);
    if (
      !validaString(name, 1, 255) ||
      !validaString(HASH, 1, 50, 1) ||
      !validaString(_to, 1, 50, 1) ||
      !validationValue(type, ['image', 'file']) ||
      !validaString(size, 0, 20) ||
      isNaN(count) ||
      count < 1
    ) {
      paramErr(res, req);
      return;
    }
    if (_to !== 'chang' && _to !== 'hello') {
      let user = (
        await queryData('user', 'account', `WHERE state = ? AND account = ?`, [
          '0',
          _to,
        ])
      )[0];
      if (!user) {
        _err(res, '用户不存在')(req, _to, 1);
        return;
      }
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
      time,
    };
    const change = await updateData(
      'upload',
      { time, url: fobj.url },
      `WHERE id=?`,
      [HASH]
    );
    if (change.changes == 0) {
      await insertData('upload', [fobj]);
    }
    const obj = {
      _to,
      data: name,
      size,
      hash: HASH,
      type,
    };
    const msg = await saveChatMsg(account, obj);
    await hdChatSendMsg(req, obj._to, 'addmsg', obj);
    if (_to === 'hello') {
      await hdHelloMsg(req, obj.data, type);
    }
    forwardMsg(req, msg).catch((err) => {
      errLog(req, `转发信息失败(${err})`);
    });
    _success(res, `发送${chatType[type]}消息成功`)(
      req,
      `${msg.id}=>${obj._to}`,
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
    if (!validaString(HASH, 1, 50, 1)) {
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
    const { HASH } = req.body;
    if (!validaString(HASH, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const upload = (await queryData('upload', '*', `WHERE id=?`, [HASH]))[0];
    if (upload) {
      if (_f.c.existsSync(`${configObj.filepath}/upload/${upload.url}`)) {
        await updateData('upload', { time: Date.now() }, `WHERE id=?`, [HASH]);
        _success(res, 'ok', upload);
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
      !validationValue(state, ['y', 'n']) ||
      !validationValue(type, ['get', 'post']) ||
      !validaString(link, 0, 200) ||
      !_type.isObject(header) ||
      !_type.isObject(body) ||
      (state === 'y' && !isurl(link))
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
      `WHERE account=? AND state=?`,
      [account, '0']
    );
    _success(res, `${state === 'y' ? '配置' : '关闭'}转发消息接口成功`)(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
