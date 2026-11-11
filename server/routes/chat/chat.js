import _connect from '../../utils/connect.js';

import { db, transaction } from '../../utils/sqlite.js';

import {
  concurrencyTasks,
  tplReplace,
  isurl,
  replaceObjectValue,
  batchTask,
  parseObjectJson,
  getOrigin,
  writelog,
  parseArrayJson,
} from '../../utils/utils.js';

import { clearUserInfoCache } from '../../utils/userCache.js';
import { _d } from '../../data/data.js';
import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';
import { _delDir } from '../file/file.js';
import _path from '../../utils/path.js';
import nanoid from '../../utils/nanoid.js';
import request from '../../utils/request.js';
import { fieldLength } from '../config.js';

// 获取好友信息
export async function getFriendInfo(mAcc, fAcc, fields = '*') {
  return db('friends').select(fields).where({ account: mAcc, friend: fAcc }).findOne();
}

// 标记为已读
export function markAsRead(mAcc, fAcc) {
  transaction(() => {
    const change = db('friends').where({ friend: fAcc, account: mAcc }).update({ read: 1 });

    // 不是好友，变为好友
    if (change.changes === 0) {
      becomeFriendsSync(mAcc, fAcc);
    }
  });
}

// 助手回复响应消息
export async function hdHelloMsg(req, res, data, type) {
  let { receive_chat_state, chat_id, account } = res.locals.hello.userinfo;
  const origin = getOrigin(req);

  const stopMsgText = '接口为关闭状态\n\n回复 start 开启接口 或 update 开启并更新接口';

  let msgText = `收信接口：\nGET：${origin}/api/s/${chat_id}?text=消息内容\nPOST：${origin}/api/s/${chat_id} body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;

  const text = data.trim();

  if (type === 'text' && text === 'update') {
    chat_id = nanoid();

    db('user').where({ account, state: 1 }).update({ receive_chat_state: 1, chat_id });

    clearUserInfoCache(account);

    msgText = `收信接口：\nGET：${origin}/api/s/${chat_id}?text=消息内容\nPOST：${origin}/api/s/${chat_id} body：{"text": "消息内容"}\n\n回复 update 更新接口 回复 stop 关闭接口`;
  } else if (type === 'text' && text === 'stop') {
    db('user').where({ account, state: 1 }).update({ receive_chat_state: 0 });

    clearUserInfoCache(account);

    msgText = stopMsgText;
  } else if (type === 'text' && text === 'start') {
    db('user').where({ account, state: 1 }).update({ receive_chat_state: 1 });

    clearUserInfoCache(account);
  } else {
    if (receive_chat_state === 0) {
      msgText = stopMsgText;
    }
  }

  await helloHelperMsg(account, msgText);
}

// 准备聊天消息字段
function prepareChatMessage(account, obj) {
  obj._from = account;

  obj.flag =
    obj._to === appConfig.chatRoomAccount ? appConfig.chatRoomAccount : `${account}-${obj._to}`;

  if (!obj.id) obj.id = nanoid();
  if (!obj.create_at) obj.create_at = Date.now();
}

// 构建通知对象
function buildNotify(res, to, flag, msgData) {
  const { account, logo, username } = res.locals.hello.userinfo;

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

  return { notifyObj, t: Date.now() };
}

// 好友列表里的最后消息文本
function notifyText(flag, msgData) {
  if (flag === 'addmsg') {
    if (msgData.type === 'image') return '图片';
    if (msgData.type === 'file') return '文件';
    return msgData.content;
  }

  if (flag === 'del') return '撤回消息';
  if (flag === 'clear') return '清空消息';
  if (flag === 'shake') return '抖了一下窗口';

  return '';
}

// 更新好友未读、最后消息、补建好友关系（同步，需在事务内执行）
function applyNotifyState(res, notifyObj, flag, msgText, t) {
  const { account } = res.locals.hello.userinfo;
  const to = notifyObj.data.to;

  // 群消息：只标记新增消息为未读
  if (to === appConfig.chatRoomAccount) {
    if (flag === 'addmsg') {
      db('friends').where({ friend: appConfig.chatRoomAccount, read: 1 }).batchUpdate({ read: 0 });
    }
    return;
  }

  const fInfo = db('friends')
    .select('notify,des')
    .where({ account: to, friend: account })
    .findOne();

  notifyObj.notify = fInfo ? fInfo.notify : 1;
  notifyObj.data.from.des =
    account === appConfig.notifyAccount ? appConfig.notifyAccountDes : fInfo ? fInfo.des : '';

  let change = {};
  let change2;

  if (to !== account) {
    const updateObj = { update_at: t, msg: msgText };
    if (flag === 'addmsg') {
      // 新增消息才标记未读
      updateObj.read = 0;
    }
    change = db('friends').where({ account: to, friend: account }).update(updateObj);
  }

  change2 = db('friends')
    .where({ account, friend: to })
    .update({ update_at: t, msg: `您：${msgText}` });

  // 如果不是好友，成为好友
  if ((to !== account && change.changes === 0) || change2.changes === 0) {
    becomeFriendsSync(account, to, 1, 0, msgText);
  }
}

// 推送通知（内存 / WebSocket）
async function pushNotify(res, notifyObj, flag) {
  const { account } = res.locals.hello.userinfo;
  const temid = res.locals.hello.temid;
  const to = notifyObj.data.to;

  if (to === appConfig.chatRoomAccount) {
    const accs = Object.keys(_connect.getConnects());

    // 分批推送正在线的用户通知消息
    await batchTask(async (offset, limit) => {
      const list = accs.slice(offset, offset + limit);

      if (list.length === 0) return false;

      // 获取我被好友设置的备注
      const fArr = db('friends')
        .select('des,account')
        .where({ account: { in: list }, friend: account })
        .find();

      // 群消息是否勿扰
      const fList = db('friends')
        .select('notify,account')
        .where({ account: { in: list }, friend: appConfig.chatRoomAccount })
        .find();

      list.forEach((key) => {
        const fe = fArr.find((item) => item.account === key);
        const fno = fList.find((item) => item.account === key);

        notifyObj.notify = fno ? fno.notify : 1;
        notifyObj.data.from.des = fe ? fe.des : '';

        _connect.send(key, temid, notifyObj, 'all');
      });

      return true;
    }, 200);
    return;
  }

  if (to === account) {
    // 推送给自己所有在线终端
    notifyObj.data.from.des = appConfig.ownAccountDes;
    _connect.send(account, temid, notifyObj, 'all');
    return;
  }

  _connect.send(to, temid, notifyObj, 'all');

  // 如果是抖动，不推送给自己
  if (flag !== 'shake') {
    _connect.send(account, temid, notifyObj, 'all');
  }
}

// 推送通知
export async function sendNotifyMsg(res, to, flag, msgData) {
  const { notifyObj, t } = buildNotify(res, to, flag, msgData);
  const msgText = notifyText(flag, msgData);

  transaction(() => applyNotifyState(res, notifyObj, flag, msgText, t));
  await pushNotify(res, notifyObj, flag);
}

// 保存聊天消息并更新好友状态（同一个事务）
export async function saveChatMsgAndNotify(res, account, obj) {
  prepareChatMessage(account, obj);

  const { notifyObj, t } = buildNotify(res, obj._to, 'addmsg', obj);
  const msgText = notifyText('addmsg', obj);

  transaction(() => {
    db('chat').insert(obj);
    applyNotifyState(res, notifyObj, 'addmsg', msgText, t);
  });

  // 事务提交后再做文件备份和推送
  if (account !== appConfig.notifyAccount) {
    await saveBackupData(account, 'chat', obj);
  }

  await pushNotify(res, notifyObj, 'addmsg');

  return obj;
}

// 发送消息到自定义地址
export async function sendNotificationsToCustomAddresses(res, obj) {
  if (obj._from === obj._to || obj._to === appConfig.notifyAccount) return; // 文件传输和给助手发的消息不发送

  if (obj._to === appConfig.chatRoomAccount) {
    // 群，发送给所有配置了自定义地址的用户
    let lastSerial = 0;

    while (true) {
      const list = db('user')
        .select('forward_msg_link,account,serial')
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

      const fArr = db('friends')
        .select('des,account')
        .where({
          account: { in: list.map((item) => item.account) },
          friend: obj._from,
        })
        .find();

      const fList = db('friends')
        .select('notify,account')
        .where({
          account: { in: list.map((item) => item.account) },
          friend: appConfig.chatRoomAccount,
        })
        .find();

      await hdForwardToLink(res, list, fArr, obj.content, fList);
    }
  } else {
    const list = db('user')
      .select('forward_msg_link,account')
      .where({
        forward_msg_state: 1,
        account: obj._to,
        state: 1,
      })
      .find();

    const fArr = db('friends')
      .select('des,notify,account')
      .where({
        account: obj._to,
        friend: obj._from,
      })
      .find();

    await hdForwardToLink(res, list, fArr, obj.content, fArr);
  }
}

// 处理转发到自定义地址
export async function hdForwardToLink(res, list = [], fArr, text, fList = []) {
  if (list.length > 0) {
    const { username, account: fromAccount } = res.locals.hello.userinfo;

    await concurrencyTasks(list, 3, async (item) => {
      try {
        const { forward_msg_link, account } = item;
        let { link, type, header, body, contentType } = parseForwardMsgLink(forward_msg_link);

        if (!isurl(link)) return;
        const fe = fArr.find((y) => y.account === account);
        const fno = fList.find((y) => y.account === account);
        if (fno && fno.notify === 0) return;
        const des = fe ? fe.des : '';
        const title =
          fromAccount === appConfig.notifyAccount ? appConfig.notifyAccountDes : des || username;

        link = tplReplace(link, {
          text: encodeURIComponent(text),
          title: encodeURIComponent(title),
        });

        if (type === 'get' || (type === 'post' && contentType === 'application/json')) {
          body = replaceObjectValue(parseObjectJson(body) || parseArrayJson(body) || {}, {
            text,
            title,
          });
        } else {
          body = tplReplace(body, { title, text });
        }

        if (type === 'post') header['content-type'] = contentType;
        if (type === 'get') {
          await request({
            method: type,
            url: link,
            headers: header,
            params: body,
            retry: 2,
          });
        } else if (type === 'post') {
          await request({
            method: type,
            url: link,
            headers: header,
            data: body,
            retry: 2,
          });
        }
      } catch (error) {
        await writelog(res, `[ forward_msg_link ] - ${error}`, 500);
      }
    });
  }
}

// 上线通知
export async function onlineMsg(res, pass) {
  const { account, hide, username } = res.locals.hello.userinfo;

  const con = _connect.getConnects(); // 获取所有在线

  // 已经在线、隐身或跳过的不通知
  if ((!Object.hasOwn(con, account) && hide === 0) || pass) {
    const accs = Object.keys(con).filter((acc) => acc !== account);

    await batchTask(async (offset, limit) => {
      const list = accs.slice(offset, offset + limit);

      if (list.length === 0) return false;

      const fArr = db('friends')
        .select('des,account,notify')
        .where({ account: { in: list }, friend: account })
        .find();

      list.forEach((key) => {
        const f = fArr.find((item) => item.account === key);
        if (f && f.notify === 0) return;
        const des = f?.des || username;

        _connect.send(
          key,
          res.locals.hello.temid,
          {
            type: 'online',
            data: { text: `${des} 已上线`, account },
          },
          'all',
        );
      });

      return true;
    }, 200);
  }
}

// 成为朋友（同步版本，调用方需要自己包事务）
export function becomeFriendsSync(me, friend, read1 = 1, read2 = 1, msg = '') {
  if (
    friend !== appConfig.chatRoomAccount &&
    friend !== appConfig.notifyAccount &&
    me !== friend &&
    !db('user').select('account').where({ account: friend, state: 1 }).findOne()
  )
    // 朋友不存在
    return;

  // 检查是否已经互为朋友
  const frs = db('friends')
    .select('account,friend')
    .where({
      $or: [
        { account: me, friend: friend },
        { account: friend, friend: me },
      ],
    })
    .find();

  const isFriend1 = frs.some((item) => item.account === me && item.friend === friend);
  const isFriend2 = frs.some((item) => item.account === friend && item.friend === me);

  const create_at = Date.now();
  if (
    // 如果是自己或群，并且没有
    (friend === appConfig.chatRoomAccount || me === friend) &&
    !isFriend1
  ) {
    db('friends').insert({
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
    db('friends').insert({
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
    db('friends').insert({
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
export async function heperMsgAndForward(res, to, text) {
  const msg = await helloHelperMsg(to, text);

  sendNotificationsToCustomAddresses(
    {
      locals: {
        hello: {
          userinfo: {
            username: appConfig.notifyAccount,
            account: appConfig.notifyAccount,
          },
        },
      },
    },
    msg,
  ).catch((err) => {
    writelog(res, `发送通知到自定义地址失败(${err})`, 403);
  });
}

// 助手消息
export async function helloHelperMsg(to, text) {
  const msgObj = {
    _to: to,
    content: text,
    type: 'text',
  };

  const res = {
    locals: {
      hello: {
        userinfo: {
          account: appConfig.notifyAccount,
          username: appConfig.notifyAccount,
          logo: '',
        },
        temid: '',
      },
    },
  };

  return saveChatMsgAndNotify(res, appConfig.notifyAccount, msgObj);
}

// 解析forward_msg_link
export function parseForwardMsgLink(str) {
  const res = parseObjectJson(str) || {};
  return {
    link: '',
    type: 'get',
    header: {},
    body: '{}',
    contentType: 'application/json',
    ...res,
  };
}

// 获取成员列表
export function getChatUserList(account, pageSize, offset, word = '') {
  const uDB = db('user AS u')
    .select('f.des,f.read,f.msg,f.draft,u.update_at,u.username,u.account,u.logo,u.hide')
    .join(
      'friends AS f',
      { 'u.account': { value: 'f.friend', raw: true }, 'f.account': account },
      { type: 'LEFT' },
    )
    .where({
      'u.state': 1,
    })
    .orderBy('f.update_at', 'DESC')
    .page(pageSize, offset);
  if (word) {
    uDB.where({ $or: [{ 'u.username': word }, { 'u.account': word }, { 'u.email': word }] });
  }
  return uDB.find();
}

// 清理到期聊天文件
export async function cleanUpload(res = false) {
  if (_d.cacheExp.uploadSaveDay > 0 && (await _f.getType(appConfig.uploadDir())) === 'dir') {
    const uploadDir = appConfig.uploadDir();

    const now = Date.now();
    const exp = now - _d.cacheExp.uploadSaveDay * 24 * 60 * 60 * 1000;

    let count = 0;
    let lastSerial = 0;

    while (true) {
      const list = db('upload')
        .select('url,serial')
        .where({ serial: { '>': lastSerial }, update_at: { '<': exp } })
        .orderBy('serial', 'ASC')
        .limit(800)
        .find();
      if (list.length === 0) break;

      lastSerial = list[list.length - 1].serial;

      db('upload')
        .where({ serial: { in: list.map((item) => item.serial) } })
        .delete();

      await concurrencyTasks(list, 5, async (item) => {
        const { url } = item;
        const path = _path.normalizeNoSlash(uploadDir, url);
        await _delDir(path);
        count++;
      });
    }

    await _f.removeEmptyDirs(uploadDir);

    if (count) {
      const text = `清理到期聊天室文件：${count}`;
      await writelog(res, text);
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
}

// 保持备份数据
export async function saveBackupData(account, type, item) {
  const filePath = appConfig.backupDir(account, type);
  let list = (await _f.readFile(filePath, null, ''))
    .toString()
    .split('\n')
    .filter(Boolean)
    .reverse();

  list.push(JSON.stringify(item));
  if (list.length > fieldLength.backupDataLength) {
    list = list.slice(-fieldLength.backupDataLength);
  }
  await _f.writeFile(filePath, list.reverse().join('\n'));
}
