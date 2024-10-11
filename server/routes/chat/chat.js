import axios from 'axios';
import msg from '../../data/msg.js';

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
} from '../../utils/utils.js';

import { getUserInfo } from '../user/user.js';
import { _d } from '../../data/data.js';
import configObj from '../../data/config.js';
import _f from '../../utils/f.js';
import { normalizePath, _delDir, delEmptyFolder } from '../file/file.js';

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

  if (change.changes === 0) {
    if (fAcc === 'chang') {
      await insertData('friends', [
        {
          account: mAcc,
          friend: 'chang',
          update_at: time,
        },
      ]);
    } else {
      if (fAcc === 'hello' || mAcc === fAcc) {
        await becomeFriends(mAcc, fAcc);
      } else {
        const user = await getUserInfo(fAcc, 'account');
        if (user) {
          await becomeFriends(mAcc, fAcc);
        }
      }
    }
  }
}

// 助手消息
export async function hdHelloMsg(req, data, type) {
  let { receive_chat_state, chat_id, account } = req._hello.userinfo;

  const stopMsgText =
    '接口为关闭状态\n\n回复 start 开启接口 或 update 开启并更新接口';

  let msgText = `收信接口：\nGET：/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;

  const text = data.trim();

  if (type === 'text' && text === 'update') {
    chat_id = nanoid();

    await updateData(
      'user',
      { receive_chat_state: 1, chat_id },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    msgText = `收信接口：\nGET：/api/chat/${chat_id}/sendMessage?text=消息内容\nPOST：/api/chat/${chat_id}/sendMessage body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;

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

// 发送通知
export async function sendNotifyMsg(req, to, flag, tt) {
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

  if (flag === 'addmsg') {
    notifyObj.data.msgData = tt;
  } else {
    notifyObj.data.tt = tt;
  }

  const t = Date.now();

  if (notifyObj.data.to === 'chang') {
    //群消息
    if (flag === 'addmsg') {
      await batchUpdateData(
        'friends',
        'account',
        { read: 0, update_at: t },
        `WHERE friend = ?`,
        ['chang']
      );
    }

    const accs = Object.keys(msg.getConnect());

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

        notifyObj.data.from.des = des;

        msg.set(key, key === account ? nanoid() : req._hello.temid, notifyObj);
      });

      return true;
    }, 200);
  } else {
    if (flag === 'addmsg' && notifyObj.data.to !== account) {
      const change = await updateData(
        'friends',
        { read: 0, update_at: t },
        `WHERE account = ? AND friend = ?`,
        [notifyObj.data.to, account]
      );

      if (change.changes === 0) {
        await becomeFriends(account, notifyObj.data.to, 1, 0);
      }
    }

    if (notifyObj.data.to === account) {
      msg.set(account, nanoid(), notifyObj);
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

      msg.set(notifyObj.data.to, req._hello.temid, notifyObj);

      if (flag !== 'shake') {
        msg.set(account, nanoid(), notifyObj);
      }
    }
  }
}

// 转发消息
export async function sendNotificationsToCustomAddresses(req, obj) {
  if (obj._from === obj._to || obj._to === 'hello') return;

  if (obj._to === 'chang') {
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

export async function hdForwardToLink(req, list, fArr, text) {
  if (list.length > 0) {
    const { username } = req._hello.userinfo;

    await concurrencyTasks(list, 5, async (item) => {
      const { forward_msg_link, account } = item;
      let { link, type, header, body } = parseForwardMsgLink(forward_msg_link);

      if (!isurl(link)) return;
      const f = fArr.find((y) => y.account === account);

      const des = f ? f.des : '';
      const msg = `来自Hello-${des || username}：${text}`;

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

  const connect = msg.getConnect();

  if ((!connect.hasOwnProperty(account) && hide === 0) || pass) {
    const accs = Object.keys(connect);

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
        msg.set(key, req._hello.temid, {
          type: 'online',
          data: { text: `${des || username} 已上线`, account },
        });
      });

      return true;
    }, 200);
  }
}

// 成为朋友
export function becomeFriends(me, friend, read1 = 1, read2 = 1) {
  const time = Date.now();

  if (friend === 'chang' || me === friend) {
    return insertData('friends', [
      {
        update_at: time,
        account: me,
        friend,
        read: read1,
      },
    ]);
  }

  return insertData('friends', [
    {
      update_at: time,
      account: me,
      friend,
      read: read1,
    },
    {
      update_at: time,
      account: friend,
      friend: me,
      read: read2,
    },
  ]);
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
  const sql = `SELECT f.des,f.read,u.update_at,u.username,u.account,u.logo,u.email,u.hide
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
export async function cleanUpload() {
  if (_d.uploadSaveDay > 0) {
    const uploadDir = `${configObj.filepath}/upload`;

    if (!_f.fs.existsSync(uploadDir)) return;

    const now = Date.now();
    const exp = now - _d.uploadSaveDay * 24 * 60 * 60 * 1000;

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
        const path = normalizePath(`${uploadDir}/${url}`);
        await _delDir(path);
      });

      return true;
    }, 800);

    await delEmptyFolder(uploadDir);
  }
}
