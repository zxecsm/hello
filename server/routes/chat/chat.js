import axios from 'axios';
import _connect from '../../utils/connect.js';

import {
  queryData,
  updateData,
  insertData,
  fillString,
  allSqlite,
  batchUpdateData,
  deleteData,
} from '../../utils/sqlite.js';

import {
  nanoid,
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

// 获取好友备注
export async function getFriendDes(mAcc, fAcc) {
  const fData = (
    await queryData('friends', 'des', `WHERE account = ? AND friend = ?`, [
      mAcc,
      fAcc,
    ])
  )[0];

  return fData ? fData.des : '';
}

// 标记为已读
export async function markAsRead(mAcc, fAcc) {
  const time = Date.now();

  const change = await updateData(
    'friends',
    { read: 1, update_at: time },
    `WHERE friend = ? AND account = ?`,
    [fAcc, mAcc]
  );

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

    await updateData(
      'user',
      { receive_chat_state: 1, chat_id },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    msgText = `收信接口：\nGET：${origin}/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：${origin}/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;

    await uLog(req, `更新收信接口成功(${chat_id})`);
  } else if (type === 'text' && text === 'stop') {
    await updateData(
      'user',
      { receive_chat_state: 0 },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    msgText = stopMsgText;

    await uLog(req, `关闭收信接口成功(${chat_id})`);
  } else if (type === 'text' && text === 'start') {
    await updateData(
      'user',
      { receive_chat_state: 1 },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

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

  await insertData('chat', [obj]);

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
  };

  // flag === 'del'  msgData = { msgId: 'xxx' }
  notifyObj.data.msgData = msgData;

  const t = Date.now();

  if (notifyObj.data.to === 'chang') {
    //群消息
    if (flag === 'addmsg') {
      // 给所有人标记群消息为未读
      await batchUpdateData(
        'friends',
        'account',
        { read: 0, update_at: t },
        `WHERE friend = ?`,
        ['chang']
      );
    }

    const accs = Object.keys(_connect.getConnects());

    // 分批推送
    await batchTask(async (offset, limit) => {
      const list = accs.slice(offset, offset + limit);

      if (list.length === 0) return false;

      // 获取我被好友设置的备注
      const fArr = await queryData(
        'friends',
        'des,account',
        `WHERE friend = ? AND des != ? AND account IN (${fillString(
          list.length
        )})`,
        [account, '', ...list]
      );

      list.forEach((key) => {
        let des = '';
        const f = fArr.find((item) => item.account === key);

        if (f) {
          des = f.des;
        }

        notifyObj.data.from.des = des;

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
    let read = 0;
    if (flag === 'addmsg') {
      if (msgData.type === 'image') {
        msgText = '图片';
      } else if (msgData.type === 'file') {
        msgText = '文件';
      } else {
        msgText = msgData.content;
      }
    } else if (flag === 'del') {
      read = 1;
      msgText = '撤回消息';
    } else if (flag === 'clear') {
      read = 1;
      msgText = '清空消息';
    } else if (flag === 'shake') {
      read = 1;
      msgText = '抖了一下';
    }
    // 标记消息为未读
    let change = {};
    if (notifyObj.data.to !== account) {
      change = await updateData(
        'friends',
        { read, update_at: t, msg: msgText },
        `WHERE account = ? AND friend = ?`,
        [notifyObj.data.to, account]
      );
    }

    const change2 = await updateData(
      'friends',
      { msg: msgText },
      `WHERE account = ? AND friend = ?`,
      [account, notifyObj.data.to]
    );
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
      let des = '';

      const f = (
        await queryData(
          'friends',
          'des',
          `WHERE friend = ? AND des != ? AND account = ?`,
          [account, '', notifyObj.data.to]
        )
      )[0];

      if (f) {
        des = f.des;
      }

      notifyObj.data.from.des = des;

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
    await batchTask(async (offset, limit) => {
      const list = await queryData(
        'user',
        'forward_msg_link,account',
        `WHERE forward_msg_state = ? AND account != ? AND state = ? LIMIT ? OFFSET ?`,
        [1, obj._from, 1, limit, offset]
      );

      if (list.length === 0) return false;

      const fArr = await queryData(
        'friends',
        'des,account',
        `WHERE friend = ? AND des != ? AND account IN (${fillString(
          list.length
        )})`,
        [obj._from, '', ...list.map((item) => item.account)]
      );

      await hdForwardToLink(req, list, fArr, obj.data);

      return true;
    }, 200);
  } else {
    const list = await queryData(
      'user',
      'forward_msg_link,account',
      `WHERE forward_msg_state = ? AND account = ? AND state = ?`,
      [1, obj._to, 1]
    );

    const fArr = await queryData(
      'friends',
      'des,account',
      `WHERE friend = ? AND des != ? AND account = ?`,
      [obj._from, '', obj._to]
    );

    await hdForwardToLink(req, list, fArr, obj.content);
  }
}

// 处理转发到自定义地址
export async function hdForwardToLink(req, list, fArr, text) {
  if (list.length > 0) {
    const { username } = req._hello.userinfo;

    await concurrencyTasks(list, 3, async (item) => {
      const { forward_msg_link, account } = item;
      let { link, type, header, body } = parseForwardMsgLink(forward_msg_link);

      if (!isurl(link)) return;
      const f = fArr.find((y) => y.account === account);

      const des = f ? f.des : '';
      const msg = `${des || username}：${text}`;

      link = tplReplace(link, { msg: encodeURIComponent(msg) });
      body = replaceObjectValue(body, msg);

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

      const fArr = await queryData(
        'friends',
        'des,account',
        `WHERE friend = ? AND des != ? AND account IN (${fillString(
          list.length
        )})`,
        [account, '', ...list]
      );

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

  const time = Date.now();

  // 检查是否已经互为朋友
  const frs = await queryData(
    'friends',
    'account,friend',
    `WHERE (account = ? AND friend = ?) OR (account = ? AND friend = ?)`,
    [me, friend, friend, me]
  );

  const isFriend1 = frs.some(
    (item) => item.account === me && item.friend === friend
  );
  const isFriend2 = frs.some(
    (item) => item.account === friend && item.friend === me
  );

  if (
    // 如果是自己或群，并且没有
    (friend === 'chang' || me === friend) &&
    !isFriend1
  ) {
    await insertData('friends', [
      {
        id: `${me}_${friend}`,
        update_at: time,
        account: me,
        friend,
        read: read1,
        msg,
      },
    ]);

    return;
  }

  if (!isFriend1) {
    await insertData('friends', [
      {
        id: `${me}_${friend}`,
        update_at: time,
        account: me,
        friend,
        read: read1,
        msg,
      },
    ]);
  }

  if (!isFriend2) {
    await insertData('friends', [
      {
        id: `${friend}_${me}`,
        update_at: time,
        account: friend,
        friend: me,
        read: read2,
        msg,
      },
    ]);
  }
}

// 助手消息和转发消息
export async function heperMsgAndForward(req, to, text) {
  const msg = await helloHelperMsg(to, text);

  sendNotificationsToCustomAddresses(
    {
      _hello: {
        userinfo: {
          username: 'Hello助手',
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
          username: 'Hello助手',
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
  const sql = `SELECT f.des,f.read,f.msg,u.update_at,u.username,u.account,u.logo,u.email,u.hide
   FROM user AS u 
   LEFT JOIN friends AS f 
   ON u.account = f.friend 
   AND f.account = ? 
   WHERE u.state = ? 
   ORDER BY f.update_at DESC 
   LIMIT ? OFFSET ?`;
  return allSqlite(sql, [account, 1, pageSize, offset]);
}

// 清理到期聊天文件
export async function cleanUpload(req = false) {
  if (_d.cacheExp.uploadSaveDay > 0) {
    const uploadDir = _path.normalize(`${appConfig.appData}/upload`);

    if (!(await _f.exists(uploadDir))) return;

    const now = Date.now();
    const exp = now - _d.cacheExp.uploadSaveDay * 24 * 60 * 60 * 1000;

    let count = 0;

    await batchTask(async (offset, limit) => {
      const list = await queryData(
        'upload',
        'id,url',
        `WHERE update_at < ? LIMIT ? OFFSET ?`,
        [exp, limit, offset]
      );

      if (list.length === 0) return false;

      await deleteData(
        'upload',
        `WHERE id IN (${fillString(list.length)})`,
        list.map((item) => item.id)
      );

      await concurrencyTasks(list, 5, async (item) => {
        const { url } = item;
        const path = _path.normalize(uploadDir, url);
        await _delDir(path);
        count++;
      });

      return true;
    }, 800);

    await cleanEmptyDirectories(uploadDir);

    if (count) {
      await writelog(req, `清理到期聊天室文件：${count}`, 'user');
    }
  }
}
