import express from 'express';

import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _connect from '../../utils/connect.js';
import mailer from '../../utils/email.js';
import _f from '../../utils/f.js';
import _2fa from '../../utils/_2fa.js';

import { runSql, db } from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import { createPagingData, isEmail, concurrencyTasks, writelog } from '../../utils/utils.js';

import { becomeFriends, cleanUpload, heperMsgAndForward } from '../chat/chat.js';

import { fieldLength } from '../config.js';

import { _delDir, getAllFile, readMenu } from '../file/file.js';

import { deleteUser } from '../user/user.js';
import _path from '../../utils/path.js';
import { cleanFavicon, cleanSiteInfo } from '../bmk/bmk.js';
import _crypto from '../../utils/crypto.js';
import { getSystemUsage } from '../../utils/sys.js';
import nanoid from '../../utils/nanoid.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 验证管理员
route.use(
  asyncHandler((_, res, next) => {
    if (!res.locals.hello.isRoot) {
      resp.forbidden(res, '无权操作')();
    } else {
      next();
    }
  }),
);

// 配置邮箱
route.post(
  '/email',
  validate(
    'body',
    V.object({
      state: V.number().toInt().enum([0, 1]),
      user: V.string().trim().default('').allowEmpty().max(fieldLength.email),
      pass: V.string().trim().default('').allowEmpty().max(100),
      host: V.string().trim().default('').allowEmpty().max(fieldLength.email),
      secure: V.number().toInt().enum([0, 1]),
      port: V.number().toInt().default(465).min(0),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { user, pass, host, secure, port, state } = res.locals.ctx;
    if (state === 1 && !isEmail(user)) {
      return resp.badRequest(res)('user 必须为邮箱格式', 1);
    }
    if (state === 1 && !host) {
      return resp.badRequest(res)('host 不能为空', 1);
    }

    _d.email = {
      user,
      pass,
      host,
      secure: secure === 1 ? true : false,
      port,
      state: state === 1 ? true : false,
    };

    resp.success(res, '更新邮箱配置成功')();
  }),
);

// 获取用户列表
route.get(
  '/user-list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().min(1).default(1),
      pageSize: V.number().toInt().min(1).max(fieldLength.userPageSize).default(10),
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { pageNo, pageSize, word } = res.locals.ctx;
    const userDB = db('user').where({ account: { '!=': appConfig.notifyAccount } });
    if (word) {
      userDB.where({ $or: [{ username: word }, { account: word }, { email: word }] });
    }
    const total = await userDB.clone().count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let list = await userDB
      .select('account,username,update_at,email,state,hide')
      .orderBy('update_at', 'desc')
      .page(pageSize, offset)
      .find();

    const cons = _connect.getConnects();

    list = list.map((item) => {
      const con = cons[item.account];
      return {
        ...item,
        os: con ? con.onlines.map((item) => `${item.os}(${item.ip})`) : [],
        online: Date.now() - item.update_at >= 1000 * 30 ? 0 : 1,
      };
    });

    resp.success(res, 'ok', {
      ...result,
      registerState: _d.registerState,
      trashState: _d.trashState,
      cacheExp: _d.cacheExp,
      pubApi: _d.pubApi,
      email: _d.email,
      faviconSpareApi: _d.faviconSpareApi,
      data: list,
    })();
  }),
);

// 备用图标api
route.post(
  '/favicon-spare-api',
  validate(
    'body',
    V.object({
      link: V.string().trim().default('').allowEmpty().max(fieldLength.url).httpUrl(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { link } = res.locals.ctx;

    _d.faviconSpareApi = link;

    resp.success(res, '设置图标备用api接口成功')();
  }),
);

// 账号状态
route.post(
  '/account-state',
  validate(
    'body',
    V.object({
      account: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .notEnum([appConfig.notifyAccount, appConfig.adminAccount]),
      state: V.number().toInt().default(1).enum([1, 0]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account, state } = res.locals.ctx;

    await db('user').where({ account }).update({ state });

    if (state === 1) {
      resp.success(res, '激活账号成功')();
    } else {
      resp.success(res, '关闭账号成功')();
    }
  }),
);

// 刪除账号
route.post(
  '/delete-account',
  validate(
    'body',
    V.object({
      account: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .notEnum([appConfig.notifyAccount, appConfig.adminAccount]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account } = res.locals.ctx;

    await deleteUser(account); // 删除账号数据

    resp.success(res, '销毁账号成功')();
  }),
);

// 清理歌曲文件
route.get(
  '/clean-music-file',
  asyncHandler(async (_, res) => {
    const musicDir = appConfig.musicDir();

    if ((await _f.getType(musicDir)) === 'dir') {
      const songs = await db('songs').select('url').find();
      const allMusicFile = await getAllFile(musicDir);

      await concurrencyTasks(allMusicFile, 5, async (item) => {
        const { path, name } = item;

        const url = `${path.slice(musicDir.length + 1)}/${_path.extname(name)[0]}`;
        if (!songs.some((item) => _path.extname(item.url)[0] === url)) {
          await _delDir(_path.normalizeNoSlash(path, name));
        }
      });

      await _f.removeEmptyDirs(musicDir);
    }
    resp.success(res, '清理歌曲文件成功')();
  }),
);

// 清理壁纸文件
route.get(
  '/clean-bg-file',
  asyncHandler(async (_, res) => {
    const bgDir = appConfig.bgDir();

    if ((await _f.getType(bgDir)) === 'dir') {
      const bgs = await db('bg').select('url').find();
      const allBgFile = await getAllFile(bgDir);

      await concurrencyTasks(allBgFile, 5, async (item) => {
        const { path, name } = item;
        const url = _path.normalizeNoSlash(path.slice(bgDir.length + 1), name);
        if (!bgs.some((item) => item.url === url)) {
          await _delDir(_path.normalizeNoSlash(path, name));
        }
      });

      await _f.removeEmptyDirs(bgDir);
    }
    resp.success(res, '清理壁纸文件成功')();
  }),
);

// 清理图床文件
route.get(
  '/clean-pic-file',
  asyncHandler(async (_, res) => {
    const picDir = appConfig.picDir();

    if ((await _f.getType(picDir)) === 'dir') {
      const pics = await db('pic').select('url').find();
      const allPicFile = await getAllFile(picDir);

      await concurrencyTasks(allPicFile, 5, async (item) => {
        const { path, name } = item;
        const url = _path.normalizeNoSlash(path.slice(picDir.length + 1), name);
        if (!pics.some((item) => item.url === url)) {
          await _delDir(_path.normalizeNoSlash(path, name));
        }
      });

      await _f.removeEmptyDirs(picDir);
    }
    resp.success(res, '清理图床文件成功')();
  }),
);

// 清理缩略图文件
route.get(
  '/clean-thumb-file',
  validate(
    'query',
    V.object({
      type: V.string().trim().enum(['pic', 'music', 'bg', 'upload', 'all', 'file']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { type } = res.locals.ctx;

    const delP = type === 'all' ? appConfig.thumbDir() : appConfig.thumbDir(type);

    await _delDir(delP);

    resp.success(res, '清理缩略图文件成功')();
  }),
);

// 设置注册状态
route.post(
  '/register-state',
  asyncHandler(async (_, res) => {
    _d.registerState = !_d.registerState;

    resp.success(res, `${_d.registerState ? '开启' : '关闭'}注册成功`, _d.registerState)();
  }),
);

// 更新tokenKey
route.post(
  '/update-tokenkey',
  asyncHandler(async (_, res) => {
    _d.tokenKey = _crypto.generateSecureKey();

    resp.success(res, '更新tokenKey成功')();
  }),
);

// 读取日志
route.get(
  '/log',
  validate(
    'query',
    V.object({
      name: V.string().notEmpty().min(1).max(fieldLength.filename),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { name } = res.locals.ctx;

    const log = (await _f.readFile(appConfig.logDir(name), null, ''))
      .toString()
      .split('\n')
      .filter(Boolean)
      .reverse();

    resp.success(res, 'ok', log)();
  }),
);

// 日志文件列表
route.get(
  '/log-list',
  asyncHandler(async (_, res) => {
    const list = (await readMenu(appConfig.logDir())).filter((f) => f.type === 'file');

    list.sort((a, b) => b.time - a.time);
    resp.success(res, 'ok', list)();
  }),
);

// 删除日志
route.post(
  '/delete-log',
  validate(
    'body',
    V.object({
      name: V.string().notEmpty().min(1).max(fieldLength.filename),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { name } = res.locals.ctx;

    if (name === 'all') {
      await _delDir(appConfig.logDir());
    } else {
      await _delDir(appConfig.logDir(name));
    }

    resp.success(res, '删除日志成功')();
  }),
);

// 回收站状态
route.post(
  '/trash-state',
  asyncHandler(async (_, res) => {
    _d.trashState = !_d.trashState;

    resp.success(res, `${_d.trashState ? '开启' : '关闭'}文件回收站成功`, _d.trashState)();
  }),
);

// 公开api状态
route.post(
  '/pub-api-state',
  validate(
    'body',
    V.object({
      randomBgApi: V.number().toInt().enum([0, 1]),
      siteInfoApi: V.number().toInt().enum([0, 1]),
      faviconApi: V.number().toInt().enum([0, 1]),
      echoApi: V.number().toInt().enum([0, 1]),
      ipLocationApi: V.number().toInt().enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { randomBgApi, siteInfoApi, faviconApi, echoApi, ipLocationApi } = res.locals.ctx;

    _d.pubApi = {
      randomBgApi: !!randomBgApi,
      siteInfoApi: !!siteInfoApi,
      faviconApi: !!faviconApi,
      echoApi: !!echoApi,
      ipLocationApi: !!ipLocationApi,
    };

    resp.success(res, `修改接口状态成功`, _d.pubApi)();
  }),
);

// 文件缓存时间
route.post(
  '/change-cache-time',
  validate(
    'body',
    V.object({
      uploadSaveDay: V.number().toInt().min(0).max(fieldLength.expTime),
      faviconCache: V.number().toInt().min(0).max(fieldLength.expTime),
      siteInfoCache: V.number().toInt().min(0).max(fieldLength.expTime),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { uploadSaveDay, faviconCache, siteInfoCache } = res.locals.ctx;

    const uploadSaveDayIschange = _d.cacheExp.uploadSaveDay !== uploadSaveDay;
    const faviconCacheIschange = _d.cacheExp.faviconCache !== faviconCache;
    const siteInfoCacheIschange = _d.cacheExp.siteInfoCache !== siteInfoCache;

    _d.cacheExp = {
      uploadSaveDay,
      faviconCache,
      siteInfoCache,
    };

    if (uploadSaveDayIschange) {
      await cleanUpload(res);
    }

    if (faviconCacheIschange) {
      await cleanFavicon(res);
    }

    if (siteInfoCacheIschange) {
      await cleanSiteInfo(res);
    }

    resp.success(res, `修改文件缓存过期时间成功`, _d.cacheExp)();
  }),
);

// 清理数据库
route.post(
  '/clean-database',
  asyncHandler(async (_, res) => {
    await runSql('VACUUM;');
    resp.success(res, '清理数据库成功')();
  }),
);

// 自定义代码
route.post(
  '/custom-code',
  validate(
    'body',
    V.object({
      body: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `文本内容不能超过: ${fieldLength.customCodeSize} 字节`,
        ),
      head: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `文本内容不能超过: ${fieldLength.customCodeSize} 字节`,
        ),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { body, head } = res.locals.ctx;

    await _f.writeFile(appConfig.customDir('custom_head.html'), head);
    await _f.writeFile(appConfig.customDir('custom_body.html'), body);

    resp.success(res, '添加自定义代码成功')();
  }),
);

// tipsFlag
route.post(
  '/tips',
  validate(
    'body',
    V.object({
      flag: V.string().trim().enum(['close', 'update']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { flag } = res.locals.ctx;

    if (flag === 'close') {
      _d.tipsFlag = 0;
    } else if (flag === 'update') {
      _d.tipsFlag = nanoid();
    }

    Object.keys(_connect.getConnects()).forEach((key) => {
      _connect.send(
        key,
        res.locals.hello.temid,
        {
          type: 'updatedata',
          data: {
            flag: 'tips',
          },
        },
        'all',
      );
    });

    resp.success(res, '修改tips状态成功')();
  }),
);

// 测试邮箱
route.post(
  '/test-email',
  validate(
    'body',
    V.object({
      email: V.string().trim().min(1).max(fieldLength.email).email(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { email } = res.locals.ctx;

    if (!_d.email.state) {
      resp.forbidden(res, '未开启邮箱验证')();
      return;
    }

    await mailer.sendMail(email, 'Hello账号验证邮件', '测试邮件');
    resp.success(res, '测试邮件发送成功')();
  }),
);

// 测试两步验证
route.post(
  '/test-tfa',
  validate('body', V.object({ token: V.string().trim().min(6).max(6).alphanumeric() })),
  asyncHandler(async (_, res) => {
    const { token } = res.locals.ctx;

    const verify = res.locals.hello.userinfo.verify;

    if (!verify) {
      resp.forbidden(res, '未开启两步验证')();
    } else if (_2fa.verify(verify, token)) {
      resp.success(res, '验证码正确')();
    } else {
      resp.forbidden(res, '验证码错误')();
    }
  }),
);

// 创建帐号
route.post(
  '/create-account',
  validate(
    'body',
    V.object({
      username: V.string().trim().min(1).max(fieldLength.username),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { username, password } = res.locals.ctx;

    const userInfo = await db('user').select('account').where({ username }).findOne();
    if (userInfo) {
      return resp.forbidden(res, '用户名已注册')();
    }

    // 写入用户数据
    const account = nanoid();

    await db('user').insert({
      create_at: Date.now(),
      update_at: 0,
      account,
      username,
      chat_id: nanoid(),
      password: await _crypto.hashPassword(password),
    });

    await becomeFriends(account, appConfig.chatRoomAccount);
    await becomeFriends(account, appConfig.notifyAccount);

    resp.success(res, '创建账号成功', { account, username })();
  }),
);

// 系统状态
route.get(
  '/sys-status',
  asyncHandler(async (_, res) => {
    resp.success(res, 'ok', await getSystemUsage())();
  }),
);

// 定期清理聊天过期文件
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '003000') {
    await cleanUpload();

    // 定期清理LOG文件
    const list = (await readMenu(appConfig.logDir())).filter((f) => f.type === 'file');

    if (list.length > 200) {
      let count = 0;
      list.sort((a, b) => b.time - a.time);
      for (const item of list.slice(200)) {
        const { name, path } = item;
        const p = _path.normalizeNoSlash(path, name);
        await _delDir(p);
        count++;
      }
      const text = `日志文件超出200个，已清理：${count}`;
      await writelog(false, text);
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
});

export default route;
