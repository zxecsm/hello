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
  validaString,
  validationValue,
  _type,
  paramErr,
  receiveFiles,
  getTimePath,
  syncUpdateData,
  isImgFile,
  createPagingData,
  isEmail,
  getSplitWord,
  batchTask,
  concurrencyTasks,
  getWordContent,
} from '../../utils/utils.js';

import {
  insertData,
  updateData,
  deleteData,
  queryData,
  fillString,
  getTableRowCount,
  createSearchSql,
  createScoreSql,
} from '../../utils/sqlite.js';

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

import { playInConfig, getUserInfo, deleteUser, getFontList } from './user.js';

import jwt from '../../utils/jwt.js';
import { fieldLength } from '../config.js';
import _path from '../../utils/path.js';
import { getNoteHistoryDir, parseMarkDown } from '../note/note.js';
import { _delDir, getTrashDir, readMenu } from '../file/file.js';
import _crypto from '../../utils/crypto.js';
import getCity from '../../utils/getCity.js';
import nanoid from '../../utils/nanoid.js';

const verifyCode = new Map();

const route = express.Router();

// 记录错误
route.post('/error', async (req, res) => {
  try {
    const { err } = req.body;

    if (!validaString(err, 1, 0, 0, 1)) {
      paramErr(res, req);
      return;
    }

    await writelog(req, `[ ${err.slice(0, 1000)} ]`, 'panel_error');

    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 外部播放配置
route.get('/player-config', async (req, res) => {
  try {
    _success(res, 'ok', await playInConfig());
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取自定义code
route.get('/custom-code', async (req, res) => {
  try {
    const u = _path.normalize(appConfig.appData, 'custom');
    const headPath = _path.normalize(u, 'custom_head.html');
    const bodyPath = _path.normalize(u, 'custom_body.html');

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

    const sList = await readMenu(_path.normalize(appConfig.appData, 'tem'));

    let num = 0;

    await concurrencyTasks(sList, 5, async (item) => {
      const { name, path, time } = item;

      if (time < threshold) {
        await _delDir(_path.normalize(path, name));
        num++;
      }
    });

    if (num) {
      await writelog(false, `清理过期临时文件缓存：${num}`, 'user');
    }
  }
});

// 注册
route.post('/register', async (req, res) => {
  try {
    if (!_d.registerState || registerCount > 20) {
      _err(res, '已限制注册')(req);
      return;
    }

    const { username, password } = req.body;

    if (
      !validaString(username, 1, fieldLength.username) ||
      !validaString(password, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const users = await queryData('user', 'account', `WHERE username = ?`, [
      username,
    ]);

    if (users.length > 0) {
      _err(res, '用户名已注册')(req, username, 1);
      return;
    }

    // 写入用户数据
    const account = nanoid();

    await insertData(
      'user',
      [
        {
          update_at: Date.now(),
          account,
          username,
          chat_id: nanoid(),
          password: await _crypto.hashPassword(password),
        },
      ],
      'account'
    );

    // 种下Cookie
    jwt.setCookie(res, { account, username });

    registerCount++;

    await becomeFriends(account, 'chang');
    await becomeFriends(account, 'hello');

    const { os, ip } = req._hello;

    await heperMsgAndForward(
      req,
      'root',
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
});

// 批准登录请求
route.post('/allow-login-req', async (req, res) => {
  try {
    const { code, username } = req.body;

    if (
      !validaString(code, 6, 6, 1) ||
      !validaString(username, 1, fieldLength.username)
    ) {
      paramErr(res, req);
      return;
    }

    const userinfo = (
      await queryData(
        'user',
        'account,remote_login',
        `WHERE username = ? AND state = ? AND account != ?`,
        [username, 1, 'hello']
      )
    )[0];

    if (!userinfo) {
      _err(res, '用户不存在')(req, username, 1);
      return;
    }

    const { account, remote_login } = userinfo;

    if (remote_login === 0) {
      _err(res, '用户未开启免密登录')(req, `${username}-${account}`, 1);
      return;
    }

    const { ip, os } = req._hello;

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
});

// 免密登录
route.post('/code-login', async (req, res) => {
  try {
    const { code, username } = req.body;

    if (
      !validaString(code, 6, 6, 1) ||
      !validaString(username, 1, fieldLength.username)
    ) {
      paramErr(res, req);
      return;
    }

    const userinfo = (
      await queryData(
        'user',
        'account,remote_login',
        `WHERE username = ? AND state = ? AND account != ?`,
        [username, 1, 'hello']
      )
    )[0];

    if (!userinfo) {
      _err(res, '用户不存在')(req, username, 1);
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

    jwt.setCookie(res, {
      account,
      username,
    });

    const { os, ip } = req._hello;

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
});

// 登录
const loginVerifyLimit = verifyLimit();
route.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body,
      ip = req._hello.ip;

    if (
      !validaString(username, 1, fieldLength.username) ||
      !validaString(password, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    // ip登录错误次数是否超限制
    if (loginVerifyLimit.verify(ip, username)) {
      const userinfo = (
        await queryData(
          'user',
          'verify,account,password',
          `WHERE username = ? AND state = ? AND account != ?`,
          [username, 1, 'hello']
        )
      )[0];

      if (!userinfo) {
        _err(res, '用户不存在')(req, username, 1);
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
          jwt.setCookie(res, {
            account,
            username,
          });

          const { os, ip } = req._hello;

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
        loginVerifyLimit.add(ip, username);

        _err(res, '登录密码错误，请重新输入')(req, `${username}-${account}`, 1);
      }
    } else {
      _err(res, '登录密码多次错误，请10分钟后再试')(req, username, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 两步验证
const towfaVerify = verifyLimit();
route.post('/verify-login', async (req, res) => {
  try {
    const { token, account, password } = req.body;

    if (
      !validaString(token, 6, 6, 1) ||
      !validaString(account, 1, fieldLength.id, 1) ||
      !validaString(password, 1, fieldLength.id, 1) ||
      account === 'hello'
    ) {
      paramErr(res, req);
      return;
    }

    const ip = req._hello.ip;

    // 限制验证次数
    if (towfaVerify.verify(ip, account)) {
      const user = await getUserInfo(account, 'username,verify,password');

      if (!user) {
        _err(res, '用户不存在')(req, account, 1);
        return;
      }

      const { username, verify, password: pd } = user;

      // 验证密码和验证码
      if (
        (!pd || (await _crypto.verifyPassword(password, pd))) &&
        verify &&
        _2fa.verify(verify, token)
      ) {
        jwt.setCookie(res, {
          account,
          username,
        });

        const { os, ip } = req._hello;

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
        towfaVerify.add(ip, account);
        _err(res, '验证码错误')(req, `${username}-${account}`, 1);
      }
    } else {
      _err(res, '验证码多次错误，请10分钟后再试')(req, account, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 发送邮件验证码
route.get('/mail-code', async (req, res) => {
  try {
    const { username } = req.query;

    if (!validaString(username, 1, fieldLength.username)) {
      paramErr(res, req);
      return;
    }

    if (!_d.email.state) {
      _err(res, '管理员未开启邮箱验证功能')(req, username, 1);
      return;
    }

    const userinfo = (
      await queryData(
        'user',
        'account,email',
        `WHERE username = ? AND state = ? AND account != ?`,
        [username, 1, 'hello']
      )
    )[0];

    if (!userinfo) {
      _err(res, '用户不存在')(req, username, 1);
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
});

// 重置密码
const emailVerify = verifyLimit();
route.post('/reset-pass', async (req, res) => {
  try {
    const { email, code, account } = req.body;

    if (
      !validaString(email, 1, fieldLength.email) ||
      !isEmail(email) ||
      !validaString(code, 6, 6, 1) ||
      !validaString(account, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const ip = req._hello.ip;

    if (emailVerify.verify(ip, email)) {
      const userinfo = (
        await queryData(
          'user',
          'username',
          `WHERE email = ? AND account = ? AND state = ? AND account != ?`,
          [email, account, 1, 'hello']
        )
      )[0];

      if (!userinfo) {
        _err(res, '用户不存在')(req, account, 1);
        return;
      }

      const { username } = userinfo;

      if (mailer.get(email) === code) {
        // 清除密码和两部验证token
        await updateData(
          'user',
          {
            password: '',
            verify: '',
            exp_token_time: parseInt(Date.now() / 1000) - 2,
          },
          `WHERE account = ? AND state = ?`,
          [account, 1]
        );

        jwt.setCookie(res, {
          account,
          username,
        });

        // 删除验证码缓存
        mailer.del(email);

        _success(res, '已重置密码为空，请尽快修改密码', { account, username })(
          req,
          `${username}-${account}`,
          1
        );
      } else {
        emailVerify.add(ip, email);

        _err(res, '验证码错误')(req, `${username}-${account}`, 1);
      }
    } else {
      _err(res, '验证码多次错误，请10分钟后再试')(req, account, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 验证登录态
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 未登录用户访问指定文件的临时权限
route.get('/file-token', async (req, res) => {
  try {
    const { p } = req.query;

    if (!validaString(p, 1, fieldLength.url)) {
      paramErr(res, req);
      return;
    }

    const token = jwt.set(
      {
        type: 'temAccessFile',
        data: { account: req._hello.userinfo.account, p },
      },
      fieldLength.shareTokenExp
    );

    _success(res, '获取fileToken成功', token)(req, token, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取字体列表
route.get('/font-list', async (req, res) => {
  try {
    _success(res, 'ok', await getFontList());
  } catch (error) {
    _err(res)(req, error);
  }
});

// 发送邮件验证码
route.post('/bind-mail-code', async (req, res) => {
  try {
    const { email } = req.body;

    if (!validaString(email, 1, fieldLength.email) || !isEmail(email)) {
      paramErr(res, req);
      return;
    }

    if (!_d.email.state) {
      _err(res, '管理员未开启邮箱验证功能')(req, email, 1);
      return;
    }

    if (mailer.get(email)) {
      _success(res, '验证码已发送')(req, email, 1);
      return;
    }

    const userinfo = (
      await queryData('user', 'account', `WHERE email = ?`, [email])
    )[0];

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
});

// 绑定邮箱
route.post('/bind-email', async (req, res) => {
  try {
    const { email, code, password } = req.body;

    if (!validaString(password, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account, password: pd } = req._hello.userinfo;

    if (pd && !(await _crypto.verifyPassword(password, pd))) {
      _err(res, '密码错误')(req, email, 1);
      return;
    }

    if (!code) {
      await updateData(
        'user',
        {
          email: '',
        },
        `WHERE account = ? AND state = ?`,
        [account, 1]
      );

      syncUpdateData(req, 'userinfo');

      _success(res, '解绑邮箱成功')(req, email, 1);
      return;
    }

    if (
      !validaString(email, 1, fieldLength.email) ||
      !isEmail(email) ||
      !validaString(code, 6, 6, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const userinfo = (
      await queryData('user', 'account', `WHERE email = ?`, [email])
    )[0];

    if (userinfo) {
      _err(res, '邮箱已绑定用户')(req, email, 1);
      return;
    }

    if (mailer.get(email) === code) {
      await updateData(
        'user',
        {
          email,
        },
        `WHERE account = ? AND state = ?`,
        [account, 1]
      );

      mailer.del(email);

      syncUpdateData(req, 'userinfo');

      _success(res, '绑定邮箱成功')(req, email, 1);
    } else {
      _err(res, '验证码错误')(req, email, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取临时两部验证token
route.get('/verify', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    _success(res, 'ok', _2fa.create(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 设置两部验证
route.post('/verify', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!validaString(password, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account, password: pd } = req._hello.userinfo;
    if (pd && !(await _crypto.verifyPassword(password, pd))) {
      _err(res, '密码错误')(req);
      return;
    }

    if (!token) {
      await updateData(
        'user',
        { verify: '' },
        `WHERE account = ?  AND state = ?`,
        [account, 1]
      );

      syncUpdateData(req, 'userinfo');

      _success(res, '关闭两步验证成功')(req);
      return;
    }

    if (!validaString(token, 6, 6, 1)) {
      paramErr(res, req);
      return;
    }

    const verify = _2fa.create(account);

    // 验证token
    if (_2fa.verify(verify, token)) {
      await updateData('user', { verify }, `WHERE account = ?  AND state = ?`, [
        account,
        1,
      ]);

      syncUpdateData(req, 'userinfo');

      _2fa.del(account); // 成功后删除token缓存

      _success(res, '开启两步验证成功')(req);
    } else {
      _err(res, '验证码错误')(req);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// tips标识
route.get('/tips', async (req, res) => {
  try {
    _success(res, 'ok', _d.tipsFlag);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 批准登录
route.post('/allow-code-login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!validaString(code, 6, 6, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

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
});

// 修改密码
route.post('/change-pd', async (req, res) => {
  try {
    const { account, password } = req._hello.userinfo,
      { oldpassword, newpassword } = req.body;

    if (
      !validaString(oldpassword, 1, fieldLength.id, 1) ||
      !validaString(newpassword, 1, fieldLength.id, 1)
    ) {
      paramErr(res, req);
      return;
    }

    //对比原密码
    if ((await _crypto.verifyPassword(oldpassword, password)) || !password) {
      await updateData(
        'user',
        {
          password: await _crypto.hashPassword(newpassword),
          exp_token_time: parseInt(Date.now() / 1000),
        },
        `WHERE account = ? AND state = ?`,
        [account, 1]
      );

      _success(res, '修改密码成功，请重新登录')(req);
    } else {
      _err(res, '原密码错误，请重新输入')(req);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 退出登录
route.get('/logout', async (req, res) => {
  try {
    let { other } = req.query;
    other = +other;

    if (!validationValue(other, [1, 0])) {
      paramErr(res, req);
      return;
    }

    if (other === 1) {
      const { account, username } = req._hello.userinfo;
      //退出其他登录设备
      await updateData(
        'user',
        {
          exp_token_time: parseInt(Date.now() / 1000) - 2,
        },
        `WHERE account = ? AND state = ?`,
        [account, 1]
      );

      jwt.setCookie(res, {
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
});

// 修改用户名
route.post('/changename', async (req, res) => {
  try {
    const { username } = req.body;

    if (!validaString(username, 1, fieldLength.username)) {
      paramErr(res, req);
      return;
    }

    const users = await queryData('user', 'account', `WHERE username = ?`, [
      username,
    ]);

    if (users.length > 0) {
      _err(res, '用户名已注册')(req, username, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      'user',
      {
        username,
      },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    jwt.setCookie(res, {
      account,
      username,
    });

    syncUpdateData(req, 'userinfo');

    _success(res, '修改用户名成功')(req, username, 1);
  } catch (error) {
    _err(res)(req, error);
    return;
  }
});

// 账号状态
route.post('/delete-account', async (req, res) => {
  try {
    const { password } = req.body;

    if (!validaString(password, 1, fieldLength.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account, username, password: pd } = req._hello.userinfo;

    if (pd && !(await _crypto.verifyPassword(password, pd))) {
      _err(res, '密码错误')(req);
      return;
    }

    if (req._hello.isRoot || account === 'hello') {
      _err(res, '无权操作')(req);
    } else {
      await deleteUser(account);

      res.clearCookie('token');

      const { os, ip } = req._hello;

      await heperMsgAndForward(
        req,
        'root',
        `${username}(${account})，在 [${os}(${ip})] 注销账号成功`
      );

      _success(res, '注销账号成功')(req);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

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
    } = req._hello.userinfo;

    verify = verify ? true : '';

    forward_msg_link = parseForwardMsgLink(forward_msg_link);

    const bgs = await queryData('bg', 'url,id', `WHERE id IN (?,?)`, [
      bg,
      bgxs,
    ]);

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
    const { account } = req._hello.userinfo;

    await updateData(
      'user',
      {
        logo: '',
      },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

    syncUpdateData(req, 'userinfo');

    _success(res, '删除头像成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 上传logo
route.post('/up-logo', async (req, res) => {
  try {
    const { name, HASH, type, id } = req.query;

    if (
      !isImgFile(name) ||
      !validaString(HASH, 1, fieldLength.id, 1) ||
      !validationValue(type, ['bookmark', 'userlogo']) ||
      (type === 'bookmark' && !validaString(id, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const timePath = getTimePath();

    const path = _path.normalize(appConfig.appData, 'logo', account, timePath);

    await _f.mkdir(path);
    await receiveFiles(req, path, `${HASH}.${_path.extname(name)[2]}`, 5, HASH);

    const logo = _path.normalize(timePath, `${HASH}.${_path.extname(name)[2]}`);

    if (type === 'bookmark') {
      await updateData(
        'bmk',
        { logo: _path.normalize('/logo', account, logo) },
        `WHERE account = ? AND id = ? AND state = ?`,
        [account, id, 1]
      );

      syncUpdateData(req, 'bookmark');

      _success(res, '更新书签LOGO成功')(req, logo, 1);
    } else if (type === 'userlogo') {
      await updateData(
        'user',
        {
          logo,
        },
        `WHERE account = ? AND state = ?`,
        [account, 1]
      );

      syncUpdateData(req, 'userinfo');

      _success(res, '更新头像成功')(req, logo, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 每日更换壁纸
route.get('/daily-change-bg', async (req, res) => {
  try {
    const { account, daily_change_bg } = req._hello.userinfo;

    let tem;

    if (daily_change_bg === 1) {
      tem = 0;
    } else {
      tem = 1;
    }
    await updateData(
      'user',
      {
        daily_change_bg: tem,
      },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

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
    const { account, hide } = req._hello.userinfo;

    let tem;

    if (hide === 1) {
      tem = 0;
    } else {
      tem = 1;
    }

    await updateData(
      'user',
      {
        hide: tem,
      },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

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
    const { account, remote_login } = req._hello.userinfo;

    let tem;

    if (remote_login === 1) {
      tem = 0;
    } else {
      tem = 1;
    }

    await updateData(
      'user',
      {
        remote_login: tem,
      },
      `WHERE account = ? AND state = ?`,
      [account, 1]
    );

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
    await updateData(
      'user',
      {
        update_at: Date.now(),
      },
      `WHERE account = ? AND state = ?`,
      [req._hello.userinfo.account, 1]
    );

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
route.get('/real-time', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const id = req._hello.temid;

    let { flag = '', page = '' } = req.query; //标识和设备ID

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(flag, 0, 10, 1) ||
      !validaString(page, 0, 20)
    ) {
      paramErr(res, req);
      return;
    }

    if (page === 'home') {
      // 主页才通知在线
      onlineMsg(req);
    }

    req._hello.page = page;

    const con = _connect.add(account, cb, req._hello);

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
});

// 接收指令
route.post('/real-time', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;

    const id = req._hello.temid;

    const cmd = req.body; //指令内容和登录设备ID

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !_type.isObject(cmd) ||
      !validationValue(cmd.type, [
        'updatedata',
        'chat',
        'playmode',
        'play',
        'vol',
        'progress',
        'pastefiledata',
      ])
    ) {
      paramErr(res, req);
      return;
    }

    const { type, data } = cmd;

    // 多端同步数据
    if (type === 'updatedata') {
      const { flag, id = '' } = data;
      if (
        !validationValue(flag, [
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
        ]) ||
        !validaString(id, 0, fieldLength.id, 1)
      ) {
        paramErr(res, req);
        return;
      }

      syncUpdateData(req, flag, id);
      _success(res);
    }

    // 远程播放歌曲
    else if (type === 'play') {
      if (!validationValue(data.state, [1, 0])) {
        paramErr(res, req);
        return;
      }

      if (data.state === 1) {
        if (!_type.isObject(data.obj)) {
          paramErr(res, req);
          return;
        }
      }

      data.to = account;

      _connect.send(data.to, id, { type, data });

      _success(res);
    }
    // 控制播放模式
    else if (type === 'playmode') {
      if (!validationValue(data.state, ['random', 'loop', 'order'])) {
        paramErr(res, req);
        return;
      }

      data.to = account;

      _connect.send(data.to, id, { type, data });

      _success(res);
    }
    // 控制音量
    else if (type === 'vol') {
      data.value = +data.value;

      if (isNaN(data.value) || data.value > 1 || data.value < 0) {
        paramErr(res, req);
        return;
      }

      data.to = account;

      _connect.send(data.to, id, { type, data });

      _success(res);
    }
    // 控制播放进度
    else if (type === 'progress') {
      data.value = +data.value;

      if (isNaN(data.value) || data.value > 1 || data.value < 0) {
        paramErr(res, req);
        return;
      }

      data.to = account;

      _connect.send(data.to, id, { type, data });

      _success(res);
    }
    // 聊天室
    else if (type === 'chat') {
      if (
        !validaString(data.to, 1, fieldLength.id, 1) ||
        !validationValue(data.flag, ['addmsg', 'del', 'clear'])
      ) {
        paramErr(res, req);
        return;
      }

      // 撤回、清空、发送新消息操作

      // 如果是删除验证消息id
      if (data.flag === 'del') {
        if (!validaString(data.msgData.msgId, 1, fieldLength.id, 1)) {
          paramErr(res, req);
          return;
        }
      }

      await sendNotifyMsg(req, data.to, data.flag, data.msgData);

      _success(res);
    }
    // 文件粘贴数据
    else if (type === 'pastefiledata') {
      const { type: t, data: d } = data;

      if (t) {
        if (
          !validationValue(t, ['copy', 'cut']) ||
          !_type.isArray(d) ||
          d.length === 0 ||
          d.length > fieldLength.maxPagesize ||
          !d.every(
            (item) =>
              _type.isObject(item) &&
              validaString(item.name, 1, fieldLength.filename) &&
              validaString(item.path, 1, fieldLength.url)
          )
        ) {
          paramErr(res, req);
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
});

// 删除分享
route.post('/delete-share', async (req, res) => {
  try {
    const { ids } = req.body;

    if (
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await deleteData(
      'share',
      `WHERE id IN (${fillString(ids.length)}) AND account = ?`,
      [...ids, account]
    );

    syncUpdateData(req, 'sharelist');

    _success(res, '删除分享成功')(req, ids.length, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 获取分享列表
route.get('/share-list', async (req, res) => {
  try {
    let { pageNo = 1, pageSize = 20 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLength.maxPagesize
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const total = await getTableRowCount('share', `WHERE account = ?`, [
      account,
    ]);

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];

    if (total > 0) {
      data = await queryData(
        'share',
        'id, type, title, pass, exp_time',
        `WHERE account = ? ORDER BY serial DESC LIMIT ? OFFSET ?`,
        [account, pageSize, offset]
      );
    }

    _success(res, 'ok', {
      ...result,
      data,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

//编辑分享
route.post('/edit-share', async (req, res) => {
  try {
    let { id, title, expireTime, pass = '' } = req.body;
    expireTime = parseInt(expireTime);

    if (
      !validaString(id, 1, fieldLength.id, 1) ||
      !validaString(title, 1, fieldLength.title) ||
      !validaString(pass, 0, fieldLength.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLength.expTime
    ) {
      paramErr(res, req);
      return;
    }

    const obj = {
      exp_time:
        expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
      title,
      pass,
    };

    const { account } = req._hello.userinfo;

    await updateData('share', obj, `WHERE id = ? AND account = ?`, [
      id,
      account,
    ]);

    syncUpdateData(req, 'sharelist');

    _success(res, '更新分享成功')(req, `${title}-${id}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 回收站列表
route.get('/trash-list', async (req, res) => {
  try {
    let { word = '', type, pageNo = 1, pageSize = 20 } = req.query;

    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);

    if (
      !validationValue(type, ['note', 'bmk', 'bmk_group', 'history']) ||
      !validaString(word, 0, fieldLength.searchWord) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > fieldLength.maxPagesize
    ) {
      paramErr(res, req);
      return;
    }

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

    const { account } = req._hello.userinfo;

    let where = 'WHERE account = ? AND state = ?';
    const valArr = [account, 0];

    let splitWord = [];

    if (word) {
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);

      const searchSql = createSearchSql(curSplit, fieldArr);

      const scoreSql = createScoreSql(curSplit, fieldArr);

      where += ` AND (${searchSql.sql}) ${scoreSql.sql}`;

      valArr.push(...searchSql.valArr, ...scoreSql.valArr);
    } else {
      where += `ORDER BY ${type === 'note' ? 'create_at' : 'serial'} DESC`;
    }

    const total = await getTableRowCount(
      type === 'bmk' ? 'bmk_bmk_group_view' : type,
      where,
      valArr
    );

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let data = [];

    if (total > 0) {
      where += ` LIMIT ? OFFSET ?`;

      valArr.push(pageSize, offset);

      data = await queryData(
        type === 'bmk' ? 'bmk_bmk_group_view' : type,
        fields,
        where,
        valArr,
        [account, 0]
      );

      if (type === 'note') {
        const noteCategory = await queryData(
          'note_category',
          'id,title',
          `WHERE account = ?`,
          [account]
        );

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
});

// 删除回收站
route.post('/delete-trash', async (req, res) => {
  try {
    const { ids, type } = req.body;

    if (
      !validationValue(type, ['bmk_group', 'bmk', 'note', 'history']) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await deleteData(
      type,
      `WHERE id IN (${fillString(ids.length)}) AND account = ? AND state = ?`,
      [...ids, account, 0]
    );

    // 删除分组，则删除分组下的所有书签
    if (type === 'bmk_group') {
      await batchTask(async (offset, limit) => {
        const list = ids.slice(offset, offset + limit);

        if (list.length === 0) return false;

        await deleteData(
          'bmk',
          `WHERE group_id IN (${fillString(list.length)}) AND account = ?`,
          [...list, account]
        );

        return true;
      }, 3);
    }

    // 移动笔记历史到文件回收站
    if (type === 'note') {
      const trashDir = getTrashDir(account);

      await concurrencyTasks(ids, 5, async (id) => {
        const noteHistoryDir = getNoteHistoryDir(account, id);

        if (await _f.exists(noteHistoryDir)) {
          await _f.mkdir(trashDir);

          await _f.rename(noteHistoryDir, _path.normalize(trashDir, id));
        }
      });
    }

    syncUpdateData(req, 'trash');

    _success(res, '删除成功')(req, `${type}-${ids.length}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 恢复回收站内容
route.post('/recover-trash', async (req, res) => {
  try {
    let { ids, type } = req.body;

    if (
      !validationValue(type, ['bmk_group', 'bmk', 'note', 'history']) ||
      !_type.isArray(ids) ||
      ids.length === 0 ||
      ids.length > fieldLength.maxPagesize ||
      !ids.every((item) => validaString(item, 1, fieldLength.id, 1))
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await updateData(
      type,
      { state: 1 },
      `WHERE id IN (${fillString(ids.length)}) AND account = ? AND state = ?`,
      [...ids, account, 0]
    );

    syncUpdateData(req, 'trash');

    if (type === 'bmk_group' || type === 'bmk') {
      type = 'bookmark';
    }

    syncUpdateData(req, type);

    _success(res, '恢复成功')(req, `${type}-${ids.length}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
