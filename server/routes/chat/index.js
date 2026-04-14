import express from 'express';

import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';

import { db } from '../../utils/sqlite.js';

import {
  receiveFiles,
  mergefile,
  getTimePath,
  createPagingData,
  isurl,
  getSplitWord,
  unique,
  getSongInfo,
  isValidDate,
  isTooDeep,
  parseObjectJson,
  parseArrayJson,
  writelog,
} from '../../utils/utils.js';
import { fieldLength } from '../config.js';

import { getUserInfo } from '../user/user.js';

import {
  getFriendInfo,
  markAsRead,
  hdHelloMsg,
  saveChatMsg,
  sendNotifyMsg,
  sendNotificationsToCustomAddresses,
  becomeFriends,
  getChatUserList,
  hdForwardToLink,
} from './chat.js';

import _connect from '../../utils/connect.js';
import _path from '../../utils/path.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

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

// 勿扰
route.post(
  '/dnd-mode',
  validate(
    'body',
    V.object({
      account: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      notify: V.number().toInt().default(1).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account: acc, notify } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    if (account === acc) {
      return resp.badRequest(res)(`account 不能为: ${account}`, 1);
    }

    await becomeFriends(account, acc);
    await db('friends').where({ friend: acc, account }).update({ notify });

    resp.success(res, `${notify === 0 ? '开启' : '关闭'}免打扰成功`)();
  }),
);

// 设置备注
route.post(
  '/setdes',
  validate(
    'body',
    V.object({
      account: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .notEnum([appConfig.notifyAccount, appConfig.chatRoomAccount]),
      des: V.string().trim().default('').allowEmpty().max(fieldLength.chatDes),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account: acc, des } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (account === acc) {
      return resp.badRequest(res)(`account 不能为: ${account}`, 1);
    }

    await becomeFriends(account, acc);
    await db('friends').where({ friend: acc, account }).update({ des });

    resp.success(res, '设置备注成功')();
  }),
);

// 获取备注
route.get(
  '/getdes',
  validate(
    'query',
    V.object({
      account: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account: acc } = res.locals.ctx,
      { account, username } = res.locals.hello.userinfo;

    const f = await getFriendInfo(account, acc, 'des,notify');
    const des = f ? f.des : '';
    const notify = f ? f.notify : 1;

    if (acc === appConfig.chatRoomAccount) {
      return resp.success(res, 'ok', {
        username: '聊天室',
        des: '聊天室',
        online: true,
        os: [],
        notify,
      })();
    } else if (acc === appConfig.notifyAccount) {
      return resp.success(res, 'ok', {
        username: appConfig.notifyAccount,
        des: appConfig.notifyAccountDes,
        online: true,
        os: [],
        notify,
      })();
    } else if (acc === account) {
      return resp.success(res, 'ok', {
        username,
        des: appConfig.ownAccountDes,
        online: true,
        os: [],
        notify,
      })();
    }

    const user = await getUserInfo(acc, 'username,hide,update_at');

    if (!user) {
      return resp.forbidden(res, '无法获取用户信息')();
    }

    let online = true;

    if (user.hide === 1 || Date.now() - user.update_at >= 1000 * 30) {
      online = false;
    }

    const con = _connect.get(acc);

    resp.success(res, 'ok', {
      username: user.username,
      des,
      online,
      os: con ? con.onlines.map((item) => item.os) : [],
      notify,
    })();
  }),
);

// 读取消息
route.get(
  '/read-msg',
  validate(
    'query',
    V.object({
      account: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      type: V.number().toInt().enum([0, 1, 2]),
      flag: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      start: V.string().trim().default('').allowEmpty().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      end: V.string().trim().default('').allowEmpty().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
    }),
  ),
  asyncHandler(async (_, res) => {
    let { account: acc, type, flag, word, start, end } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    // 标记已读
    await markAsRead(account, acc);

    const chatdb = db('chat AS c').join(
      'user AS u',
      { 'u.account': { value: 'c._from', raw: true } },
      { type: 'LEFT' },
    );

    if (acc === appConfig.chatRoomAccount) {
      // 群
      chatdb.where({ 'c.flag': appConfig.chatRoomAccount });
    } else {
      chatdb.where({
        'c.flag': { in: [`${account}-${acc}`, `${acc}-${account}`] },
      });
    }

    if (start && end) {
      // 日期过滤
      const sTime = new Date(start + ' 00:00:00').getTime();
      const eTime = new Date(end + ' 00:00:00').getTime();

      chatdb.where({ 'c.create_at': { '>=': sTime, '<': eTime } });
    }

    let splitWord = [];

    if (word) {
      // 关键词搜索
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);

      chatdb.search(curSplit, ['u.username', 'c.content']);
    }

    // 获取游标消息
    const offsetMsg = flag ? await db('chat').select('serial').where({ id: flag }).findOne() : null;

    // 根据游标定位位置
    if (offsetMsg && type !== 0) {
      if (type === 1) {
        chatdb.where({ 'c.serial': { '<': offsetMsg.serial } });
      } else if (type === 2) {
        chatdb.where({ 'c.serial': { '>': offsetMsg.serial } });
      }
    }

    const pageSize = fieldLength.chatPageSize;
    let list = [];

    const fields = `u.logo,u.email,u.username,c._from,c._to,c.id,c.create_at,c.content,c.hash,c.size,c.type`;
    chatdb.select(fields).limit(pageSize);

    if (type === 0 || !offsetMsg) {
      // 打开聊天框或没有游标
      list = await chatdb.clone().orderBy('c.serial', 'desc').find();
      list.reverse();
    } else {
      // 向上截取
      if (type === 1) {
        list = await chatdb.clone().orderBy('c.serial', 'desc').find();
        list.reverse();
      } else if (type === 2) {
        // 向下截取
        list = await chatdb.clone().orderBy('c.serial', 'asc').find();
      }
    }

    // 添加备注信息
    const accIds = unique(list.map((item) => item._from));
    const friends = await db('friends')
      .select('friend,des')
      .where({
        account,
        friend: { in: accIds },
      })
      .find();

    list = list.map((item) => {
      item.des = '';
      const f = friends.find((y) => y.friend === item._from);
      if (f) {
        item.des = f.des;
      }
      return item;
    });

    resp.success(res, 'ok', list)();
  }),
);

// 文件过期
route.get(
  '/expired',
  validate(
    'query',
    V.object({
      hash: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { hash } = res.locals.ctx;

    const file = await db('upload').select('url').where({ id: hash }).findOne();

    if (file) {
      const u = appConfig.uploadDir(file.url);

      if ((await _f.getType(u)) === 'file') {
        return resp.success(res, 'ok', {
          isText: await _f.isTextFile(u), // 判断是否文本文件
        })();
      }
    }

    resp.ok(res)();
  }),
);

// 接收信息
const chatType = {
  text: '文字',
  image: '图片',
  file: '文件',
  voice: '语音',
};

route.post(
  '/send-msg',
  validate(
    'body',
    V.object({
      to: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      content: V.string().trim().min(1).max(fieldLength.chatContent),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { to, content } = res.locals.ctx;

    // 非群非助手验证用户是否存在
    if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        return resp.forbidden(res, '用户无法接收消息')();
      }
    }

    const obj = {
      _to: to,
      content,
      type: 'text',
    };

    const { account } = res.locals.hello.userinfo;

    // 保存并推送消息
    const msg = await saveChatMsg(account, obj);
    await sendNotifyMsg(res, obj._to, 'addmsg', obj);

    if (to === appConfig.notifyAccount) {
      // 如果发送给助手，处理响应
      await hdHelloMsg(req, res, content, obj.type);
    }

    sendNotificationsToCustomAddresses(res, msg).catch((err) => {
      writelog(res, `发送通知到自定义地址失败(${err})`, 403);
    });

    resp.success(res, `发送${chatType[obj.type]}消息成功`)();
  }),
);

// 转发消息
route.post(
  '/forward',
  validate(
    'body',
    V.object({
      to: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { to, id } = res.locals.ctx;

    if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        return resp.forbidden(res, '用户无法接收消息')();
      }
    }

    const chat = await db('chat').select('type,flag,content,size,hash').where({ id }).findOne();

    if (!chat) {
      return resp.forbidden(res, '转发的信息不存在')();
    }

    const { account } = res.locals.hello.userinfo;

    const { flag, hash } = chat;

    // 只能转发群和发送给自己的或自己发送的消息
    if (flag !== appConfig.chatRoomAccount && !flag.includes(account)) {
      return resp.forbidden(res, '无权转发')();
    }

    // 更换发送目标
    chat._to = to;

    // 文件消息，更新时间，避免被清理
    if (hash) {
      await db('upload').where({ id: hash }).update({ update_at: Date.now() });
    }

    const msg = await saveChatMsg(account, chat);
    await sendNotifyMsg(res, to, 'addmsg', chat);

    if (to === appConfig.notifyAccount) {
      await hdHelloMsg(req, res, chat.content, chat.type);
    }

    sendNotificationsToCustomAddresses(res, msg).catch((err) => {
      writelog(res, `发送通知到自定义地址失败(${err})`, 403);
    });

    resp.success(res, '信息转发成功')();
  }),
);

// 未读消息
route.get(
  '/news',
  validate(
    'query',
    V.object({
      clear: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { clear } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (clear === 1) {
      await db('friends').where({ account, read: 0 }).batchUpdate({ read: 1 });
      return resp.success(res, '消息标记已读成功')();
    }

    const group = await db('friends')
      .where({ account, read: 0, friend: appConfig.chatRoomAccount })
      .count();

    const friend = await db('friends')
      .where({
        account,
        read: 0,
        friend: { '!=': appConfig.chatRoomAccount },
      })
      .count();

    resp.success(res, 'ok', {
      group,
      friend,
    })();
  }),
);

// 删除消息
route.post(
  '/delete-msg',
  validate(
    'body',
    V.object({
      id: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
      to: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, to } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        return resp.forbidden(res, '无法删除消息')();
      }
    }

    if (id) {
      await db('chat').where({ id, _from: account }).delete();
      await sendNotifyMsg(res, to, 'del', { msgId: id });

      resp.success(res, '撤回消息成功')();
    } else {
      if (to === appConfig.chatRoomAccount) {
        // 群消息只能管理员清空
        if (res.locals.hello.isRoot) {
          await db('chat').where({ _to: appConfig.chatRoomAccount }).batchDelete();

          await sendNotifyMsg(res, to, 'clear');

          resp.success(res, '清空消息成功')();
        } else {
          resp.forbidden(res, '无权清空消息')();
        }
      } else {
        await db('chat')
          .where({
            $or: [{ flag: `${account}-${to}` }, { flag: `${to}-${account}` }],
          })
          .batchDelete();

        await sendNotifyMsg(res, to, 'clear');

        resp.success(res, '清空消息成功')();
      }
    }
  }),
);

// 抖一下
route.post(
  '/shake-msg',
  validate(
    'body',
    V.object({
      to: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .notEnum([appConfig.chatRoomAccount, appConfig.notifyAccount]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { to } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;

    if (to === account) {
      return resp.badRequest(res)(`to 不能为: ${account}`, 1);
    }

    const user = await getUserInfo(to, 'hide,update_at,username');

    if (!user) {
      return resp.forbidden(res, '用户无法接收消息')();
    }

    if (user.hide === 1 || Date.now() - user.update_at > 1000 * 30) {
      return resp.forbidden(res, '对方已离线')();
    }

    await sendNotifyMsg(res, to, 'shake');

    resp.success(res, '抖动对方窗口成功')();
  }),
);

// 成员
route.get(
  '/user-list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(10).min(1).max(fieldLength.userPageSize),
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { pageNo, pageSize, word } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const userDB = db('user').where({ state: 1 });
    if (word) {
      userDB.where({ $or: [{ username: word }, { account: word }, { email: word }] });
    }
    const total = await userDB.count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    const users = await getChatUserList(account, pageSize, offset, word);

    const n = Date.now();
    const cons = _connect.getConnects();

    const list = users.map((u) => {
      const { username, account: acc, update_at, logo, hide, email, des, read, msg } = u;

      const con = cons[acc];

      const obj = {
        username,
        account: acc,
        logo,
        online: 1,
        des: des === null ? '' : des,
        email,
        os: con ? con.onlines.map((item) => item.os) : [], // 展示登录设备信息
        read: read === null ? 1 : read,
        msg,
      };
      if (acc === account) {
        obj.des = appConfig.ownAccountDes;
      }
      if (acc === appConfig.notifyAccount) {
        obj.username = appConfig.notifyAccount;
        obj.des = appConfig.notifyAccountDes;
      }
      if (
        (hide === 1 || n - update_at > 1000 * 30) &&
        account !== acc &&
        acc !== appConfig.notifyAccount
      ) {
        obj.online = 0;
        obj.os = [];
      }

      return obj;
    });

    resp.success(res, 'ok', {
      ...result,
      data: list,
    })();
  }),
);

// 接收文件
route.post(
  '/up',
  validate(
    'query',
    V.object({
      name: V.string()
        .trim()
        .min(1)
        .max(20)
        .pattern(/^_[0-9]+$/, '必须 _ 开头数字结尾'),
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { name, HASH } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const path = appConfig.temDir(`${account}_${HASH}`);

    await receiveFiles(req, path, name, fieldLength.maxFileChunk);

    resp.success(res)();
  }),
);

// 接收语音
route.post(
  '/up-voice',
  validate(
    'query',
    V.object({
      name: V.string()
        .trim()
        .min(1)
        .max(fieldLength.filename)
        .pattern(/\.wav$/, '必须.wav结尾'),
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      to: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { HASH, name, to } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
      const user = await getUserInfo(to, 'account,username');

      if (!user) {
        return resp.forbidden(res, '用户无法接收消息')();
      }
    }

    const upload = await db('upload').select('url').where({ id: HASH }).findOne();

    if (upload) {
      return resp.forbidden(res, '语音发送失败')();
    }

    const time = Date.now();

    const timePath = getTimePath(time);
    const tDir = appConfig.uploadDir(timePath);
    const tName = `${HASH}.${_path.extname(name)[2]}`;

    await receiveFiles(req, tDir, tName, fieldLength.maxVoiceSize, HASH);

    const fobj = {
      id: HASH,
      create_at: time,
      url: _path.normalizeNoSlash(timePath, tName),
      update_at: time,
    };

    const { duration } = await getSongInfo(_path.normalizeNoSlash(tDir, tName));

    const obj = {
      _to: to,
      content: '语音',
      hash: HASH,
      type: 'voice',
      size: duration,
    };

    await db('upload').insert(fobj);

    const msg = await saveChatMsg(account, obj);
    await sendNotifyMsg(res, obj._to, 'addmsg', obj);

    if (to === appConfig.notifyAccount) {
      await hdHelloMsg(req, res, obj.content, obj.type);
    }

    sendNotificationsToCustomAddresses(res, msg).catch((err) => {
      writelog(res, `发送通知到自定义地址失败(${err})`, 403);
    });

    resp.success(res, '发送语音消息成功')();
  }),
);

// 合并文件
route.post(
  '/merge',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      count: V.number().toInt().min(1).max(fieldLength.maxFileSlice),
      name: V.string()
        .trim()
        .preprocess((v) => (typeof v === 'string' ? _path.sanitizeFilename(v) : v))
        .min(1)
        .max(fieldLength.filename),
      to: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      type: V.string().trim().enum(['image', 'file']),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { HASH, count, name, to, type } = res.locals.ctx;

    if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
      let user = await getUserInfo(to, 'account,username');

      if (!user) {
        return resp.forbidden(res, '用户无法接收消息')();
      }
    }

    const upload = await db('upload').select('url').where({ id: HASH }).findOne();

    if (upload) {
      return resp.forbidden(res, '文件发送失败')();
    }

    const { account } = res.locals.hello.userinfo;

    const suffix = _path.extname(name)[2];
    const time = Date.now();
    const timePath = getTimePath(time);

    const tDir = appConfig.uploadDir(timePath);
    const tName = `${HASH}${suffix ? `.${suffix}` : ''}`;

    const targetPath = _path.normalizeNoSlash(tDir, tName);

    await mergefile(count, appConfig.temDir(`${account}_${HASH}`), targetPath, HASH);

    const fobj = {
      id: HASH,
      create_at: time,
      url: _path.normalizeNoSlash(timePath, tName),
      update_at: time,
    };

    const stat = await _f.lstat(targetPath);

    const obj = {
      _to: to,
      content: name,
      hash: HASH,
      type,
      size: stat.size,
    };

    await db('upload').insert(fobj);

    if (type === 'image') {
      obj.content = tName;
    }

    const msg = await saveChatMsg(account, obj);
    await sendNotifyMsg(res, obj._to, 'addmsg', obj);

    if (to === appConfig.notifyAccount) {
      await hdHelloMsg(req, res, obj.content, type);
    }

    sendNotificationsToCustomAddresses(res, msg).catch((err) => {
      writelog(res, `发送通知到自定义地址失败(${err})`, 403);
    });

    resp.success(res, `发送${chatType[type]}消息成功`)();
  }),
);

// 断点续传
route.post(
  '/breakpoint',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { HASH } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const path = appConfig.temDir(`${account}_${HASH}`),
      arr = await _f.readdir(path);

    resp.success(res, 'ok', arr)();
  }),
);

// 检查上传文件是否重复
route.post(
  '/repeat',
  validate(
    'body',
    V.object({
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      type: V.string().trim().enum(['image', 'file']),
      to: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      name: V.string()
        .trim()
        .preprocess((v) => (typeof v === 'string' ? _path.sanitizeFilename(v) : v))
        .min(1)
        .max(fieldLength.filename),
      size: V.number()
        .toNumber()
        .min(0)
        .max(fieldLength.maxFileSlice * fieldLength.maxFileChunk * 1024 * 1024),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { HASH, type, name, to, size } = res.locals.ctx;

    const upload = await db('upload').select('url').where({ id: HASH }).findOne();

    if (upload) {
      // 文件已存在则，跳过上传
      const p = appConfig.uploadDir(upload.url);

      const stats = await _f.lstat(p);
      if (stats) {
        if (!stats.isDirectory() && stats.size === size) {
          if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
            const user = await getUserInfo(to, 'account,username');

            if (!user) {
              return resp.forbidden(res, '用户无法接收消息')();
            }
          }

          await db('upload').where({ id: HASH }).update({ update_at: Date.now() });

          const suffix = _path.extname(name)[2];

          const tName = `${HASH}${suffix ? `.${suffix}` : ''}`;

          const obj = {
            _to: to,
            content: name,
            hash: HASH,
            type,
            size,
          };

          if (type === 'image') {
            obj.content = tName;
          }

          const { account } = res.locals.hello.userinfo;

          const msg = await saveChatMsg(account, obj);
          await sendNotifyMsg(res, obj._to, 'addmsg', obj);

          if (to === appConfig.notifyAccount) {
            await hdHelloMsg(req, res, obj.content, type);
          }

          sendNotificationsToCustomAddresses(res, msg).catch((err) => {
            writelog(res, `发送通知到自定义地址失败(${err})`, 403);
          });

          resp.success(res, `发送${chatType[type]}消息成功`)();
        } else {
          resp.success(res, `发送失败`)();
        }

        return;
      }

      await db('upload').where({ id: HASH }).delete();
    }

    resp.ok(res)();
  }),
);

// 配置自定义转发地址接口
route.post(
  '/forward-msg-link',
  validate(
    'body',
    V.object({
      state: V.number().toInt().enum([0, 1]),
      type: V.string().trim().enum(['get', 'post']),
      link: V.string().trim().default('').allowEmpty().max(fieldLength.url),
      contentType: V.string()
        .trim()
        .default('application/json')
        .enum(['application/json', 'application/x-www-form-urlencoded', 'text/plain']),
      header: V.object()
        .default({})
        .custom((v) => !isTooDeep(v, 1), '对象限制1层'),
      body: V.string().trim().default('').allowEmpty().max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { state, type, link, header, body, contentType } = res.locals.ctx;

    if (state === 1) {
      if (!isurl(link)) {
        return resp.badRequest(res)('link 格式错误', 1);
      }

      if (!body) {
        return resp.badRequest(res)('body 不能为空', 1);
      }

      if (
        (type === 'get' || (type === 'post' && contentType === 'application/json')) &&
        !parseObjectJson(body) &&
        !parseArrayJson(body)
      ) {
        return resp.badRequest(res)('body 必须为JSON对象字符串', 1);
      }
    }

    const { account } = res.locals.hello.userinfo;

    const forward_msg_link = JSON.stringify({
      type,
      link,
      body,
      header,
      contentType,
    });

    if (_f.getTextSize(forward_msg_link) > 10 * 1024) {
      return resp.badRequest(res)('forward_msg_link 字符大小不能超过限制', 1);
    }

    if (state === 1) {
      try {
        await hdForwardToLink(res, [{ forward_msg_link }], [], '测试消息', []);
      } catch (error) {
        return resp.forbidden(res, '发送测试消息失败')(error, 1);
      }
    }

    await db('user').where({ account, state: 1 }).update({
      forward_msg_state: state,
      forward_msg_link,
    });

    resp.success(res, `${state === 1 ? '配置' : '关闭'}转发消息接口成功`)();
  }),
);

export default route;
