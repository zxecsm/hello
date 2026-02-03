import express from 'express';

import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';

import { db } from '../../utils/sqlite.js';

import {
  _success,
  _nologin,
  _nothing,
  _err,
  receiveFiles,
  mergefile,
  paramErr,
  getTimePath,
  createPagingData,
  errLog,
  isurl,
  getSplitWord,
  unique,
  getSongInfo,
  isValidDate,
  isTooDeep,
  validate,
  parseObjectJson,
  parseArrayJson,
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
import { sym } from '../../utils/symbols.js';

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

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
  async (req, res) => {
    try {
      const { account: acc, notify } = req[kValidate];
      const { account } = req[kHello].userinfo;
      if (account === acc) {
        paramErr(res, req, `account 不能为: ${account}`, 'body');
        return;
      }

      await becomeFriends(account, acc);
      await db('friends').where({ friend: acc, account }).update({ notify });

      _success(res, `${notify === 0 ? '开启' : '关闭'}免打扰成功`)(req, `${acc}-${notify}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { account: acc, des } = req[kValidate];

      const { account } = req[kHello].userinfo;

      if (account === acc) {
        paramErr(res, req, `account 不能为: ${account}`, 'body');
        return;
      }

      await becomeFriends(account, acc);
      await db('friends').where({ friend: acc, account }).update({ des });

      _success(res, '设置备注成功')(req, `${acc}-${des}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { account: acc } = req[kValidate],
        { account, username } = req[kHello].userinfo;

      const f = await getFriendInfo(account, acc, 'des,notify');
      const des = f ? f.des : '';
      const notify = f ? f.notify : 1;

      if (acc === appConfig.chatRoomAccount) {
        _success(res, 'ok', {
          username: '聊天室',
          des: '聊天室',
          online: true,
          os: [],
          notify,
        });
        return;
      } else if (acc === appConfig.notifyAccount) {
        _success(res, 'ok', {
          username: appConfig.notifyAccount,
          des: appConfig.notifyAccountDes,
          online: true,
          os: [],
          notify,
        });
        return;
      } else if (acc === account) {
        _success(res, 'ok', {
          username,
          des: appConfig.ownAccountDes,
          online: true,
          os: [],
          notify,
        });
        return;
      }

      const user = await getUserInfo(acc, 'username,hide,update_at');

      if (!user) {
        _err(res, '无法获取用户信息')(req, acc, 1);
        return;
      }

      let online = true;

      if (user.hide === 1 || Date.now() - user.update_at >= 1000 * 30) {
        online = false;
      }

      const con = _connect.get(acc);

      _success(res, 'ok', {
        username: user.username,
        des,
        online,
        os: con ? con.onlines.map((item) => item.os) : [],
        notify,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
      start: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom((v) => (v ? isValidDate(v) : true), '必须 YYYY-MM-DD 格式'),
      end: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom((v) => (v ? isValidDate(v) : true), '必须 YYYY-MM-DD 格式'),
    }),
  ),
  async (req, res) => {
    try {
      let { account: acc, type, flag, word, start, end } = req[kValidate];

      const { account } = req[kHello].userinfo;

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
      const offsetMsg = flag
        ? await db('chat').select('serial').where({ id: flag }).findOne()
        : null;

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

      _success(res, 'ok', list);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { hash } = req[kValidate];

      const file = await db('upload').select('url').where({ id: hash }).findOne();

      if (file) {
        const u = appConfig.uploadDir(file.url);

        if ((await _f.getType(u)) === 'file') {
          _success(res, 'ok', {
            isText: await _f.isTextFile(u), // 判断是否文本文件
          });
          return;
        }
      }

      _nothing(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { to, content } = req[kValidate];

      let log = to;
      // 非群非助手验证用户是否存在
      if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
        const user = await getUserInfo(to, 'account,username');

        if (!user) {
          _err(res, '用户无法接收消息')(req, to, 1);
          return;
        }

        log = `${user.username}-${user.account}`;
      }

      const obj = {
        _to: to,
        content,
        type: 'text',
      };

      const { account } = req[kHello].userinfo;

      // 保存并推送消息
      const msg = await saveChatMsg(account, obj);
      await sendNotifyMsg(req, obj._to, 'addmsg', obj);

      if (to === appConfig.notifyAccount) {
        // 如果发送给助手，处理响应
        await hdHelloMsg(req, content, obj.type);
      }

      sendNotificationsToCustomAddresses(req, msg).catch((err) => {
        errLog(req, `发送通知到自定义地址失败(${err})`);
      });

      _success(res, `发送${chatType[obj.type]}消息成功`)(req, `${content}=>${log}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { to, id } = req[kValidate];

      let log = to;
      if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
        const user = await getUserInfo(to, 'account,username');

        if (!user) {
          _err(res, '用户无法接收消息')(req, to, 1);
          return;
        }

        log = `${user.username}-${user.account}`;
      }

      const chat = await db('chat').select('type,flag,content,size,hash').where({ id }).findOne();

      if (!chat) {
        _err(res, '转发的信息不存在')(req, id, 1);
        return;
      }

      const { account } = req[kHello].userinfo;

      const { flag, hash } = chat;

      // 只能转发群和发送给自己的或自己发送的消息
      if (flag !== appConfig.chatRoomAccount && !flag.includes(account)) {
        _err(res, '无权转发')(req, id, 1);
        return;
      }

      // 更换发送目标
      chat._to = to;

      // 文件消息，更新时间，避免被清理
      if (hash) {
        await db('upload').where({ id: hash }).update({ update_at: Date.now() });
      }

      const msg = await saveChatMsg(account, chat);
      await sendNotifyMsg(req, to, 'addmsg', chat);

      if (to === appConfig.notifyAccount) {
        await hdHelloMsg(req, chat.content, chat.type);
      }

      sendNotificationsToCustomAddresses(req, msg).catch((err) => {
        errLog(req, `发送通知到自定义地址失败(${err})`);
      });

      _success(res, '信息转发成功')(req, `${msg.content}=>${log}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { clear } = req[kValidate];

      const { account } = req[kHello].userinfo;

      if (clear === 1) {
        await db('friends').where({ account, read: 0 }).batchUpdate({ read: 1 });
        _success(res, '消息标记已读成功')(req);
        return;
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

      _success(res, 'ok', {
        group,
        friend,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { id, to } = req[kValidate];

      const { account } = req[kHello].userinfo;

      let log = to;
      if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
        const user = await getUserInfo(to, 'account,username');

        if (!user) {
          _err(res, '无法删除消息')(req, to, 1);
          return;
        }

        log = `${user.username}-${user.account}`;
      }

      if (id) {
        await db('chat').where({ id, _from: account }).delete();
        await sendNotifyMsg(req, to, 'del', { msgId: id });

        _success(res, '撤回消息成功')(req, `${id}=>${log}`, 1);
      } else {
        if (to === appConfig.chatRoomAccount) {
          // 群消息只能管理员清空
          if (req[kHello].isRoot) {
            await db('chat').where({ _to: appConfig.chatRoomAccount }).batchDelete();

            await sendNotifyMsg(req, to, 'clear');

            _success(res, '清空消息成功')(req, log, 1);
          } else {
            _err(res, '无权清空消息')(req, to, 1);
          }
        } else {
          await db('chat')
            .where({
              $or: [{ flag: `${account}-${to}` }, { flag: `${to}-${account}` }],
            })
            .batchDelete();

          await sendNotifyMsg(req, to, 'clear');

          _success(res, '清空消息成功')(req, log, 1);
        }
      }
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { to } = req[kValidate];
      const { account } = req[kHello].userinfo;

      if (to === account) {
        paramErr(res, req, `to 不能为: ${account}`, 'body');
        return;
      }

      const user = await getUserInfo(to, 'hide,update_at,username');

      if (!user) {
        _err(res, '用户无法接收消息')(req, to, 1);
        return;
      }

      if (user.hide === 1 || Date.now() - user.update_at > 1000 * 30) {
        _err(res, '对方已离线')(req, to, 1);
        return;
      }

      await sendNotifyMsg(req, to, 'shake');

      _success(res, '抖动对方窗口成功')(req, `${user.username}-${to}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { pageNo, pageSize, word } = req[kValidate];

      const { account } = req[kHello].userinfo;

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

      _success(res, 'ok', {
        ...result,
        data: list,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { name, HASH } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const path = appConfig.temDir(`${account}_${HASH}`);

      await receiveFiles(req, path, name, fieldLength.maxFileChunk);

      _success(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { HASH, name, to } = req[kValidate];

      const { account } = req[kHello].userinfo;

      let log = to;
      if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
        const user = await getUserInfo(to, 'account,username');

        if (!user) {
          _err(res, '用户无法接收消息')(req, to, 1);
          return;
        }

        log = `${user.username}-${user.account}`;
      }

      const upload = await db('upload').select('url').where({ id: HASH }).findOne();

      if (upload) {
        _err(res, '语音发送失败')(req, `语音=>${log}`, 1);
        return;
      }

      const time = Date.now();

      const timePath = getTimePath(time);
      const tDir = appConfig.uploadDir(timePath);
      const tName = `${HASH}.${_path.extname(name)[2]}`;

      await receiveFiles(req, tDir, tName, fieldLength.maxVoiceSize, HASH);

      const fobj = {
        id: HASH,
        create_at: time,
        url: _path.normalize(timePath, tName),
        update_at: time,
      };

      const { duration } = await getSongInfo(_path.normalize(tDir, tName));

      const obj = {
        _to: to,
        content: '语音',
        hash: HASH,
        type: 'voice',
        size: duration,
      };

      await db('upload').insert(fobj);

      const msg = await saveChatMsg(account, obj);
      await sendNotifyMsg(req, obj._to, 'addmsg', obj);

      if (to === appConfig.notifyAccount) {
        await hdHelloMsg(req, obj.content, obj.type);
      }

      sendNotificationsToCustomAddresses(req, msg).catch((err) => {
        errLog(req, `发送通知到自定义地址失败(${err})`);
      });

      _success(res, '发送语音消息成功')(req, `${obj.content}=>${log}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { HASH, count, name, to, type } = req[kValidate];

      let log = to;
      if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
        let user = await getUserInfo(to, 'account,username');

        if (!user) {
          _err(res, '用户无法接收消息')(req, to, 1);
          return;
        }

        log = `${user.username}-${user.account}`;
      }

      const upload = await db('upload').select('url').where({ id: HASH }).findOne();

      if (upload) {
        _err(res, '文件发送失败')(req, `${name}=>${log}`, 1);
        return;
      }

      const { account } = req[kHello].userinfo;

      const suffix = _path.extname(name)[2];
      const time = Date.now();
      const timePath = getTimePath(time);

      const tDir = appConfig.uploadDir(timePath);
      const tName = `${HASH}${suffix ? `.${suffix}` : ''}`;

      const targetPath = _path.normalize(tDir, tName);

      await mergefile(count, appConfig.temDir(`${account}_${HASH}`), targetPath, HASH);

      const fobj = {
        id: HASH,
        create_at: time,
        url: _path.normalize(timePath, tName),
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
      await sendNotifyMsg(req, obj._to, 'addmsg', obj);

      if (to === appConfig.notifyAccount) {
        await hdHelloMsg(req, obj.content, type);
      }

      sendNotificationsToCustomAddresses(req, msg).catch((err) => {
        errLog(req, `发送通知到自定义地址失败(${err})`);
      });

      _success(res, `发送${chatType[type]}消息成功`)(req, `${obj.content}=>${log}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { HASH } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const path = appConfig.temDir(`${account}_${HASH}`),
        arr = await _f.readdir(path);

      _success(res, 'ok', arr);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { HASH, type, name, to, size } = req[kValidate];

      const upload = await db('upload').select('url').where({ id: HASH }).findOne();

      if (upload) {
        // 文件已存在则，跳过上传
        const p = appConfig.uploadDir(upload.url);

        const stats = await _f.lstat(p);
        if (stats) {
          let log = to;

          if (!stats.isDirectory() && stats.size === size) {
            if (to !== appConfig.chatRoomAccount && to !== appConfig.notifyAccount) {
              const user = await getUserInfo(to, 'account,username');

              if (!user) {
                _err(res, '用户无法接收消息')(req, to, 1);
                return;
              }

              log = `${user.username}-${user.account}`;
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

            const { account } = req[kHello].userinfo;

            const msg = await saveChatMsg(account, obj);
            await sendNotifyMsg(req, obj._to, 'addmsg', obj);

            if (to === appConfig.notifyAccount) {
              await hdHelloMsg(req, obj.content, type);
            }

            sendNotificationsToCustomAddresses(req, msg).catch((err) => {
              errLog(req, `发送通知到自定义地址失败(${err})`);
            });

            _success(res, `发送${chatType[type]}消息成功`)(req, `${obj.content}=>${log}`, 1);
          } else {
            _success(res, `发送失败`)(req, `${name}=>${log}`, 1);
          }

          return;
        }

        await db('upload').where({ id: HASH }).delete();
      }

      _nothing(res);
    } catch (error) {
      _err(res)(req, error);
    }
  },
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
  async (req, res) => {
    try {
      const { state, type, link, header, body, contentType } = req[kValidate];

      if (state === 1) {
        if (!isurl(link)) {
          paramErr(res, req, 'link 格式错误', 'body');
          return;
        }

        if (!body) {
          paramErr(res, req, 'body 不能为空', 'body');
          return;
        }

        if (
          (type === 'get' || (type === 'post' && contentType === 'application/json')) &&
          !parseObjectJson(body) &&
          !parseArrayJson(body)
        ) {
          paramErr(res, req, 'body 必须为JSON对象字符串', 'body');
          return;
        }
      }

      const { account } = req[kHello].userinfo;

      const forward_msg_link = JSON.stringify({
        type,
        link,
        body,
        header,
        contentType,
      });

      if (_f.getTextSize(forward_msg_link) > 10 * 1024) {
        paramErr(res, req, 'forward_msg_link 字符大小不能超过限制', {
          forward_msg_link,
        });
        return;
      }

      if (state === 1) {
        try {
          await hdForwardToLink(req, [{ forward_msg_link }], [], '测试消息', []);
        } catch (error) {
          _err(res, '发送测试消息失败')(req, error, 1);
          return;
        }
      }

      await db('user').where({ account, state: 1 }).update({
        forward_msg_state: state,
        forward_msg_link,
      });

      _success(res, `${state === 1 ? '配置' : '关闭'}转发消息接口成功`)(req);
    } catch (error) {
      _err(res)(req, error);
    }
  },
);

export default route;
