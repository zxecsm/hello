import axios from 'axios';
import _connect from '../../utils/connect.js';

import { db } from '../../utils/sqlite.js';

import {
  uLog,
  concurrencyTasks,
  tplReplace,
  isurl,
  replaceObjectValue,
  errLog,
  batchTask,
  parseObjectJson,
  getOrigin,
  writelog,
} from '../../utils/utils.js';

import { getUserInfo } from '../user/user.js';
import { _d } from '../../data/data.js';
import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';
import { _delDir, cleanEmptyDirectories } from '../file/file.js';
import _path from '../../utils/path.js';
import nanoid from '../../utils/nanoid.js';

// 获取好友信息
export async function getFriendInfo(mAcc, fAcc, fields = '*') {
  return await db('friends')
    .select(fields)
    .where({ account: mAcc, friend: fAcc })
    .findOne();
}

// 标记为已读
export async function markAsRead(mAcc, fAcc) {
  const change = await db('friends')
    .where({ friend: fAcc, account: mAcc })
    .update({ read: 1 });

  // 不是好友，变为好友
  if (change.changes === 0) {
    await becomeFriends(mAcc, fAcc);
  }
}

// 助手回复响应消息
export async function hdHelloMsg(req, data, type) {
  let { receive_chat_state, chat_id, account } = req._hello.userinfo;
  const origin = getOrigin(req);

  const stopMsgText =
    '接口为关闭状态\n\n回复 start 开启接口 或 update 开启并更新接口';

  let msgText = `收信接口：\nGET：${origin}/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：${origin}/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;

  const text = data.trim();

  if (type === 'text' && text === 'update') {
    chat_id = nanoid();

    await db('user')
      .where({ account, state: 1 })
      .update({ receive_chat_state: 1, chat_id });

    msgText = `收信接口：\nGET：${origin}/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：${origin}/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;

    await uLog(req, `更新收信接口成功(${chat_id})`);
  } else if (type === 'text' && text === 'stop') {
    await db('user')
      .where({ account, state: 1 })
      .update({ receive_chat_state: 0 });

    msgText = stopMsgText;

    await uLog(req, `关闭收信接口成功(${chat_id})`);
  } else if (type === 'text' && text === 'start') {
    await db('user')
      .where({ account, state: 1 })
      .update({ receive_chat_state: 1 });

    await uLog(req, `开启收信接口成功(${chat_id})`);
  } else {
    if (receive_chat_state === 0) {
      msgText = stopMsgText;
    }

    await uLog(req, `查看收信接口成功(${chat_id})`);
  }

  await helloHelperMsg(account, msgText);
}

// 保存聊天消息
export async function saveChatMsg(account, obj) {
  obj._from = account;

  obj.flag = obj._to === 'chang' ? 'chang' : `${account}-${obj._to}`;

  if (!obj.id) obj.id = nanoid();
  if (!obj.create_at) obj.create_at = Date.now();
  await db('chat').insert(obj);

  return obj;
}

// 推送通知
export async function sendNotifyMsg(req, to, flag, msgData) {
  const { account, logo, username } = req._hello.userinfo;

  const notifyObj = {
    type: 'chat',
    data: {
      flag,
      to,
      from: {
        logo,
        account,
        username,
      },
    },
    notify: 1, // 默认不勿扰
  };

  // flag === 'del'  msgData = { msgId: 'xxx' }
  notifyObj.data.msgData = msgData;

  const t = Date.now();

  // 群消息
  if (notifyObj.data.to === 'chang') {
    if (flag === 'addmsg') {
      // 给所有人只标记新增消息为未读，忽略删除，清空，抖一下
      await db('friends')
        .where({ friend: 'chang', read: 1 })
        .batchUpdate({ read: 0 });
    }

    const accs = Object.keys(_connect.getConnects());

    // 分批推送正在线的用户通知消息
    await batchTask(async (offset, limit) => {
      const list = accs.slice(offset, offset + limit);

      if (list.length === 0) return false;

      // 获取我被好友设置的备注
      const fArr = await db('friends')
        .select('des,account')
        .where({ account: { in: list }, friend: account })
        .find();

      // 群消息是否勿扰
      const fList = await db('friends')
        .select('notify,account')
        .where({ account: { in: list }, friend: 'chang' })
        .find();

      list.forEach((key) => {
        const fe = fArr.find((item) => item.account === key);
        const fno = fList.find((item) => item.account === key);

        notifyObj.notify = fno ? fno.notify : 1;
        notifyObj.data.from.des = fe ? fe.des : '';

        _connect.send(
          key,
          key === account ? nanoid() : req._hello.temid,
          notifyObj
        );
      });

      return true;
    }, 200);
  } else {
    let msgText = '';
    if (flag === 'addmsg') {
      if (msgData.type === 'image') {
        msgText = '图片';
      } else if (msgData.type === 'file') {
        msgText = '文件';
      } else {
        msgText = msgData.content;
      }
    } else if (flag === 'del') {
      msgText = '撤回消息';
    } else if (flag === 'clear') {
      msgText = '清空消息';
    } else if (flag === 'shake') {
      msgText = '抖了一下窗口';
    }
    const fInfo = await getFriendInfo(notifyObj.data.to, account, 'notify,des');
    notifyObj.notify = fInfo ? fInfo.notify : 1;
    // 标记消息为未读
    let change = {};
    if (notifyObj.data.to !== account) {
      const updateObj = { update_at: t, msg: msgText };
      if (flag === 'addmsg') {
        // 新增消息才标记未读
        updateObj.read = 0;
      }
      change = await db('friends')
        .where({ account: notifyObj.data.to, friend: account })
        .update(updateObj);
    }

    const change2 = await db('friends')
      .where({ account, friend: notifyObj.data.to })
      .update({ update_at: t, msg: `您：${msgText}` });
    // 如果不是好友，成为好友
    if (
      (notifyObj.data.to !== account && change.changes === 0) ||
      change2.changes === 0
    ) {
      await becomeFriends(account, notifyObj.data.to, 1, 0, msgText);
    }

    if (notifyObj.data.to === account) {
      // 推送给自己所有在线终端
      _connect.send(account, nanoid(), notifyObj);
    } else {
      notifyObj.data.from.des =
        account === 'hello' ? appConfig.helloDes : fInfo ? fInfo.des : '';

      _connect.send(notifyObj.data.to, req._hello.temid, notifyObj);

      // 如果是抖动，不推送给自己
      if (flag !== 'shake') {
        _connect.send(account, nanoid(), notifyObj);
      }
    }
  }
}

// 发送消息到自定义地址
export async function sendNotificationsToCustomAddresses(req, obj) {
  if (obj._from === obj._to || obj._to === 'hello') return; // 文件传输和给助手发的消息不发送

  if (obj._to === 'chang') {
    // 群，发送给所有配置了自定义地址的用户
    let lastSerial = 0;

    while (true) {
      const list = await db('user')
        .select('forward_msg_link,account')
        .where({
          forward_msg_state: 1,
          account: { '!=': obj._from },
          state: 1,
          serial: { '>': lastSerial },
        })
        .orderBy('serial', 'asc')
        .limit(200)
        .find();

      if (list.length === 0) break;

      lastSerial = list[list.length - 1].serial;

      const fArr = await db('friends')
        .select('des,account')
        .where({
          account: { in: list.map((item) => item.account) },
          friend: obj._from,
        })
        .find();

      const fList = await db('friends')
        .select('notify,account')
        .where({
          account: { in: list.map((item) => item.account) },
          friend: 'chang',
        })
        .find();

      await hdForwardToLink(req, list, fArr, obj.content, fList);
    }
  } else {
    const list = await db('user')
      .select('forward_msg_link,account')
      .where({
        forward_msg_state: 1,
        account: obj._to,
        state: 1,
      })
      .find();

    const fArr = await db('friends')
      .select('des,notify,account')
      .where({
        account: obj._to,
        friend: obj._from,
      })
      .find();

    await hdForwardToLink(req, list, fArr, obj.content, fArr);
  }
}

// 处理转发到自定义地址
export async function hdForwardToLink(req, list = [], fArr, text, fList = []) {
  if (list.length > 0) {
    const { username, account: fromAccount } = req._hello.userinfo;

    await concurrencyTasks(list, 3, async (item) => {
      const { forward_msg_link, account } = item;
      let { link, type, header, body } = parseForwardMsgLink(forward_msg_link);

      if (!isurl(link)) return;
      const fe = fArr.find((y) => y.account === account);
      const fno = fList.find((y) => y.account === account);
      if (fno && fno.notify === 0) return;
      const des = fe ? fe.des : '';
      const title =
        fromAccount === 'hello' ? appConfig.helloDes : des || username;

      link = tplReplace(link, {
        text: encodeURIComponent(text),
        title: encodeURIComponent(title),
      });
      body = replaceObjectValue(body, { title, text });

      header['x-source-service'] = 'hello';
      if (type === 'get') {
        await axios({
          method: type,
          url: link,
          headers: header,
          params: body,
          timeout: 3000,
        });
      } else if (type === 'post') {
        await axios({
          method: type,
          url: link,
          headers: header,
          data: body,
          timeout: 3000,
        });
      }
    });
  }
}

// 上线通知
export async function onlineMsg(req, pass) {
  const { account, hide, username } = req._hello.userinfo;

  const con = _connect.getConnects(); // 获取所有在线

  // 已经在线、隐身或跳过的不通知
  if ((!con.hasOwnProperty(account) && hide === 0) || pass) {
    const accs = Object.keys(con);

    await batchTask(async (offset, limit) => {
      const list = accs.slice(offset, offset + limit);

      if (list.length === 0) return false;

      const fArr = await db('friends')
        .select('des,account')
        .where({ account: { in: list }, friend: account, des: { '!=': '' } })
        .find();

      list.forEach((key) => {
        let des = '';
        const f = fArr.find((item) => item.account === key);
        if (f) {
          des = f.des;
        }
        _connect.send(key, req._hello.temid, {
          type: 'online',
          data: { text: `${des || username} 已上线`, account },
        });
      });

      return true;
    }, 200);
  }
}

// 成为朋友
export async function becomeFriends(
  me,
  friend,
  read1 = 1,
  read2 = 1,
  msg = ''
) {
  if (
    friend !== 'chang' &&
    friend !== 'hello' &&
    me !== friend &&
    !(await getUserInfo(friend, 'account'))
  )
    // 朋友不存在
    return;

  // 检查是否已经互为朋友
  const frs = await db('friends')
    .select('account,friend')
    .where({
      $or: [
        { account: me, friend: friend },
        { account: friend, friend: me },
      ],
    })
    .find();

  const isFriend1 = frs.some(
    (item) => item.account === me && item.friend === friend
  );
  const isFriend2 = frs.some(
    (item) => item.account === friend && item.friend === me
  );

  const create_at = Date.now();
  if (
    // 如果是自己或群，并且没有
    (friend === 'chang' || me === friend) &&
    !isFriend1
  ) {
    await db('friends').insert({
      id: `${me}_${friend}`,
      create_at,
      update_at: 0,
      account: me,
      friend,
      read: read1,
      msg,
    });

    return;
  }

  if (!isFriend1) {
    await db('friends').insert({
      id: `${me}_${friend}`,
      create_at,
      update_at: 0,
      account: me,
      friend,
      read: read1,
      msg,
    });
  }

  if (!isFriend2) {
    await db('friends').insert({
      id: `${friend}_${me}`,
      create_at,
      update_at: 0,
      account: friend,
      friend: me,
      read: read2,
      msg,
    });
  }
}

// 助手消息和转发消息
export async function heperMsgAndForward(req, to, text) {
  const msg = await helloHelperMsg(to, text);

  sendNotificationsToCustomAddresses(
    {
      _hello: {
        userinfo: {
          username: 'hello',
          account: 'hello',
        },
      },
    },
    msg
  ).catch((err) => {
    errLog(req, `发送通知到自定义地址失败(${err})`);
  });
}

// 助手消息
export async function helloHelperMsg(to, text) {
  const msgObj = {
    _to: to,
    content: text,
    type: 'text',
  };

  const msg = await saveChatMsg('hello', msgObj);

  await sendNotifyMsg(
    {
      _hello: {
        userinfo: {
          account: 'hello',
          username: 'hello',
        },
      },
    },
    to,
    'addmsg',
    msgObj
  );
  return msg;
}

// 解析forward_msg_link
export function parseForwardMsgLink(str) {
  const res = parseObjectJson(str);
  return (
    res || {
      link: '',
      type: 'get',
      header: {},
      body: {},
    }
  );
}

// 获取成员列表
export function getChatUserList(account, pageSize, offset) {
  return db('user AS u')
    .select(
      'f.des,f.read,f.msg,u.update_at,u.username,u.account,u.logo,u.email,u.hide'
    )
    .join(
      'friends AS f',
      { 'u.account': { value: 'f.friend', raw: true }, 'f.account': account },
      { type: 'LEFT' }
    )
    .where({ 'u.state': 1 })
    .orderBy('f.update_at', 'DESC')
    .page(pageSize, offset)
    .find();
}

// 清理到期聊天文件
export async function cleanUpload(req = false) {
  if (_d.cacheExp.uploadSaveDay > 0) {
    const uploadDir = _path.normalize(appConfig.appData, 'upload');

    if (!(await _f.exists(uploadDir))) return;

    const now = Date.now();
    const exp = now - _d.cacheExp.uploadSaveDay * 24 * 60 * 60 * 1000;

    let count = 0;
    let lastSerial = 0;

    while (true) {
      const list = await db('upload')
        .select('id,url')
        .where({ serial: { '>': lastSerial }, update_at: { '<': exp } })
        .orderBy('serial', 'ASC')
        .limit(800)
        .find();
      if (list.length === 0) break;

      lastSerial = list[list.length - 1].serial;

      await db('upload')
        .where({ id: { in: list.map((item) => item.id) } })
        .delete();

      await concurrencyTasks(list, 5, async (item) => {
        const { url } = item;
        const path = _path.normalize(uploadDir, url);
        await _delDir(path);
        count++;
      });
    }

    await cleanEmptyDirectories(uploadDir);

    if (count) {
      await writelog(req, `清理到期聊天室文件：${count}`, 'user');
    }
  }
}
