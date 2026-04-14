import express from 'express';

import _connect from '../../utils/connect.js';

import { _d } from '../../data/data.js';

import appConfig from '../../data/config.js';

import {
  writelog,
  receiveFiles,
  getTimePath,
  syncUpdateData,
  isImgFile,
  createPagingData,
  getSplitWord,
  batchTask,
  concurrencyTasks,
  getWordContent,
} from '../../utils/utils.js';

import { db } from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import _f from '../../utils/f.js';

import _2fa from '../../utils/_2fa.js';

import verifyLimit from '../../utils/verifyLimit.js';

import mailer from '../../utils/email.js';

import {
  sendNotifyMsg,
  onlineMsg,
  becomeFriends,
  heperMsgAndForward,
  parseForwardMsgLink,
} from '../chat/chat.js';

import { getUserInfo, deleteUser, getFontList } from './user.js';

import jwt from '../../utils/jwt.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import { parseMarkDown } from '../note/note.js';
import { _delDir, readMenu } from '../file/file.js';
import _crypto from '../../utils/crypto.js';
import getCity from '../../utils/getCity.js';
import nanoid from '../../utils/nanoid.js';
import { readSearchConfig, writeSearchConfig } from '../search/search.js';
import V from '../../utils/validRules.js';
import captcha from '../../utils/captcha.js';
import { getSSH, resetSSHExpireTime } from '../ssh/terminal.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';
import { getImgInfo } from '../../utils/img.js';

const verifyCode = new Map();

const route = express.Router();

// 记录错误
route.post(
  '/error',
  validate(
    'body',
    V.object({
      err: V.string().min(1),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { err } = res.locals.ctx;

    await writelog(res, `[ ${err.slice(0, 1000)} ]`, 100);

    resp.success(res)();
  }),
);

// 获取自定义code
route.get(
  '/custom-code',
  asyncHandler(async (_, res) => {
    const headPath = appConfig.customDir('custom_head.html');
    const bodyPath = appConfig.customDir('custom_body.html');

    const obj = {
      head: (await _f.readFile(headPath, null, '')).toString(),
      body: (await _f.readFile(bodyPath, null, '')).toString(),
    };

    resp.success(res, 'ok', obj)();
  }),
);

// 注册限制
let registerCount = 0;
timedTask.add(async (flag) => {
  flag = flag.slice(-6);
  if (flag === '000000') {
    registerCount = 0;
  } else if (flag === '004000') {
    const now = Date.now();

    const threshold = now - 10 * 24 * 60 * 60 * 1000;

    const sList = await readMenu(appConfig.temDir());

    let num = 0;

    await concurrencyTasks(sList, 5, async (item) => {
      const { name, path, time } = item;

      if (time < threshold) {
        await _delDir(_path.normalizeNoSlash(path, name));
        num++;
      }
    });

    if (num) {
      const text = `清理过期临时缓存文件：${num}`;
      await writelog(false, text);
      await heperMsgAndForward(null, appConfig.adminAccount, text);
    }
  }
});

// 注册
route.post(
  '/register',
  validate(
    'body',
    V.object({
      username: V.string().trim().min(1).max(fieldLength.username),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    if (!_d.registerState || registerCount > 20) {
      return resp.forbidden(res, '已关闭注册功能')();
    }

    const { username, password, captchaId } = res.locals.ctx;

    if (!captcha.consume(captchaId, username)) {
      return resp.success(res, '需要验证验证码，请完成验证', {
        needCaptcha: true,
        username,
      })();
    }

    const userInfo = await db('user').select('account').where({ username }).findOne();

    if (userInfo) {
      return resp.forbidden(res, '用户名无法使用')();
    }

    // 写入用户数据
    const account = nanoid();
    const create_at = Date.now();
    await db('user').insert({
      create_at,
      update_at: create_at,
      account,
      username,
      chat_id: nanoid(),
      password: await _crypto.hashPassword(password),
    });

    // 种下Cookie
    await jwt.setCookie(res, { account, username });

    registerCount++;

    await becomeFriends(account, appConfig.chatRoomAccount);
    await becomeFriends(account, appConfig.notifyAccount);

    const { os, ip } = res.locals.hello;

    await heperMsgAndForward(
      res,
      appConfig.adminAccount,
      `${username}(${account})，在 [${os}(${ip})] 注册账号成功`,
    );

    resp.success(res, '注册账号成功', { account, username })();
  }),
);

// 批准登录请求
route.post(
  '/allow-login-req',
  validate(
    'body',
    V.object({
      code: V.string().trim().min(6).max(6).alphanumeric(),
      username: V.string().trim().min(1).max(fieldLength.username),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { code, username } = res.locals.ctx;

    const userinfo = await db('user')
      .select('account, remote_login')
      .where({
        username,
        state: 1,
        account: { '!=': appConfig.notifyAccount },
      })
      .findOne();

    if (!userinfo) {
      return resp.forbidden(res, '用户无法免密登录')();
    }

    const { remote_login } = userinfo;

    if (remote_login === 0) {
      return resp.forbidden(res, '用户未开启免密登录')();
    }

    const { ip, os } = res.locals.hello;

    const { country, province, city, isp } = getCity(ip);

    // 发送允许登录消息
    _connect.send(
      userinfo.account,
      res.locals.hello.temid,
      {
        type: 'allowLogin',
        data: {
          ip,
          os,
          addr: `${country} ${province} ${city} ${isp}`,
          code,
        },
      },
      'all',
    );

    resp.success(res, '发送登录请求成功')();
  }),
);

// 免密登录
route.post(
  '/code-login',
  validate(
    'body',
    V.object({
      code: V.string().trim().min(6).max(6).alphanumeric(),
      username: V.string().trim().min(1).max(fieldLength.username),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { code, username } = res.locals.ctx;
    const userinfo = await db('user')
      .select('account, remote_login')
      .where({
        username,
        state: 1,
        account: { '!=': appConfig.notifyAccount },
      })
      .findOne();

    if (!userinfo) {
      return resp.forbidden(res, '用户无法免密登录')();
    }

    const { remote_login } = userinfo;

    if (remote_login === 0) {
      return resp.forbidden(res, '用户未开启免密登录')();
    }

    const key = `${userinfo.account}_${code}`;

    if (!verifyCode.has(key)) {
      return resp.ok(res)();
    }

    // 轮询请求一直到key被赋值，获取账号信息并删除记录，种下cookie
    const account = verifyCode.get(key);

    verifyCode.delete(key);

    await jwt.setCookie(res, {
      account,
      username,
    });

    const { os, ip } = res.locals.hello;

    await heperMsgAndForward(
      res,
      account,
      `您的账号通过免密验证，在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`,
    );

    resp.success(res, '登录成功', {
      account,
      username,
    })();
  }),
);

// 获取验证码
const captchaVerifyLimit = verifyLimit({ count: 10 });
route.get(
  '/captcha',
  validate(
    'query',
    V.object({
      flag: V.string().trim().min(1).max(fieldLength.id),
      theme: V.string().trim().default('light').enum(['light', 'dark']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { flag, theme } = res.locals.ctx;
    const { ip } = res.locals.hello;
    if (!captchaVerifyLimit.verify(ip, flag)) {
      return resp.forbidden(res, '请稍后再试')();
    }
    captchaVerifyLimit.add(ip, flag);
    resp.success(res, 'ok', await captcha.get(flag, theme))();
  }),
);

// 验证验证码
route.post(
  '/captcha',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      track: V.array(
        V.object({
          x: V.number().toNumber().min(0),
          y: V.number().toNumber().min(0),
          t: V.number().toNumber().min(0),
        }),
      ),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, track } = res.locals.ctx;
    const { ip } = res.locals.hello;
    const { flag } = captcha.getValue(id) || {};
    if (flag) {
      if (!captchaVerifyLimit.verify(ip, flag)) {
        return resp.forbidden(res, '请稍后再试')();
      }

      if (!captcha.verify(id, track)) {
        captchaVerifyLimit.add(ip, flag);
        return resp.forbidden(res, '验证失败，请重试')();
      }

      captchaVerifyLimit.delete(ip, flag);
      resp.success(res, '验证成功')();
    } else {
      resp.forbidden(res, '验证失败，请重试')();
    }
  }),
);

// 登录
const loginVerifyLimit = verifyLimit({ space: 60 * 30 });
route.post(
  '/login',
  validate(
    'body',
    V.object({
      username: V.string().trim().min(1).max(fieldLength.username),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { username, password, captchaId } = res.locals.ctx;
    const needCaptcha = !loginVerifyLimit.verify(username);

    if (needCaptcha && !captcha.consume(captchaId, username)) {
      return resp.success(res, '需要验证验证码，请完成验证', {
        needCaptcha,
        username,
      })();
    }

    const userinfo = await db('user')
      .select('verify,account,password')
      .where({
        username,
        state: 1,
        account: { '!=': appConfig.notifyAccount },
      })
      .findOne();

    if (!userinfo) {
      loginVerifyLimit.add(username);
      return resp.forbidden(res, '用户名或密码错误，请重新输入')();
    }

    const { verify, account } = userinfo;

    // 验证密码，如果未设置密码或密码正确
    if (!userinfo.password || (await _crypto.verifyPassword(password, userinfo.password))) {
      if (verify) {
        // 如果开启两部验证，则继续验证身份
        resp.success(res, '账号密码验证成功，请完成两步验证', {
          account,
          verify: true,
        })();
      } else {
        await jwt.setCookie(res, {
          account,
          username,
        });

        const { os, ip } = res.locals.hello;

        await heperMsgAndForward(
          res,
          account,
          `您的账号在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`,
        );

        resp.success(res, '登录成功', { account, username })();
      }
    } else {
      loginVerifyLimit.add(username);

      resp.forbidden(res, '用户名或密码错误，请重新输入')();
    }
  }),
);

// 两步验证
const towfaVerify = verifyLimit({ space: 60 * 30 });
route.post(
  '/verify-login',
  validate(
    'body',
    V.object({
      token: V.string().trim().min(6).max(6).alphanumeric(),
      account: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { token, account, password, captchaId } = res.locals.ctx;
    const needCaptcha = !towfaVerify.verify(account);

    if (needCaptcha && !captcha.consume(captchaId, account)) {
      return resp.success(res, '需要验证验证码，请完成验证', {
        needCaptcha,
        account,
      })();
    }

    const user = await getUserInfo(account, 'username,verify,password');

    if (!user) {
      towfaVerify.add(account);
      return resp.forbidden(res, '用户无法两步验证')();
    }

    const { username, verify, password: pd } = user;

    // 验证密码和验证码
    if (
      (!pd || (await _crypto.verifyPassword(password, pd))) &&
      verify &&
      _2fa.verify(verify, token)
    ) {
      await jwt.setCookie(res, {
        account,
        username,
      });

      const { os, ip } = res.locals.hello;

      await heperMsgAndForward(
        res,
        account,
        `您的账号在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`,
      );

      resp.success(res, '登录成功', { account, username })();
    } else {
      towfaVerify.add(account);
      resp.forbidden(res, '验证码错误，请重新输入')();
    }
  }),
);

// 发送邮件验证码
route.get(
  '/mail-code',
  validate(
    'query',
    V.object({
      username: V.string().trim().min(1).max(fieldLength.username),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { username, captchaId } = res.locals.ctx;

    if (!captcha.consume(captchaId, username)) {
      return resp.success(res, '需要验证验证码，请完成验证', {
        needCaptcha: true,
        username,
      })();
    }

    if (!_d.email.state) {
      return resp.forbidden(res, '邮箱验证功能已关闭')();
    }

    const userinfo = await db('user')
      .select('account,email')
      .where({
        username,
        state: 1,
        account: { '!=': appConfig.notifyAccount },
      })
      .findOne();

    if (!userinfo) {
      return resp.forbidden(res, '用户无法验证邮箱')();
    }

    const { account, email } = userinfo;

    if (!email) {
      return resp.forbidden(res, '用户未绑定邮箱')();
    }

    if (mailer.get(email)) {
      // 如果有缓存
      return resp.success(res, '验证码已发送', { account, email })();
    }

    const code = Math.random().toFixed(6).slice(2);

    await mailer.sendCode(email, code);
    resp.success(res, '验证码发送成功', { account, email })();
  }),
);

// 重置密码
const emailVerify = verifyLimit({ space: 60 * 30 });
route.post(
  '/reset-pass',
  validate(
    'body',
    V.object({
      email: V.string().trim().min(1).max(fieldLength.email).email(),
      code: V.string().trim().min(6).max(6).alphanumeric(),
      account: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      captchaId: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { email, code, account, captchaId } = res.locals.ctx;
    const needCaptcha = !emailVerify.verify(email);
    if (needCaptcha && !captcha.consume(captchaId, account)) {
      return resp.success(res, '需要验证验证码，请完成验证', {
        needCaptcha,
        account,
      })();
    }

    const userinfo = await db('user')
      .select('username')
      .where({
        email,
        account: { '=': account, '!=': appConfig.notifyAccount },
        state: 1,
      })
      .findOne();

    if (!userinfo) {
      emailVerify.add(email);
      return resp.forbidden(res, '用户无法重置密码')();
    }

    const { username } = userinfo;

    if (mailer.get(email) === code) {
      // 清除密码和两部验证token
      await db('user')
        .where({ account, state: 1 })
        .update({
          password: '',
          verify: '',
          exp_token_time: parseInt(Date.now() / 1000) - 2,
        });

      await jwt.setCookie(res, {
        account,
        username,
      });

      // 删除验证码缓存
      mailer.del(email);

      resp.success(res, '已重置密码为空，请尽快修改密码', {
        account,
        username,
      })();
    } else {
      emailVerify.add(email);

      resp.forbidden(res, '验证码错误，请重新输入')();
    }
  }),
);

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

// 未登录用户访问指定文件的临时权限
route.get(
  '/file-token',
  validate(
    'query',
    V.object({
      p: V.string().notEmpty().min(1).max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { p } = res.locals.ctx;

    const token = await jwt.set(
      {
        type: 'temAccessFile',
        data: { account: res.locals.hello.userinfo.account, p },
      },
      fieldLength.shareTokenExp,
    );

    resp.success(res, '获取fileToken成功', token)();
  }),
);

// 获取字体列表
route.get(
  '/font-list',
  asyncHandler(async (_, res) => {
    resp.success(res, 'ok', await getFontList());
  }),
);

// 发送邮件验证码
route.post(
  '/bind-mail-code',
  validate(
    'body',
    V.object({
      email: V.string().trim().min(1).max(fieldLength.email).email(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { email } = res.locals.ctx;

    if (!_d.email.state) {
      return resp.forbidden(res, '邮箱验证功能已关闭')();
    }

    if (mailer.get(email)) {
      return resp.success(res, '验证码已发送')();
    }

    const userinfo = await db('user').select('account').where({ email }).findOne();

    if (userinfo) {
      return resp.forbidden(res, '邮箱已绑定用户')();
    }

    const code = Math.random().toFixed(6).slice(2);

    await mailer.sendCode(email, code);

    resp.success(res, '验证码发送成功')();
  }),
);

// 绑定邮箱
route.post(
  '/bind-email',
  validate(
    'body',
    V.object({
      email: V.string().trim().default('').allowEmpty().min(1).max(fieldLength.email).email(),
      code: V.string().trim().default('').allowEmpty().min(6).max(6).alphanumeric(),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { email, code, password } = res.locals.ctx;

    const { account, password: pd } = res.locals.hello.userinfo;

    if (pd && !(await _crypto.verifyPassword(password, pd))) {
      return resp.forbidden(res, '密码错误，请重新输入')();
    }

    if (!code) {
      await db('user').where({ account, state: 1 }).update({ email: '' });

      syncUpdateData(res, 'userinfo');

      return resp.success(res, '解绑邮箱成功')();
    }

    if (!email) {
      return resp.badRequest(res)('email 不能为空', 1);
    }

    const userinfo = await db('user').select('account').where({ email }).findOne();

    if (userinfo) {
      return resp.forbidden(res, '邮箱已绑定用户')();
    }

    if (mailer.get(email) === code) {
      await db('user').where({ account, state: 1 }).update({ email });

      mailer.del(email);

      syncUpdateData(res, 'userinfo');

      resp.success(res, '绑定邮箱成功')();
    } else {
      resp.forbidden(res, '验证码错误，请重新输入')();
    }
  }),
);

// 获取临时两部验证token
route.get(
  '/verify',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

    resp.success(res, 'ok', _2fa.create(account))();
  }),
);

// 设置两部验证
route.post(
  '/verify',
  validate(
    'body',
    V.object({
      token: V.string().trim().default('').allowEmpty().min(6).max(6).alphanumeric(),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { token, password } = res.locals.ctx;

    const { account, password: pd } = res.locals.hello.userinfo;
    if (pd && !(await _crypto.verifyPassword(password, pd))) {
      return resp.forbidden(res, '密码错误，请重新输入')();
    }

    if (!token) {
      await db('user').where({ account, state: 1 }).update({ verify: '' });

      syncUpdateData(res, 'userinfo');

      return resp.success(res, '关闭两步验证成功')();
    }

    const verify = _2fa.create(account);

    // 验证token
    if (_2fa.verify(verify, token)) {
      await db('user').where({ account, state: 1 }).update({ verify });

      syncUpdateData(res, 'userinfo');

      _2fa.del(account); // 成功后删除token缓存

      resp.success(res, '开启两步验证成功')();
    } else {
      resp.forbidden(res, '验证码错误，请重新输入')();
    }
  }),
);

// tips标识
route.get(
  '/tips',
  asyncHandler(async (_, res) => {
    resp.success(res, 'ok', _d.tipsFlag)();
  }),
);

// 批准登录
route.post(
  '/allow-code-login',
  validate('body', V.object({ code: V.string().trim().min(6).max(6).alphanumeric() })),
  asyncHandler(async (_, res) => {
    const { code } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const key = `${account}_${code}`;

    // 登录码冲突则中断验证
    if (verifyCode.has(key)) {
      return resp.forbidden(res, '登录码冲突，请刷新登录码再试')();
    }

    // 设置账号信息，等待登录端获取
    verifyCode.set(key, account);

    let num = 0;
    let timer = setInterval(() => {
      if (++num > 10) {
        clearInterval(timer);
        timer = null;

        // 超时未获取则删除信息
        verifyCode.delete(key);

        return resp.forbidden(res, '批准登录超时')();
      }

      if (!verifyCode.has(key)) {
        clearInterval(timer);
        timer = null;

        resp.success(res, '批准登录成功')();
      }
    }, 1000);
  }),
);

// 修改密码
route.post(
  '/change-pd',
  validate(
    'body',
    V.object({
      oldpassword: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      newpassword: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account, password } = res.locals.hello.userinfo,
      { oldpassword, newpassword } = res.locals.ctx;

    //对比原密码
    if ((await _crypto.verifyPassword(oldpassword, password)) || !password) {
      await db('user')
        .where({ account, state: 1 })
        .update({
          password: await _crypto.hashPassword(newpassword),
          exp_token_time: parseInt(Date.now() / 1000),
        });

      resp.success(res, '修改密码成功，请重新登录')();
    } else {
      resp.forbidden(res, '原密码错误，请重新输入')();
    }
  }),
);

// 退出登录
route.get(
  '/logout',
  validate('query', V.object({ other: V.number().toInt().enum([0, 1]) })),
  asyncHandler(async (_, res) => {
    const { other } = res.locals.ctx;

    if (other === 1) {
      const { account, username } = res.locals.hello.userinfo;
      //退出其他登录设备
      await db('user')
        .where({ account, state: 1 })
        .update({
          exp_token_time: parseInt(Date.now() / 1000) - 2,
        });

      await jwt.setCookie(res, {
        account,
        username,
      });
    } else if (other === 0) {
      res.clearCookie('token');
    }

    resp.success(res, '退出登录成功')();
  }),
);

// 修改用户名
route.post(
  '/changename',
  validate('body', V.object({ username: V.string().trim().min(1).max(fieldLength.username) })),
  asyncHandler(async (_, res) => {
    const { username } = res.locals.ctx;

    const userinfo = await db('user')
      .select('account')
      .where({
        username,
      })
      .findOne();

    if (userinfo) {
      return resp.forbidden(res, '用户名无法使用')();
    }

    const { account } = res.locals.hello.userinfo;

    await db('user').where({ account, state: 1 }).update({ username });

    await jwt.setCookie(res, {
      account,
      username,
    });

    syncUpdateData(res, 'userinfo');

    resp.success(res, '修改用户名成功')();
  }),
);

// 账号状态
route.post(
  '/delete-account',
  validate(
    'body',
    V.object({
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { password } = res.locals.ctx;

    const { account, username, password: pd } = res.locals.hello.userinfo;

    if (pd && !(await _crypto.verifyPassword(password, pd))) {
      return resp.forbidden(res, '密码错误，请重新输入')();
    }

    if (res.locals.hello.isRoot || account === appConfig.notifyAccount) {
      resp.forbidden(res, '无权操作')();
    } else {
      await deleteUser(account);

      res.clearCookie('token');

      const { os, ip } = res.locals.hello;

      await heperMsgAndForward(
        res,
        appConfig.adminAccount,
        `${username}(${account})，在 [${os}(${ip})] 注销账号成功`,
      );

      resp.success(res, '注销账号成功')();
    }
  }),
);

// 用户信息
route.get(
  '/userinfo',
  asyncHandler(async (_, res) => {
    let {
      logo,
      username,
      forward_msg_link,
      forward_msg_state,
      verify,
      account,
      bg,
      bgxs,
      hide,
      email,
      remote_login,
      daily_change_bg,
    } = res.locals.hello.userinfo;

    verify = verify ? true : '';

    forward_msg_link = parseForwardMsgLink(forward_msg_link);

    resp.success(res, 'ok', {
      logo,
      username,
      forward_msg_link,
      forward_msg_state,
      verify,
      account,
      daily_change_bg,
      remote_login,
      bg,
      bgxs,
      hide,
      email,
    })();
  }),
);

// 删除头像
route.get(
  '/delete-logo',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

    await db('user').where({ account, state: 1 }).update({ logo: '' });

    syncUpdateData(res, 'userinfo');

    resp.success(res, '删除头像成功')();
  }),
);

// 上传logo
route.post(
  '/up-logo',
  validate(
    'query',
    V.object({
      name: V.string()
        .trim()
        .min(1)
        .max(fieldLength.filename)
        .custom(isImgFile, '必须为受支持的图片格式'),
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      type: V.string().trim().enum(['userlogo', 'bookmark', 'engine', 'translator']),
      id: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { name, HASH, type, id } = res.locals.ctx;

    if (['bookmark', 'engine', 'translator'].includes(type) && !id) {
      return resp.badRequest(res)('id 不能为空', 1);
    }

    const { account } = res.locals.hello.userinfo;

    const timePath = getTimePath();

    const path = appConfig.logoDir(account, timePath);

    await receiveFiles(
      req,
      path,
      `${HASH}.${_path.extname(name)[2]}`,
      fieldLength.maxLogoSize,
      HASH,
    );

    const { width, height } = await getImgInfo(
      _path.normalizeNoSlash(path, `${HASH}.${_path.extname(name)[2]}`),
    );

    if (width > fieldLength.picMaxWH || height > fieldLength.picMaxWH) {
      return resp.forbidden(res, '图片尺寸过大')(`${width}x${height}`, 1);
    }

    const logo = _path.normalizeNoSlash(timePath, `${HASH}.${_path.extname(name)[2]}`);

    if (type === 'bookmark') {
      await db('bmk')
        .where({ account, id, state: 1 })
        .update({ logo: _path.normalizeNoSlash('/logo', account, logo) });

      syncUpdateData(res, 'bookmark');

      resp.success(res, '更新书签LOGO成功')();
    } else if (type === 'userlogo') {
      await db('user').where({ account, state: 1 }).update({ logo });

      syncUpdateData(res, 'userinfo');

      resp.success(res, '更新头像成功')();
    } else if (type === 'engine') {
      const config = await readSearchConfig(account);

      if (Array.isArray(config.searchEngineData)) {
        const idx = config.searchEngineData.findIndex((s) => s.id === id);
        if (idx >= 0) {
          config.searchEngineData[idx] = {
            ...config.searchEngineData[idx],
            logo,
          };
          await writeSearchConfig(account, config);
          syncUpdateData(res, 'searchConfig');
        }
      }
      resp.success(res, '更新搜索引擎LOGO成功')();
    } else if (type === 'translator') {
      const config = await readSearchConfig(account);

      if (Array.isArray(config.translatorData)) {
        const idx = config.translatorData.findIndex((t) => t.id === id);
        if (idx >= 0) {
          config.translatorData[idx] = {
            ...config.translatorData[idx],
            logo,
          };
          await writeSearchConfig(account, config);
          syncUpdateData(res, 'searchConfig');
        }
      }
      resp.success(res, '更新翻译接口LOGO成功')();
    }
  }),
);

// 每日更换壁纸
route.get(
  '/daily-change-bg',
  asyncHandler(async (_, res) => {
    const { account, daily_change_bg } = res.locals.hello.userinfo;

    let tem;

    if (daily_change_bg === 1) {
      tem = 0;
    } else {
      tem = 1;
    }
    await db('user').where({ account, state: 1 }).update({ daily_change_bg: tem });

    syncUpdateData(res, 'userinfo');

    if (tem === 1) {
      resp.success(res, '成功开启')();
    } else {
      resp.success(res, '成功关闭')();
    }
  }),
);

// 隐身状态
route.get(
  '/hide-state',
  asyncHandler(async (_, res) => {
    const { account, hide } = res.locals.hello.userinfo;

    let tem;

    if (hide === 1) {
      tem = 0;
    } else {
      tem = 1;
    }

    await db('user').where({ account, state: 1 }).update({ hide: tem });

    syncUpdateData(res, 'userinfo');

    if (tem === 1) {
      resp.success(res, '成功开启')();
    } else {
      onlineMsg(res, 1); // 通知上线

      resp.success(res, '成功关闭')();
    }
  }),
);

// 免密登录状态
route.get(
  '/remote-login-state',
  asyncHandler(async (_, res) => {
    const { account, remote_login } = res.locals.hello.userinfo;

    let tem;

    if (remote_login === 1) {
      tem = 0;
    } else {
      tem = 1;
    }

    await db('user').where({ account, state: 1 }).update({ remote_login: tem });

    syncUpdateData(res, 'userinfo');

    if (tem === 1) {
      resp.success(res, '成功开启')();
    } else {
      resp.success(res, '成功关闭')();
    }
  }),
);

// 获取推送消息
route.get(
  '/real-time',
  validate(
    'query',
    V.object({
      flag: V.string().trim().default('').allowEmpty().max(10).alphanumeric(),
      page: V.string().trim().default('').allowEmpty().max(20),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

    let { temid, ip, os } = res.locals.hello;

    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    let { flag, page } = res.locals.ctx; //标识和设备ID

    if (page === 'home') {
      await db('user').where({ account, state: 1 }).update({ update_at: Date.now() });
      // 主页才通知在线
      onlineMsg(res);
    }

    const con = _connect.add(account, cb, { temid, page, ip, os });

    // 初始化指令标识
    if (!flag) {
      flag = con.flag;
    }

    let msgs = [];

    function cb() {
      msgs = _connect.getMessages(account, temid, flag);
      // 验证标识和是否有推送消息，没有则继续等待
      if (con.flag === flag || msgs.length === 0) return;
      stop(1);
    }

    // 超时断开连接
    let timer = setTimeout(stop, 20000);

    cb();

    function stop(state) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      // 删除触发器
      con.cbs = con.cbs.filter((item) => item !== cb);

      if (state) {
        resp.success(res, 'ok', { flag: con.flag, msgs })();
      } else {
        resp.ok(res, 'ok', { flag: con.flag })();
      }
    }

    // 保活SSH连接
    resetSSHExpireTime(temid);
  }),
);

// 接收指令
route.post(
  '/real-time',
  validate(
    'body',
    V.object({
      type: V.string()
        .trim()
        .enum([
          'updatedata',
          'chat',
          'playmode',
          'play',
          'vol',
          'progress',
          'pastefiledata',
          'ssh',
        ]),
      data: V.object(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

    let temid = res.locals.hello.temid;

    const { type, data } = res.locals.ctx; //指令内容和登录设备ID

    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    if (type === 'ssh') {
      let _vdata = {};
      try {
        _vdata = await V.parse(
          data,
          V.object({
            type: V.string().trim().enum(['cmd', 'size']),
            text: V.string()
              .default('')
              .allowEmpty()
              .custom(
                (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
                `text 不能超过: ${fieldLength.customCodeSize} 字节`,
              ),
            cols: V.number().toNumber().default(0).min(0),
            rows: V.number().toNumber().default(0).min(0),
          }),
          'data',
        );
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }
      const ssh = getSSH(temid);
      if (ssh) {
        try {
          if (_vdata.type === 'size') {
            // 更新终端大小
            ssh.stream.setWindow(_vdata.rows, _vdata.cols, 0, 0);
          } else if (_vdata.type === 'cmd') {
            // 执行命令
            ssh.stream.write(_vdata.text);
          }
        } catch (error) {
          if (_vdata.type === 'cmd') {
            _connect.send(
              account,
              temid,
              {
                type: 'ssh',
                data: `SSH Error: ${error.message}`,
              },
              'self',
            );
          }
        }
      } else {
        if (_vdata.type === 'cmd') {
          _connect.send(
            account,
            temid,
            {
              type: 'ssh',
              data: 'SSH connection has been disconnected. Please reconnect.',
            },
            'self',
          );
        }
      }

      resp.success(res)();
    }
    // 多端同步数据
    else if (type === 'updatedata') {
      let _vdata = {};
      try {
        _vdata = await V.parse(
          data,
          V.object({
            flag: V.string()
              .trim()
              .enum([
                'bookmark',
                'userinfo',
                'playinglist',
                'musicinfo',
                'todolist',
                'countlist',
                'music',
                'bg',
                'sharelist',
                'note',
                'trash',
                'history',
                'category',
                'sshCategory',
                'file',
                'searchConfig',
                'quickCommand',
              ]),
            id: V.string().trim().default('').allowEmpty().max(fieldLength.id).alphanumeric(),
          }),
          'data',
        );
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }
      const { flag, id } = _vdata;

      syncUpdateData(res, flag, id);
      resp.success(res)();
    }

    // 远程播放歌曲
    else if (type === 'play') {
      try {
        data.state = await V.parse(data.state, V.number().toInt().enum([1, 0]), 'data.state');
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }

      if (data.state === 1) {
        try {
          data.obj = await V.parse(data.obj, V.object(), 'data.obj');
        } catch (error) {
          return resp.badRequest(res)(error, 1);
        }
      }

      data.to = account;

      _connect.send(data.to, temid, { type, data }, 'other');

      resp.success(res)();
    }
    // 控制播放模式
    else if (type === 'playmode') {
      try {
        data.state = await V.parse(
          data.state,
          V.string().trim().enum(['random', 'loop', 'order']),
          'data.state',
        );
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }

      data.to = account;

      _connect.send(data.to, temid, { type, data }, 'other');

      resp.success(res)();
    }
    // 控制音量
    else if (type === 'vol') {
      try {
        data.value = await V.parse(data.value, V.number().toNumber().min(0).max(1), 'data.value');
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }

      data.to = account;

      _connect.send(data.to, temid, { type, data }, 'other');

      resp.success(res)();
    }
    // 控制播放进度
    else if (type === 'progress') {
      try {
        data.value = await V.parse(data.value, V.number().toNumber().min(0).max(1), 'data.value');
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }

      data.to = account;

      _connect.send(data.to, temid, { type, data }, 'other');

      resp.success(res)();
    }
    // 聊天室
    else if (type === 'chat') {
      try {
        data.to = await V.parse(
          data.to,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'data.to',
        );
        data.flag = await V.parse(
          data.flag,
          V.string().trim().enum(['addmsg', 'del', 'clear']),
          'data.flag',
        );
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }

      // 撤回、清空、发送新消息操作
      // 如果是删除验证消息id
      if (data.flag === 'del') {
        try {
          data.msgData = await V.parse(data.msgData, V.object(), 'data.msgData');
          data.msgData.msgId = await V.parse(
            data.msgData.msgId,
            V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
            'data.msgData.msgId',
          );
        } catch (error) {
          return resp.badRequest(res)(error, 1);
        }
      }

      await sendNotifyMsg(
        res.locals.hello.userinfo,
        res.locals.hello.temid,
        data.to,
        data.flag,
        data.msgData,
      );

      resp.success(res)();
    }
    // 文件粘贴数据
    else if (type === 'pastefiledata') {
      try {
        data.type = await V.parse(
          data.type,
          V.string().trim().default('').allowEmpty().enum(['copy', 'cut']),
          'data.type',
        );
      } catch (error) {
        return resp.badRequest(res)(error, 1);
      }

      if (data.type) {
        try {
          data.data = await V.parse(
            data.data,
            V.array(
              V.object({
                name: V.string().min(1).notEmpty().max(fieldLength.filename),
                path: V.string().min(1).notEmpty().max(fieldLength.url),
                type: V.string().trim().enum(['dir', 'file']),
              }),
            )
              .min(1)
              .max(fieldLength.maxPagesize),
            'data.data',
          );
        } catch (error) {
          return resp.badRequest(res)(error, 1);
        }

        _connect.send(account, temid, { type, data }, 'other');
        resp.success(res)();
      } else {
        _connect.send(account, temid, { type, data: {} }, 'other');
        resp.success(res)();
      }
    }
  }),
);

// 删除分享
route.post(
  '/delete-share',
  validate(
    'body',
    V.object({
      ids: V.array(V.string().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('share')
      .where({ id: { in: ids }, account })
      .delete();

    syncUpdateData(res, 'sharelist');

    resp.success(res, '删除分享成功')();
  }),
);

// 获取分享列表
route.get(
  '/share-list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(20).min(1).max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { pageNo, pageSize } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const total = await db('share').where({ account }).count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];

    if (total > 0) {
      data = await db('share')
        .select('id,type,title,pass,exp_time')
        .where({
          account,
        })
        .orderBy('serial', 'desc')
        .limit(pageSize)
        .offset(offset)
        .find();
    }

    resp.success(res, 'ok', {
      ...result,
      data,
    })();
  }),
);

// 编辑分享
route.post(
  '/edit-share',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      expireTime: V.number().toInt().max(fieldLength.expTime),
      pass: V.string().trim().default('').allowEmpty().max(fieldLength.sharePass),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, title, expireTime, pass } = res.locals.ctx;

    const obj = {
      exp_time: expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
    };

    const { account } = res.locals.hello.userinfo;

    await db('share').where({ id, account }).update(obj);

    syncUpdateData(res, 'sharelist');

    resp.success(res, '更新分享成功')();
  }),
);

// 回收站列表
route.get(
  '/trash-list',
  validate(
    'query',
    V.object({
      type: V.string().trim().enum(['note', 'bmk', 'bmk_group', 'history', 'ssh']),
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(20).min(1).max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { word, type, pageNo, pageSize } = res.locals.ctx;

    let fieldArr = [];
    let fields = '';

    if (type === 'bmk') {
      fields = 'b.id,b.title,b.link,b.des,b.group_id,g.title AS group_title,b.logo';
      fieldArr = ['b.title', 'b.link', 'b.des'];
    } else if (type === 'history') {
      fields = 'id,content';
      fieldArr = ['content'];
    } else if (type === 'bmk_group') {
      fields = 'id,title';
      fieldArr = ['title'];
    } else if (type === 'note') {
      fields = 'title,create_at,update_at,id,content,visit_count,top,category';
      fieldArr = ['title', 'content'];
    } else if (type === 'ssh') {
      fields = 'id,title,port,host,username,category,top,auth_type';
      fieldArr = ['title', 'host', 'username', 'port'];
    }

    const { account } = res.locals.hello.userinfo;
    let trashdb = null;
    if (type === 'bmk') {
      trashdb = db('bmk AS b')
        .select(fields)
        .join(
          'bmk_group AS g',
          {
            'b.group_id': { value: 'g.id', raw: true },
          },
          { type: 'LEFT' },
        )
        .where({ 'b.account': account, 'b.state': 0 });
    } else {
      trashdb = db(type).select(fields).where({
        account,
        state: 0,
      });
    }

    let splitWord = [];

    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);
      curSplit[0] = { value: curSplit[0], weight: 10 };
      trashdb.search(curSplit, fieldArr, { sort: true });
    } else {
      if (type === 'bmk') {
        trashdb.orderBy('b.serial', 'desc');
      } else {
        trashdb.orderBy(type === 'note' ? 'create_at' : 'serial', 'desc');
      }
    }

    const total = await trashdb.count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];

    if (total > 0) {
      data = await trashdb.page(pageSize, offset).find();

      if (type === 'note') {
        const noteCategory = await db('note_category').select('id,title').where({ account }).find();

        data = data.map((item) => {
          let { title, content, id, create_at, update_at, visit_count, top, category } = item;
          let con = [];
          let images = [];

          if (content) {
            const { text, images: img } = parseMarkDown(content);
            content = text.replace(/[\n\r]/g, '');
            images = img;

            if (word) {
              // 提取关键词
              const wc = getWordContent(splitWord, content);

              const idx = wc.findIndex(
                (item) => item.value.toLowerCase() === splitWord[0].toLowerCase(),
              );

              let start = 0,
                end = 0;

              if (idx >= 0) {
                if (idx > 15) {
                  start = idx - 15;
                  end = idx + 15;
                } else {
                  end = 30;
                }
              } else {
                end = 30;
              }

              con = wc.slice(start, end);
            }

            if (con.length === 0) {
              con = [
                {
                  value: content.slice(0, fieldLength.notePreviewLength),
                  type: 'text',
                },
              ];
              if (content.length > fieldLength.notePreviewLength) {
                con.push({ type: 'icon', value: '...' });
              }
            }
          }

          const cArr = category.split('-').filter(Boolean);
          const categoryArr = noteCategory.filter((item) => cArr.includes(item.id));

          return {
            id,
            title,
            create_at,
            update_at,
            visit_count,
            top,
            con,
            category,
            categoryArr,
            images,
          };
        });
      } else if (type === 'bmk') {
        data.forEach((item) => {
          if (!item.group_title) {
            item.group_title = item.group_id === 'home' ? '主页' : '未知分组';
          }
        });
      } else if (type === 'ssh') {
        const sshCategory = await db('ssh_category').select('id,title').where({ account }).find();
        data = data.map((item) => {
          const cArr = item.category.split('-').filter(Boolean);
          const categoryArr = sshCategory.filter((item) => cArr.includes(item.id));

          return {
            ...item,
            categoryArr,
          };
        });
      }
    }

    resp.success(res, 'ok', {
      ...result,
      data,
      splitWord,
    })();
  }),
);

// 删除回收站
route.post(
  '/delete-trash',
  validate(
    'body',
    V.object({
      type: V.string().trim().enum(['bmk_group', 'bmk', 'note', 'history', 'ssh']),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids, type } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db(type)
      .where({ id: { in: ids }, account, state: 0 })
      .delete();

    // 删除分组，则删除分组下的所有书签
    if (type === 'bmk_group') {
      await batchTask(async (offset, limit) => {
        const list = ids.slice(offset, offset + limit);

        if (list.length === 0) return false;

        await db('bmk')
          .where({ group_id: { in: list }, account })
          .delete();

        return true;
      }, 3);
    }

    // 移动笔记历史到文件回收站
    if (type === 'note') {
      const trashDir = appConfig.trashDir(account);

      await concurrencyTasks(ids, 5, async (id) => {
        const noteHistoryDir = appConfig.noteHistoryDir(account, id);

        if (await _f.exists(noteHistoryDir)) {
          await _f.rename(noteHistoryDir, _path.normalizeNoSlash(trashDir, id));
        }
      });
    }

    syncUpdateData(res, 'trash');

    resp.success(res, '删除成功')();
  }),
);

// 恢复回收站内容
route.post(
  '/recover-trash',
  validate(
    'body',
    V.object({
      type: V.string().trim().enum(['bmk_group', 'bmk', 'note', 'history', 'ssh']),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    let { ids, type } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db(type)
      .where({ id: { in: ids }, account, state: 0 })
      .update({ state: 1 });

    syncUpdateData(res, 'trash');

    if (type === 'bmk_group' || type === 'bmk') {
      type = 'bookmark';
    }

    syncUpdateData(res, type);

    resp.success(res, '恢复成功')();
  }),
);

export default route;
