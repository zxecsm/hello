import express from 'express';

import _connect from '../../utils/connect.js';

import { _d } from '../../data/data.js';

import appConfig from '../../data/config.js';

import {
  writelog,
  _success,
  _nologin,
  _nothing,
  _err,
  paramErr,
  receiveFiles,
  getTimePath,
  syncUpdateData,
  isImgFile,
  createPagingData,
  getSplitWord,
  batchTask,
  concurrencyTasks,
  getWordContent,
  validate,
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
import { sym } from '../../utils/symbols.js';
import captcha from '../../utils/captcha.js';

const verifyCode = new Map();

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

// 记录错误
route.post(
  '/error',
  validate(
    'body',
    V.object({
      err: V.string().min(1),
    })
  ),
  async (req, res) => {
    try {
      const { err } = req[kValidate];

      await writelog(req, `[ ${err.slice(0, 1000)} ]`, 'panel_error');

      _success(res);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取自定义code
route.get('/custom-code', async (req, res) => {
  try {
    const headPath = appConfig.customDir('custom_head.html');
    const bodyPath = appConfig.customDir('custom_body.html');

    const obj = {
      head: (await _f.readFile(headPath, null, '')).toString(),
      body: (await _f.readFile(bodyPath, null, '')).toString(),
    };

    _success(res, 'ok', obj);
  } catch (error) {
    _err(res)(req, error);
  }
});

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
        await _delDir(_path.normalize(path, name));
        num++;
      }
    });

    if (num) {
      const text = `清理过期临时缓存文件：${num}`;
      await writelog(false, text, 'user');
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
      captchaId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      if (!_d.registerState || registerCount > 20) {
        _err(res, '已关闭注册功能')(req);
        return;
      }

      const { username, password, captchaId } = req[kValidate];

      if (!captcha.consume(captchaId, username)) {
        _success(res, '需要验证验证码，请完成验证', {
          needCaptcha: true,
          username,
        })(req, username, 1);
        return;
      }

      const userInfo = await db('user').where({ username }).findOne();

      if (userInfo) {
        _err(res, '用户名无法使用')(req, username, 1);
        return;
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

      const { os, ip } = req[kHello];

      await heperMsgAndForward(
        req,
        appConfig.adminAccount,
        `${username}(${account})，在 [${os}(${ip})] 注册账号成功`
      );

      _success(res, '注册账号成功', { account, username })(
        req,
        `${username}-${account}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 批准登录请求
route.post(
  '/allow-login-req',
  validate(
    'body',
    V.object({
      code: V.string().trim().min(6).max(6).alphanumeric(),
      username: V.string().trim().min(1).max(fieldLength.username),
    })
  ),
  async (req, res) => {
    try {
      const { code, username } = req[kValidate];

      const userinfo = await db('user')
        .select('account, remote_login')
        .where({
          username,
          state: 1,
          account: { '!=': appConfig.notifyAccount },
        })
        .findOne();

      if (!userinfo) {
        _err(res, '用户无法免密登录')(req, username, 1);
        return;
      }

      const { account, remote_login } = userinfo;

      if (remote_login === 0) {
        _err(res, '用户未开启免密登录')(req, `${username}-${account}`, 1);
        return;
      }

      const { ip, os } = req[kHello];

      const { country, province, city, isp } = getCity(ip);

      // 发送允许登录消息
      _connect.send(userinfo.account, nanoid(), {
        type: 'allowLogin',
        data: {
          ip,
          os,
          addr: `${country} ${province} ${city} ${isp}`,
          code,
        },
      });

      _success(res, '发送登录请求成功')(req, `${username}-${account}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 免密登录
route.post(
  '/code-login',
  validate(
    'body',
    V.object({
      code: V.string().trim().min(6).max(6).alphanumeric(),
      username: V.string().trim().min(1).max(fieldLength.username),
    })
  ),
  async (req, res) => {
    try {
      const { code, username } = req[kValidate];
      const userinfo = await db('user')
        .select('account, remote_login')
        .where({
          username,
          state: 1,
          account: { '!=': appConfig.notifyAccount },
        })
        .findOne();

      if (!userinfo) {
        _err(res, '用户无法免密登录')(req, username, 1);
        return;
      }

      const { remote_login } = userinfo;

      if (remote_login === 0) {
        _err(res, '用户未开启免密登录')(
          req,
          `${username}-${userinfo.account}`,
          1
        );
        return;
      }

      const key = `${userinfo.account}_${code}`;

      if (!verifyCode.has(key)) {
        _nothing(res);
        return;
      }

      // 轮询请求一直到key被赋值，获取账号信息并删除记录，种下cookie
      const account = verifyCode.get(key);

      verifyCode.delete(key);

      await jwt.setCookie(res, {
        account,
        username,
      });

      const { os, ip } = req[kHello];

      await heperMsgAndForward(
        req,
        account,
        `您的账号通过免密验证，在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`
      );

      _success(res, '登录成功', {
        account,
        username,
      })(req, `${username}-${account}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { flag, theme } = req[kValidate];
      const { ip } = req[kHello];
      if (!captchaVerifyLimit.verify(ip, flag)) {
        _err(res, '请稍后再试')(req, flag, 1);
        return;
      }
      captchaVerifyLimit.add(ip, flag);
      _success(res, 'ok', await captcha.get(flag, theme));
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
        })
      ),
    })
  ),
  async (req, res) => {
    try {
      const { id, track } = req[kValidate];
      const { ip } = req[kHello];
      const { flag } = captcha.getValue(id) || {};
      if (flag) {
        if (!captchaVerifyLimit.verify(ip, flag)) {
          _err(res, '请稍后再试')(req, flag, 1);
          return;
        }

        if (!captcha.verify(id, track)) {
          captchaVerifyLimit.add(ip, flag);
          _err(res, '验证失败，请重试')(req, flag, 1);
          return;
        }

        captchaVerifyLimit.delete(ip, flag);
        _success(res, '验证成功')(req, flag, 1);
      } else {
        _err(res, '验证失败，请重试')(req, id, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
      captchaId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { username, password, captchaId } = req[kValidate];
      const needCaptcha = !loginVerifyLimit.verify(username);

      if (needCaptcha && !captcha.consume(captchaId, username)) {
        _success(res, '需要验证验证码，请完成验证', {
          needCaptcha,
          username,
        })(req, username, 1);
        return;
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
        _err(res, '用户名或密码错误，请重新输入')(req, username, 1);
        return;
      }

      const { verify, account } = userinfo;

      // 验证密码，如果未设置密码或密码正确
      if (
        !userinfo.password ||
        (await _crypto.verifyPassword(password, userinfo.password))
      ) {
        if (verify) {
          // 如果开启两部验证，则继续验证身份
          _success(res, '账号密码验证成功，请完成两步验证', {
            account,
            verify: true,
          })(req, `${username}-${account}`, 1);
        } else {
          await jwt.setCookie(res, {
            account,
            username,
          });

          const { os, ip } = req[kHello];

          await heperMsgAndForward(
            req,
            account,
            `您的账号在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`
          );

          _success(res, '登录成功', { account, username })(
            req,
            `${username}-${account}`,
            1
          );
        }
      } else {
        loginVerifyLimit.add(username);

        _err(res, '用户名或密码错误，请重新输入')(
          req,
          `${username}-${account}`,
          1
        );
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
      captchaId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { token, account, password, captchaId } = req[kValidate];
      const needCaptcha = !towfaVerify.verify(account);

      if (needCaptcha && !captcha.consume(captchaId, account)) {
        _success(res, '需要验证验证码，请完成验证', {
          needCaptcha,
          account,
        })(req, account, 1);
        return;
      }

      const user = await getUserInfo(account, 'username,verify,password');

      if (!user) {
        towfaVerify.add(account);
        _err(res, '用户无法两步验证')(req, account, 1);
        return;
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

        const { os, ip } = req[kHello];

        await heperMsgAndForward(
          req,
          account,
          `您的账号在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`
        );

        _success(res, '登录成功', { account, username })(
          req,
          `${username}-${account}`,
          1
        );
      } else {
        towfaVerify.add(account);
        _err(res, '验证码错误，请重新输入')(req, `${username}-${account}`, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 发送邮件验证码
route.get(
  '/mail-code',
  validate(
    'query',
    V.object({
      username: V.string().trim().min(1).max(fieldLength.username),
      captchaId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { username, captchaId } = req[kValidate];

      if (!captcha.consume(captchaId, username)) {
        _success(res, '需要验证验证码，请完成验证', {
          needCaptcha: true,
          username,
        })(req, username, 1);
        return;
      }

      if (!_d.email.state) {
        _err(res, '邮箱验证功能已关闭')(req, username, 1);
        return;
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
        _err(res, '用户无法验证邮箱')(req, username, 1);
        return;
      }

      const { account, email } = userinfo;

      if (!email) {
        _err(res, '用户未绑定邮箱')(req, `${username}-${account}`, 1);
        return;
      }

      if (mailer.get(email)) {
        // 如果有缓存
        _success(res, '验证码已发送', { account, email })(
          req,
          `${username}-${account}`,
          1
        );

        return;
      }

      const code = Math.random().toFixed(6).slice(2);

      await mailer.sendCode(email, code);
      _success(res, '验证码发送成功', { account, email })(
        req,
        `${username}-${account}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
      captchaId: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { email, code, account, captchaId } = req[kValidate];
      const needCaptcha = !emailVerify.verify(email);
      if (needCaptcha && !captcha.consume(captchaId, account)) {
        _success(res, '需要验证验证码，请完成验证', {
          needCaptcha,
          account,
        })(req, account, 1);
        return;
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
        _err(res, '用户无法重置密码')(req, account, 1);
        return;
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

        _success(res, '已重置密码为空，请尽快修改密码', {
          account,
          username,
        })(req, `${username}-${account}`, 1);
      } else {
        emailVerify.add(email);

        _err(res, '验证码错误，请重新输入')(req, `${username}-${account}`, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 未登录用户访问指定文件的临时权限
route.get(
  '/file-token',
  validate(
    'query',
    V.object({
      p: V.string().notEmpty().min(1).max(fieldLength.url),
    })
  ),
  async (req, res) => {
    try {
      const { p } = req[kValidate];

      const token = await jwt.set(
        {
          type: 'temAccessFile',
          data: { account: req[kHello].userinfo.account, p },
        },
        fieldLength.shareTokenExp
      );

      _success(res, '获取fileToken成功', token)(req, token, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取字体列表
route.get('/font-list', async (req, res) => {
  try {
    _success(res, 'ok', await getFontList());
  } catch (error) {
    _err(res)(req, error);
  }
});

// 发送邮件验证码
route.post(
  '/bind-mail-code',
  validate(
    'body',
    V.object({
      email: V.string().trim().min(1).max(fieldLength.email).email(),
    })
  ),
  async (req, res) => {
    try {
      const { email } = req[kValidate];

      if (!_d.email.state) {
        _err(res, '邮箱验证功能已关闭')(req, email, 1);
        return;
      }

      if (mailer.get(email)) {
        _success(res, '验证码已发送')(req, email, 1);
        return;
      }

      const userinfo = await db('user')
        .select('account')
        .where({ email })
        .findOne();

      if (userinfo) {
        _err(res, '邮箱已绑定用户')(req, email, 1);
        return;
      }

      const code = Math.random().toFixed(6).slice(2);

      await mailer.sendCode(email, code);

      _success(res, '验证码发送成功')(req, email, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 绑定邮箱
route.post(
  '/bind-email',
  validate(
    'body',
    V.object({
      email: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .min(1)
        .max(fieldLength.email)
        .email(),
      code: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .min(6)
        .max(6)
        .alphanumeric(),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { email, code, password } = req[kValidate];

      const { account, password: pd } = req[kHello].userinfo;

      if (pd && !(await _crypto.verifyPassword(password, pd))) {
        _err(res, '密码错误，请重新输入')(req, email, 1);
        return;
      }

      if (!code) {
        await db('user').where({ account, state: 1 }).update({ email: '' });

        syncUpdateData(req, 'userinfo');

        _success(res, '解绑邮箱成功')(req, email, 1);
        return;
      }

      if (!email) {
        paramErr(res, req, 'email 不能为空', 'body');
        return;
      }

      const userinfo = await db('user')
        .select('account')
        .where({ email })
        .findOne();

      if (userinfo) {
        _err(res, '邮箱已绑定用户')(req, email, 1);
        return;
      }

      if (mailer.get(email) === code) {
        await db('user').where({ account, state: 1 }).update({ email });

        mailer.del(email);

        syncUpdateData(req, 'userinfo');

        _success(res, '绑定邮箱成功')(req, email, 1);
      } else {
        _err(res, '验证码错误，请重新输入')(req, email, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取临时两部验证token
route.get('/verify', async (req, res) => {
  try {
    const { account } = req[kHello].userinfo;

    _success(res, 'ok', _2fa.create(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 设置两部验证
route.post(
  '/verify',
  validate(
    'body',
    V.object({
      token: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .min(6)
        .max(6)
        .alphanumeric(),
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { token, password } = req[kValidate];

      const { account, password: pd } = req[kHello].userinfo;
      if (pd && !(await _crypto.verifyPassword(password, pd))) {
        _err(res, '密码错误，请重新输入')(req);
        return;
      }

      if (!token) {
        await db('user').where({ account, state: 1 }).update({ verify: '' });

        syncUpdateData(req, 'userinfo');

        _success(res, '关闭两步验证成功')(req);
        return;
      }

      const verify = _2fa.create(account);

      // 验证token
      if (_2fa.verify(verify, token)) {
        await db('user').where({ account, state: 1 }).update({ verify });

        syncUpdateData(req, 'userinfo');

        _2fa.del(account); // 成功后删除token缓存

        _success(res, '开启两步验证成功')(req);
      } else {
        _err(res, '验证码错误，请重新输入')(req);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// tips标识
route.get('/tips', async (req, res) => {
  try {
    _success(res, 'ok', _d.tipsFlag);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 批准登录
route.post(
  '/allow-code-login',
  validate(
    'body',
    V.object({ code: V.string().trim().min(6).max(6).alphanumeric() })
  ),
  async (req, res) => {
    try {
      const { code } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const key = `${account}_${code}`;

      // 登录码冲突则中断验证
      if (verifyCode.has(key)) {
        _err(res, '登录码冲突，请刷新登录码再试')(req);
        return;
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

          _err(res, '批准登录超时')(req);
          return;
        }

        if (!verifyCode.has(key)) {
          clearInterval(timer);
          timer = null;

          _success(res, '批准登录成功')(req);
        }
      }, 1000);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 修改密码
route.post(
  '/change-pd',
  validate(
    'body',
    V.object({
      oldpassword: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      newpassword: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { account, password } = req[kHello].userinfo,
        { oldpassword, newpassword } = req[kValidate];

      //对比原密码
      if ((await _crypto.verifyPassword(oldpassword, password)) || !password) {
        await db('user')
          .where({ account, state: 1 })
          .update({
            password: await _crypto.hashPassword(newpassword),
            exp_token_time: parseInt(Date.now() / 1000),
          });

        _success(res, '修改密码成功，请重新登录')(req);
      } else {
        _err(res, '原密码错误，请重新输入')(req);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 退出登录
route.get(
  '/logout',
  validate('query', V.object({ other: V.number().toInt().enum([0, 1]) })),
  async (req, res) => {
    try {
      const { other } = req[kValidate];

      if (other === 1) {
        const { account, username } = req[kHello].userinfo;
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

      _success(res, '退出登录成功')(req, other, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 修改用户名
route.post(
  '/changename',
  validate(
    'body',
    V.object({ username: V.string().trim().min(1).max(fieldLength.username) })
  ),
  async (req, res) => {
    try {
      const { username } = req[kValidate];

      const userinfo = await db('user')
        .where({
          username,
        })
        .findOne();

      if (userinfo) {
        _err(res, '用户名无法使用')(req, username, 1);
        return;
      }

      const { account } = req[kHello].userinfo;

      await db('user').where({ account, state: 1 }).update({ username });

      await jwt.setCookie(res, {
        account,
        username,
      });

      syncUpdateData(req, 'userinfo');

      _success(res, '修改用户名成功')(req, username, 1);
    } catch (error) {
      _err(res)(req, error);
      return;
    }
  }
);

// 账号状态
route.post(
  '/delete-account',
  validate(
    'body',
    V.object({
      password: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { password } = req[kValidate];

      const { account, username, password: pd } = req[kHello].userinfo;

      if (pd && !(await _crypto.verifyPassword(password, pd))) {
        _err(res, '密码错误，请重新输入')(req);
        return;
      }

      if (req[kHello].isRoot || account === appConfig.notifyAccount) {
        _err(res, '无权操作')(req);
      } else {
        await deleteUser(account);

        res.clearCookie('token');

        const { os, ip } = req[kHello];

        await heperMsgAndForward(
          req,
          appConfig.adminAccount,
          `${username}(${account})，在 [${os}(${ip})] 注销账号成功`
        );

        _success(res, '注销账号成功')(req);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 用户信息
route.get('/userinfo', async (req, res) => {
  try {
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
    } = req[kHello].userinfo;

    verify = verify ? true : '';

    forward_msg_link = parseForwardMsgLink(forward_msg_link);

    const bgs = await db('bg')
      .select('url,id')
      .where({ id: { in: [bg, bgxs] } })
      .find();

    const bgObj = {};
    bgs.forEach((item) => {
      const { id } = item;
      bgObj[id] = item;
    });

    _success(res, 'ok', {
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
      bgObj,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除头像
route.get('/delete-logo', async (req, res) => {
  try {
    const { account } = req[kHello].userinfo;

    await db('user').where({ account, state: 1 }).update({ logo: '' });

    syncUpdateData(req, 'userinfo');

    _success(res, '删除头像成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

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
        .custom((v) => isImgFile(v), '必须为受支持的图片格式'),
      HASH: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      type: V.string()
        .trim()
        .enum(['userlogo', 'bookmark', 'engine', 'translator']),
      id: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.id)
        .alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { name, HASH, type, id } = req[kValidate];

      if (['bookmark', 'engine', 'translator'].includes(type) && !id) {
        paramErr(res, req, 'id 不能为空', 'query');
        return;
      }

      const { account } = req[kHello].userinfo;

      const timePath = getTimePath();

      const path = appConfig.logoDir(account, timePath);

      await receiveFiles(
        req,
        path,
        `${HASH}.${_path.extname(name)[2]}`,
        fieldLength.maxLogoSize,
        HASH
      );

      const logo = _path.normalize(
        timePath,
        `${HASH}.${_path.extname(name)[2]}`
      );

      if (type === 'bookmark') {
        await db('bmk')
          .where({ account, id, state: 1 })
          .update({ logo: _path.normalize('/logo', account, logo) });

        syncUpdateData(req, 'bookmark');

        _success(res, '更新书签LOGO成功')(req, logo, 1);
      } else if (type === 'userlogo') {
        await db('user').where({ account, state: 1 }).update({ logo });

        syncUpdateData(req, 'userinfo');

        _success(res, '更新头像成功')(req, logo, 1);
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
            syncUpdateData(req, 'searchConfig');
          }
        }
        _success(res, '更新搜索引擎LOGO成功')(req, logo, 1);
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
            syncUpdateData(req, 'searchConfig');
          }
        }
        _success(res, '更新翻译接口LOGO成功')(req, logo, 1);
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 每日更换壁纸
route.get('/daily-change-bg', async (req, res) => {
  try {
    const { account, daily_change_bg } = req[kHello].userinfo;

    let tem;

    if (daily_change_bg === 1) {
      tem = 0;
    } else {
      tem = 1;
    }
    await db('user')
      .where({ account, state: 1 })
      .update({ daily_change_bg: tem });

    syncUpdateData(req, 'userinfo');

    if (tem === 1) {
      _success(res, '成功开启')(req, '开启每日更新壁纸');
    } else {
      _success(res, '成功关闭')(req, '关闭每日更新壁纸');
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 隐身状态
route.get('/hide-state', async (req, res) => {
  try {
    const { account, hide } = req[kHello].userinfo;

    let tem;

    if (hide === 1) {
      tem = 0;
    } else {
      tem = 1;
    }

    await db('user').where({ account, state: 1 }).update({ hide: tem });

    syncUpdateData(req, 'userinfo');

    if (tem === 1) {
      _success(res, '成功开启')(req, '开启隐身');
    } else {
      onlineMsg(req, 1); // 通知上线

      _success(res, '成功关闭')(req, '关闭隐身');
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 免密登录状态
route.get('/remote-login-state', async (req, res) => {
  try {
    const { account, remote_login } = req[kHello].userinfo;

    let tem;

    if (remote_login === 1) {
      tem = 0;
    } else {
      tem = 1;
    }

    await db('user').where({ account, state: 1 }).update({ remote_login: tem });

    syncUpdateData(req, 'userinfo');

    if (tem === 1) {
      _success(res, '成功开启')(req, '开启免密登录');
    } else {
      _success(res, '成功关闭')(req, '关闭免密登录');
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 更新在线时间
route.get('/update-time', async (req, res) => {
  try {
    await db('user')
      .where({ account: req[kHello].userinfo.account, state: 1 })
      .update({ update_at: Date.now() });

    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

function getMsgs(con, id, flag) {
  // 获取未读取的消息
  let msgs = con.msgs.slice(0);

  const idx = msgs.findIndex((item) => item.flag === flag);

  if (idx >= 0) {
    msgs = msgs.slice(idx + 1);
  }

  // 过滤掉发送者
  msgs = msgs.filter((item) => item.id != id);

  return msgs.map((item) => item.data);
}

// 获取推送消息
route.get(
  '/real-time',
  validate(
    'query',
    V.object({
      flag: V.string().trim().default('').allowEmpty().max(10).alphanumeric(),
      page: V.string().trim().default('').allowEmpty().max(20),
    })
  ),
  async (req, res) => {
    try {
      const { account } = req[kHello].userinfo;

      let id = req[kHello].temid;

      try {
        id = await V.parse(
          id,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'temid'
        );
      } catch (error) {
        paramErr(res, req, error, { temid: id });
        return;
      }

      let { flag, page } = req[kValidate]; //标识和设备ID

      if (page === 'home') {
        // 主页才通知在线
        onlineMsg(req);
      }

      req[kHello].page = page;

      const con = _connect.add(account, cb, req[kHello]);

      //初始化指令标识
      if (!flag) {
        flag = con.flag;
      }

      let msgs = [];

      function cb() {
        msgs = getMsgs(con, id, flag);
        // 验证标识和是否有推送消息
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

        con.cbs = con.cbs.filter((item) => item !== cb);

        if (state) {
          _success(res, 'ok', { flag: con.flag, msgs });
        } else {
          _nothing(res, 'ok', { flag: con.flag });
        }
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
        ]),
      data: V.object(),
    })
  ),
  async (req, res) => {
    try {
      const { account } = req[kHello].userinfo;

      let id = req[kHello].temid;

      const { type, data } = req[kValidate]; //指令内容和登录设备ID

      try {
        id = await V.parse(
          id,
          V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
          'temid'
        );
      } catch (error) {
        paramErr(res, req, error, { temid: id });
        return;
      }

      // 多端同步数据
      if (type === 'updatedata') {
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
                  'file',
                  'searchConfig',
                ]),
              id: V.string()
                .trim()
                .default('')
                .allowEmpty()
                .max(fieldLength.id)
                .alphanumeric(),
            }),
            'data'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
        }
        const { flag, id } = _vdata;

        syncUpdateData(req, flag, id);
        _success(res);
      }

      // 远程播放歌曲
      else if (type === 'play') {
        try {
          data.state = await V.parse(
            data.state,
            V.number().toInt().enum([1, 0]),
            'data.state'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
        }

        if (data.state === 1) {
          try {
            data.obj = await V.parse(data.obj, V.object(), 'data.obj');
          } catch (error) {
            paramErr(res, req, error, 'body');
            return;
          }
        }

        data.to = account;

        _connect.send(data.to, id, { type, data });

        _success(res);
      }
      // 控制播放模式
      else if (type === 'playmode') {
        try {
          data.state = await V.parse(
            data.state,
            V.string().trim().enum(['random', 'loop', 'order']),
            'data.state'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
        }

        data.to = account;

        _connect.send(data.to, id, { type, data });

        _success(res);
      }
      // 控制音量
      else if (type === 'vol') {
        try {
          data.value = await V.parse(
            data.value,
            V.number().toNumber().min(0).max(1),
            'data.value'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
        }

        data.to = account;

        _connect.send(data.to, id, { type, data });

        _success(res);
      }
      // 控制播放进度
      else if (type === 'progress') {
        try {
          data.value = await V.parse(
            data.value,
            V.number().toNumber().min(0).max(1),
            'data.value'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
        }

        data.to = account;

        _connect.send(data.to, id, { type, data });

        _success(res);
      }
      // 聊天室
      else if (type === 'chat') {
        try {
          data.to = await V.parse(
            data.to,
            V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
            'data.to'
          );
          data.flag = await V.parse(
            data.flag,
            V.string().trim().enum(['addmsg', 'del', 'clear']),
            'data.flag'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
        }

        // 撤回、清空、发送新消息操作
        // 如果是删除验证消息id
        if (data.flag === 'del') {
          try {
            data.msgData = await V.parse(
              data.msgData,
              V.object(),
              'data.msgData'
            );
            data.msgData.msgId = await V.parse(
              data.msgData.msgId,
              V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
              'data.msgData.msgId'
            );
          } catch (error) {
            paramErr(res, req, error, 'body');
            return;
          }
        }

        await sendNotifyMsg(req, data.to, data.flag, data.msgData);

        _success(res);
      }
      // 文件粘贴数据
      else if (type === 'pastefiledata') {
        try {
          data.type = await V.parse(
            data.type,
            V.string().trim().default('').allowEmpty().enum(['copy', 'cut']),
            'data.type'
          );
        } catch (error) {
          paramErr(res, req, error, 'body');
          return;
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
                })
              )
                .min(1)
                .max(fieldLength.maxPagesize),
              'data.data'
            );
          } catch (error) {
            paramErr(res, req, error, 'body');
            return;
          }

          _connect.send(account, id, { type, data });
          _success(res);
        } else {
          _connect.send(account, id, { type, data: {} });
          _success(res);
        }
      }
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { ids } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('share')
        .where({ id: { in: ids }, account })
        .delete();

      syncUpdateData(req, 'sharelist');

      _success(res, '删除分享成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取分享列表
route.get(
  '/share-list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(20)
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { pageNo, pageSize } = req[kValidate];

      const { account } = req[kHello].userinfo;

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

      _success(res, 'ok', {
        ...result,
        data,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
      pass: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.sharePass),
    })
  ),
  async (req, res) => {
    try {
      const { id, title, expireTime, pass } = req[kValidate];

      const obj = {
        exp_time:
          expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
        title,
        pass,
      };

      const { account } = req[kHello].userinfo;

      await db('share').where({ id, account }).update(obj);

      syncUpdateData(req, 'sharelist');

      _success(res, '更新分享成功')(req, `${title}-${id}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 回收站列表
route.get(
  '/trash-list',
  validate(
    'query',
    V.object({
      type: V.string().trim().enum(['note', 'bmk', 'bmk_group', 'history']),
      word: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(20)
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { word, type, pageNo, pageSize } = req[kValidate];

      let fieldArr = [];
      let fields = '';

      if (type === 'bmk') {
        fields = 'id,title,link,des,group_id,group_title,logo';
        fieldArr = ['title', 'link', 'des'];
      } else if (type === 'history') {
        fields = 'id,content';
        fieldArr = ['content'];
      } else if (type === 'bmk_group') {
        fields = 'id,title';
        fieldArr = ['title'];
      } else if (type === 'note') {
        fields = 'id,title,content,category';
        fieldArr = ['title', 'content'];
      }

      const { account } = req[kHello].userinfo;
      const trashdb = db(type === 'bmk' ? 'bmk_bmk_group_view' : type)
        .select(fields)
        .where({
          account,
          state: 0,
        });

      let splitWord = [];

      if (word) {
        splitWord = getSplitWord(word);

        const curSplit = splitWord.slice(0, 10);
        curSplit[0] = { value: curSplit[0], weight: 10 };
        trashdb.search(curSplit, fieldArr, { sort: true });
      } else {
        trashdb.orderBy(type === 'note' ? 'create_at' : 'serial', 'desc');
      }

      const total = await trashdb.count();

      const result = createPagingData(Array(total), pageSize, pageNo);

      const offset = (result.pageNo - 1) * pageSize;

      let data = [];

      if (total > 0) {
        data = await trashdb.page(pageSize, offset).find();

        if (type === 'note') {
          const noteCategory = await db('note_category')
            .select('id,title')
            .where({ account })
            .find();

          data = data.map((item) => {
            let { title, content, id, category } = item;
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
                  (item) =>
                    item.value.toLowerCase() === splitWord[0].toLowerCase()
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
            const categoryArr = noteCategory.filter((item) =>
              cArr.includes(item.id)
            );

            return {
              id,
              title,
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
        }
      }

      _success(res, 'ok', {
        ...result,
        data,
        splitWord,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除回收站
route.post(
  '/delete-trash',
  validate(
    'body',
    V.object({
      type: V.string().trim().enum(['bmk_group', 'bmk', 'note', 'history']),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { ids, type } = req[kValidate];

      const { account } = req[kHello].userinfo;

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
            await _f.rename(noteHistoryDir, _path.normalize(trashDir, id));
          }
        });
      }

      syncUpdateData(req, 'trash');

      _success(res, '删除成功')(req, `${type}-${ids.length}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 恢复回收站内容
route.post(
  '/recover-trash',
  validate(
    'body',
    V.object({
      type: V.string().trim().enum(['bmk_group', 'bmk', 'note', 'history']),
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      let { ids, type } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db(type)
        .where({ id: { in: ids }, account, state: 0 })
        .update({ state: 1 });

      syncUpdateData(req, 'trash');

      if (type === 'bmk_group' || type === 'bmk') {
        type = 'bookmark';
      }

      syncUpdateData(req, type);

      _success(res, '恢复成功')(req, `${type}-${ids.length}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

export default route;
