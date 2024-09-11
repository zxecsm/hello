const express = require('express'),
  route = express.Router();
const msg = require('../data/msg');
const { _d } = require('../data/data');
const configObj = require('../data/config');
let {
    writelog,
    encryption,
    _success,
    _nologin,
    _nothing,
    _err,
    nanoid,
    validaString,
    validationValue,
    _type,
    paramErr,
    setCookie,
    getWordCount,
    receiveFiles,
    getTimePath,
    getSuffix,
    createFillString,
    syncUpdateData,
    isImgFile,
    hdChatSendMsg,
    createPagingData,
    isEmail,
    _delDir,
    isRoot,
    onlineMsg,
    playInConfig,
    becomeFriends,
    parseForwardMsgLink,
    heperMsgAndForward,
    getSplitWord,
  } = require('../utils/utils'),
  {
    insertData,
    updateData,
    deleteData,
    queryData,
  } = require('../utils/sqlite');
const timedTask = require('../utils/timedTask');
const _f = require('../utils/f');
const _2fa = require('../utils/speakeasy');
const verifyLimit = require('../utils/verifyLimit');
const mailer = require('../utils/email');
const fileKey = require('../utils/fileKey');
const codeObj = {};
// 记录错误
route.post('/error', async (req, res) => {
  try {
    const { err } = req.body;
    if (!validaString(err, 1)) {
      paramErr(res, req);
      return;
    }
    await writelog(req, `[ ${err} ]`, 'error');
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// playIn配置
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
    const obj = { css: '', js: '' };
    const u = `${configObj.filepath}/custom`;
    if (_f.c.existsSync(`${u}/custom.css`)) {
      obj.css = (await _f.p.readFile(`${u}/custom.css`)).toString();
    }
    if (_f.c.existsSync(`${u}/custom.js`)) {
      obj.js = (await _f.p.readFile(`${u}/custom.js`)).toString();
    }
    _success(res, 'ok', obj);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 注册状态
route.get('/register-state', async (req, res) => {
  try {
    _success(res, 'ok', _d.registerState);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 注册限制
let registerCount = 0;
timedTask.add((flag) => {
  if (flag.slice(-6) === '000000') {
    registerCount = 0;
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
    if (!validaString(username, 1) || !validaString(password, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    if (username.length < 1 || username.length > 20) {
      _err(res, '请输入1-20位')(req, username, 1);
      return;
    }
    const users = await queryData('user', 'account', `WHERE username=?`, [
      username,
    ]);
    if (users.length > 0) {
      _err(res, '用户名已注册')(req, username, 1);
      return;
    }
    // 写入用户数据
    const account = nanoid();
    const time = Date.now();
    await insertData('user', [
      {
        username,
        account,
        time,
        password: encryption(password),
        bg: '',
        bgxs: '',
        dailybg: 'n',
        flag: '0',
        state: '0',
        logo: '',
        hide: 'n',
        verify: '',
        email: '',
        receive_chat_state: 'n',
        chat_id: nanoid(),
        forward_msg_state: 'n',
        forward_msg_link: '',
      },
    ]);
    // 生成token
    setCookie(res, { account, username });
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
// 免密登录
route.post('/code-login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!validaString(code, 6, 6, 1)) {
      paramErr(res, req);
      return;
    }
    const key = `hello_${code}`;
    if (!codeObj.hasOwnProperty(key)) {
      _nothing(res);
      return;
    }
    const { account, username } = codeObj[key];
    delete codeObj[key];
    setCookie(res, {
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
    const account = req.body.account,
      password = req.body.password,
      ip = req._hello.ip;
    if (!validaString(account, 1) || !validaString(password, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    // 过滤登录密码三次错误的登录IP地址
    if (loginVerifyLimit.verify(ip, account)) {
      //验证用户名和账号是否存在
      const userinfo = (
        await queryData(
          'user',
          '*',
          `WHERE (account=? OR username=? OR email=?) AND state = ?`,
          [account, account, account, '0']
        )
      )[0];
      if (!userinfo) {
        _err(res, '用户不存在')(req, account, 1);
        return;
      }
      const { verify, account: acc, username } = userinfo;
      if (!userinfo.password || userinfo.password === encryption(password)) {
        if (verify) {
          _success(res, '账号密码验证成功，请完成两步验证', {
            account: acc,
            verify: true,
          })(req, `${username}-${acc}`, 1);
        } else {
          setCookie(res, {
            account: acc,
            username,
          });
          const { os, ip } = req._hello;
          await heperMsgAndForward(
            req,
            acc,
            `您的账号在 [${os}(${ip})] 登录成功。如非本人操作，请及时修改密码（密码修改成功，全平台清空登录态）`
          );
          _success(res, '登录成功', { account: acc, username })(
            req,
            `${username}-${acc}`,
            1
          );
        }
      } else {
        loginVerifyLimit.add(ip, account);
        _err(res, '登录密码错误，请重新输入')(req, `${username}-${acc}`, 1);
      }
    } else {
      _err(res, '登录密码多次错误，请10分钟后再试')(req, account, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 两步验证
const towfaVerify = verifyLimit();
route.post('/verify-login', async (req, res) => {
  try {
    const { token, acc, password } = req.body;
    if (
      !validaString(token, 6, 6, 1) ||
      !validaString(acc, 1, 50, 1) ||
      !validaString(password, 1, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    const ip = req._hello.ip;
    if (towfaVerify.verify(ip, acc)) {
      const user = (
        await queryData('user', '*', `WHERE account=?  AND state=?`, [acc, '0'])
      )[0];
      if (!user) {
        _err(res, '用户不存在')(req, acc, 1);
        return;
      }
      const { account, username, verify, password: pd } = user;
      if (
        (!pd || pd === encryption(password)) &&
        verify &&
        _2fa.verify(verify, token)
      ) {
        setCookie(res, {
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
        towfaVerify.add(ip, acc);
        _err(res, '验证码错误')(req, `${username}-${account}`, 1);
      }
    } else {
      _err(res, '验证码多次错误，请10分钟后再试')(req, acc, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 发送邮件验证码
route.get('/mail-code', async (req, res) => {
  try {
    const { acc } = req.query;
    if (!validaString(acc, 1)) {
      paramErr(res, req);
      return;
    }
    if (!_d.email.state) {
      _err(res, '管理员未开启邮箱验证功能')(req, acc, 1);
      return;
    }
    const userinfo = (
      await queryData(
        'user',
        '*',
        `WHERE (account=? OR username=? OR email=?) AND state = ?`,
        [acc, acc, acc, '0']
      )
    )[0];
    if (!userinfo) {
      _err(res, '用户不存在')(req, acc, 1);
      return;
    }
    const { account, email, username } = userinfo;
    if (!email) {
      _err(res, '用户未绑定邮箱')(req, `${username}-${account}`, 1);
      return;
    }
    if (mailer.get(email)) {
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
      !isEmail(email) ||
      !validaString(code, 6, 6, 1) ||
      !validaString(account, 1, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    const ip = req._hello.ip;
    if (emailVerify.verify(ip, email)) {
      const userinfo = (
        await queryData(
          'user',
          '*',
          `WHERE email=? AND account=? AND state=?`,
          [email, account, '0']
        )
      )[0];
      if (!userinfo) {
        _err(res, '用户不存在')(req, account, 1);
        return;
      }
      const { username } = userinfo;
      if (mailer.get(email) === code) {
        await updateData(
          'user',
          {
            password: '',
            verify: '',
            flag: parseInt(Date.now() / 1000) - 2,
          },
          `WHERE account=? AND state=?`,
          [account, '0']
        );
        setCookie(res, {
          account,
          username,
        });
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
//拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});
// 获取文件key
route.get('/file-key', async (req, res) => {
  try {
    const { p } = req.query;
    if (!validaString(p, 1, 1000)) {
      paramErr(res, req);
      return;
    }
    const key = fileKey.add(req._hello.userinfo.account, p);
    _success(res, '获取fileKey成功', key)(req, key, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清除文件key
route.get('/clear-file-key', async (req, res) => {
  try {
    fileKey.clear(req._hello.userinfo.account);
    _success(res, '清除fileKey成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 获取字体列表
route.get('/font-list', async (req, res) => {
  try {
    let list = [];
    const p = `${configObj.filepath}/font`;
    if (_f.c.existsSync(p)) {
      list = await _f.p.readdir(p);
    }
    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 发送邮件验证码
route.get('/bind-mail-code', async (req, res) => {
  try {
    const { email } = req.query;
    if (!isEmail(email)) {
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
      await queryData('user', '*', `WHERE email=?`, [email])
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
    if (!validaString(password, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account, password: pd } = req._hello.userinfo;
    if (pd && pd !== encryption(password)) {
      _err(res, '密码错误')(req, email, 1);
      return;
    }
    if (!code) {
      await updateData(
        'user',
        {
          email: '',
        },
        `WHERE account=? AND state=?`,
        [account, '0']
      );
      syncUpdateData(req, 'userinfo');
      _success(res, '解绑邮箱成功')(req, email, 1);
      return;
    }
    if (!isEmail(email) || !validaString(code, 6, 6, 1)) {
      paramErr(res, req);
      return;
    }
    const userinfo = (
      await queryData('user', '*', `WHERE email=?`, [email])
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
        `WHERE account=? AND state=?`,
        [account, '0']
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
// 获取verifyToken
route.get('/verify', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    _success(res, 'ok', _2fa.create(account));
  } catch (error) {
    _err(res)(req, error);
  }
});
// 设置verify
route.post('/verify', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!validaString(password, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account, password: pd } = req._hello.userinfo;
    if (pd && pd !== encryption(password)) {
      _err(res, '密码错误')(req);
      return;
    }
    if (!token) {
      await updateData('user', { verify: '' }, `WHERE account=?  AND state=?`, [
        account,
        '0',
      ]);
      syncUpdateData(req, 'userinfo');
      _success(res, '关闭两步验证成功')(req);
      return;
    }
    if (!validaString(token, 6, 6, 1)) {
      paramErr(res, req);
      return;
    }
    const verify = _2fa.create(account);
    if (_2fa.verify(verify, token)) {
      await updateData('user', { verify }, `WHERE account=?  AND state=?`, [
        account,
        '0',
      ]);
      syncUpdateData(req, 'userinfo');
      _2fa.del(account);
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
    const key = `hello_${code}`;
    if (codeObj.hasOwnProperty(key)) {
      _err(res, '登录码冲突，请刷新登录码再试')(req);
      return;
    }
    const { account, username } = req._hello.userinfo;
    codeObj[key] = {
      account,
      username,
    };
    let num = 0;
    let timer = setInterval(() => {
      if (++num > 10) {
        clearInterval(timer);
        timer = null;
        delete codeObj[key];
        _err(res, '批准登录超时')(req);
        return;
      }
      if (!codeObj.hasOwnProperty(key)) {
        clearInterval(timer);
        timer = null;
        _success(res, '批准登录成功')(req);
      }
    }, 1000);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 更新token
route.get('/update-token', async (req, res) => {
  try {
    const { account, username } = req._hello.userinfo;
    setCookie(res, {
      account,
      username,
    });
    _success(res);
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
      !validaString(oldpassword, 1, 50, 1) ||
      !validaString(newpassword, 1, 50, 1)
    ) {
      paramErr(res, req);
      return;
    }
    //对比原密码
    if (encryption(oldpassword) === password || !password) {
      await updateData(
        'user',
        {
          password: encryption(newpassword),
          flag: parseInt(Date.now() / 1000),
        },
        `WHERE account=? AND state=?`,
        [account, '0']
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
    const { account, username } = req._hello.userinfo,
      { other } = req.query;
    if (!validationValue(other, ['y', 'n'])) {
      paramErr(res, req);
      return;
    }
    if (other === 'y') {
      //退出其他登录设备
      await updateData(
        'user',
        {
          flag: parseInt(Date.now() / 1000) - 2,
        },
        `WHERE account=? AND state=?`,
        [account, '0']
      );
      setCookie(res, {
        account,
        username,
      });
    } else if (other === 'n') {
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
    const { account } = req._hello.userinfo,
      { username } = req.body;
    if (!validaString(username, 1)) {
      paramErr(res, req);
      return;
    }
    if (username.length > 20) {
      _err(res, '请输入1-20位')(req, username, 1);
      return;
    }
    const users = await queryData('user', 'account', `WHERE username=?`, [
      username,
    ]);
    if (users.length > 0) {
      _err(res, '用户名已注册')(req, username, 1);
      return;
    }
    await updateData(
      'user',
      {
        username,
      },
      `WHERE account=? AND state=?`,
      [account, '0']
    );
    syncUpdateData(req, 'userinfo');
    _success(res, '修改用户名成功')(req, username, 1);
  } catch (error) {
    _err(res)(req, error);
    return;
  }
});
// 账号状态
route.post('/account-state', async (req, res) => {
  try {
    const { password } = req.body;
    if (!validaString(password, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const { account, username, password: pd } = req._hello.userinfo;
    if (pd && pd !== encryption(password)) {
      _err(res, '密码错误')(req);
      return;
    }
    if (isRoot(req)) {
      _err(res, '无权操作')(req);
    } else {
      await deleteData('user', `WHERE account=?`, [account]);
      await _delDir(`${configObj.filepath}/logo/${account}`).catch(() => {});
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
    delete req._hello.userinfo.flag;
    delete req._hello.userinfo.state;
    delete req._hello.userinfo.password;
    delete req._hello.userinfo.time;
    req._hello.userinfo.verify = req._hello.userinfo.verify ? true : '';
    const { bg, bgxs, forward_msg_link } = req._hello.userinfo;
    req._hello.userinfo.forward_msg_link =
      parseForwardMsgLink(forward_msg_link);
    const bgs = await queryData('bg', '*', `WHERE id IN (?,?)`, [bg, bgxs]);
    const bgObj = {};
    bgs.forEach((item) => {
      const { id } = item;
      bgObj[id] = item;
    });
    req._hello.userinfo.bgObj = bgObj;
    _success(res, 'ok', req._hello.userinfo);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 更换头像
route.post('/change-logo', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { logo = '' } = req.body;
    if (!validaString(logo, 0, 60) || (logo && !isImgFile(logo))) {
      paramErr(res, req);
      return;
    }
    await updateData(
      'user',
      {
        logo,
      },
      `WHERE account=? AND state=?`,
      [account, '0']
    );
    syncUpdateData(req, 'userinfo');
    _success(res, '更新头像成功')(req, logo, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 上传logo
route.post('/up-logo', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const { name, HASH } = req.query;
    if (!isImgFile(name) || !validaString(HASH, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    const timePath = getTimePath();
    const path = `${configObj.filepath}/logo/${account}/${timePath}`;
    await _f.mkdir(path);
    await receiveFiles(req, path, `${HASH}.${getSuffix(name)[1]}`, 5);
    const logo = `${timePath}/${HASH}.${getSuffix(name)[1]}`;
    _success(res, '上传LOGO成功', {
      logo,
    })(req, logo, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
//每日更换壁纸
route.get('/daily-change-bg', async (req, res) => {
  try {
    const { account, dailybg } = req._hello.userinfo;
    let tem;
    if (!dailybg || dailybg === 'n') {
      tem = 'y';
    } else {
      tem = 'n';
    }
    await updateData(
      'user',
      {
        dailybg: tem,
      },
      `WHERE account=? AND state=?`,
      [account, '0']
    );
    syncUpdateData(req, 'userinfo');
    if (tem === 'y') {
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
    if (!hide || hide === 'n') {
      tem = 'y';
    } else {
      tem = 'n';
    }
    await updateData(
      'user',
      {
        hide: tem,
      },
      `WHERE account=? AND state=?`,
      [account, '0']
    );
    syncUpdateData(req, 'userinfo');
    if (tem === 'y') {
      _success(res, '成功开启')(req, '开启隐身');
    } else {
      onlineMsg(req, 1);
      _success(res, '成功关闭')(req, '关闭隐身');
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
        time: Date.now(),
      },
      `WHERE account=? AND state=?`,
      [req._hello.userinfo.account, '0']
    );
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
function getMsgs(con, id, flag) {
  // 获取未读取的消息
  let msgs = con.msgs.slice(0);
  let idx = msgs.findIndex((item) => item.flag == flag);
  if (idx >= 0) {
    msgs = msgs.slice(idx + 1);
  }
  // 过滤掉发送者
  msgs = msgs.filter((item) => item.id != id);
  return msgs.map((item) => item.data);
}
// 数据同步
route.get('/real-time', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    const id = req._hello.temid;
    let { flag, title = '' } = req.query; //标识和设备ID
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(flag, 1, 10, 1) ||
      !validaString(title, 0, 20)
    ) {
      paramErr(res, req);
      return;
    }
    if (title === 'home') {
      onlineMsg(req);
    }
    const con = msg.get(account, cb, req._hello);
    flag == 0 ? (flag = con.flag) : null; //初始化指令标识
    let msgs = [];
    function cb() {
      msgs = getMsgs(con, id, flag);
      if (con.flag == flag || msgs.length === 0) return;
      stop(1);
    }
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
      !validaString(id, 1, 50, 1) ||
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
        !validaString(id, 0, 50, 1)
      ) {
        paramErr(res, req);
        return;
      }
      syncUpdateData(req, flag, id);
      _success(res);
    }
    // 播放
    else if (type === 'play') {
      if (!validationValue(data.state, ['y', 'n'])) {
        paramErr(res, req);
        return;
      }
      if (data.state == 'y') {
        if (!_type.isObject(data.obj)) {
          paramErr(res, req);
          return;
        }
      }
      data.to = account;
      msg.set(data.to, id, { type, data });
      _success(res);
    }
    // 播放状态
    else if (type === 'playmode') {
      if (!validationValue(data.state, ['random', 'loop', 'order'])) {
        paramErr(res, req);
        return;
      }
      data.to = account;
      msg.set(data.to, id, { type, data });
      _success(res);
    }
    // 音量
    else if (type === 'vol') {
      data.value = +data.value;
      if (isNaN(data.value) || data.value > 1 || data.value < 0) {
        paramErr(res, req);
        return;
      }
      data.to = account;
      msg.set(data.to, id, { type, data });
      _success(res);
    }
    // 进度
    else if (type === 'progress') {
      data.value = +data.value;
      if (isNaN(data.value) || data.value > 1 || data.value < 0) {
        paramErr(res, req);
        return;
      }
      data.to = account;
      msg.set(data.to, id, { type, data });
      _success(res);
    }
    // 聊天室
    else if (type === 'chat') {
      if (
        !validaString(data.to, 1, 50, 1) ||
        !validationValue(data.flag, ['addmsg', 'del', 'clear'])
      ) {
        paramErr(res, req);
        return;
      }
      // 撤回、清空操作
      if (data.flag == 'del' || data.flag == 'clear') {
        if (data.flag == 'del') {
          if (!validaString(data.tt, 1, 50, 1)) {
            paramErr(res, req);
            return;
          }
        }
        await hdChatSendMsg(req, data.to, data.flag, data.tt);
        _success(res);
        return;
      }
      // 发送新消息
      if (data.flag == 'addmsg') {
        await hdChatSendMsg(req, data.to, data.flag, data.msgData);
        _success(res);
      }
    }
    // 文件粘贴数据
    else if (type === 'pastefiledata') {
      const { type: t, data: d } = data;
      if (t) {
        if (
          !validationValue(t, ['copy', 'cut']) ||
          !_type.isArray(d) ||
          d.length == 0 ||
          d.length > 200 ||
          !d.every(
            (item) =>
              _type.isObject(item) &&
              validaString(item.name, 1) &&
              validaString(item.path, 1)
          )
        ) {
          paramErr(res, req);
          return;
        }
        msg.set(account, id, { type, data });
        _success(res);
      } else {
        msg.set(account, id, { type, data: {} });
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
    const { account } = req._hello.userinfo;
    const { ids } = req.body;
    if (
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    await deleteData(
      'share',
      `WHERE id IN (${createFillString(ids.length)}) AND account=?`,
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
    const { account } = req._hello.userinfo;
    let { pageNo = 1, pageSize = 20 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 200
    ) {
      paramErr(res, req);
      return;
    }
    const list = await queryData(
      'share',
      'id, type, title, pass, valid',
      `WHERE account=?`,
      [account]
    );
    list.reverse();
    _success(res, 'ok', createPagingData(list, pageSize, pageNo));
  } catch (error) {
    _err(res)(req, error);
  }
});
//编辑分享
route.post('/edit-share', async (req, res) => {
  try {
    const { account } = req._hello.userinfo;
    let { id, title, valid, pass = '' } = req.body;
    valid = parseInt(valid);
    if (
      !validaString(id, 1, 50, 1) ||
      !validaString(title, 1, 100) ||
      !validaString(pass, 0, 20) ||
      isNaN(valid)
    ) {
      paramErr(res, req);
      return;
    }
    const obj = {
      valid: valid == 0 ? 0 : Date.now() + valid * 24 * 60 * 60 * 1000,
      title,
      pass,
    };
    await updateData('share', obj, `WHERE id=? AND account=?`, [id, account]);
    syncUpdateData(req, 'sharelist');
    _success(res, '更新分享成功')(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 回收站列表
route.get('/trash-list', async (req, res) => {
  try {
    let { word = '', type, pageNo = 1, pageSize = 20 } = req.query,
      { account } = req._hello.userinfo,
      str = 'id,name';
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      !validationValue(type, ['note', 'bookmk', 'booklist', 'history']) ||
      !validaString(word, 0, 100) ||
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 200
    ) {
      paramErr(res, req);
      return;
    }
    if (type === 'bookmk') {
      str = 'id,name,link,des,listid';
    } else if (type === 'history') {
      str = 'id,data';
    }
    let list = await queryData(type, str, `WHERE account=? AND state=?`, [
      account,
      '1',
    ]);
    if (type === 'bookmk') {
      const booklist = await queryData(
        'booklist',
        '*',
        `WHERE state=? AND account=?`,
        ['0', account]
      );
      booklist.push({ id: 'home' });
      const bookListObj = {};
      booklist.forEach((item) => {
        bookListObj[item.id] = item;
      });
      list = list.map((item) => ({ ...item, group: bookListObj[item.listid] }));
    }
    list.reverse();
    let splitWord = [];
    if (word) {
      splitWord = getSplitWord(word);
      list = list.map((item) => {
        let content = '';
        if (type === 'bookmk') {
          const { name, link, des } = item;
          content = '' + name + link + des;
        } else if (type === 'history') {
          content = item.data;
        } else {
          content = item.name;
        }
        item.sNum = getWordCount(splitWord, content);
        return item;
      });
      list.sort((a, b) => b.sNum - a.sNum);
      list = list.filter((item) => item.sNum > 0);
    }
    _success(res, 'ok', {
      ...createPagingData(list, pageSize, pageNo),
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
      !validationValue(type, ['booklist', 'bookmk', 'note', 'history']) ||
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await deleteData(
      type,
      `WHERE id IN (${createFillString(ids.length)}) AND account=? AND state=?`,
      [...ids, account, '1']
    );
    if (type === 'booklist') {
      await deleteData(
        'bookmk',
        `WHERE listid IN (${createFillString(ids.length)}) AND account=?`,
        [...ids, account]
      );
    }
    syncUpdateData(req, 'trash');
    _success(res, '删除成功')(req, `${type}-${ids.length}`);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 恢复回收站内容
route.post('/recover-trash', async (req, res) => {
  try {
    let { ids, type } = req.body;
    if (
      !validationValue(type, ['booklist', 'bookmk', 'note', 'history']) ||
      !_type.isArray(ids) ||
      ids.length == 0 ||
      ids.length > 200 ||
      !ids.every((item) => validaString(item, 1, 50, 1))
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    await updateData(
      type,
      { state: '0' },
      `WHERE id IN (${createFillString(ids.length)}) AND account=? AND state=?`,
      [...ids, account, '1']
    );
    syncUpdateData(req, 'trash');
    if (type === 'booklist' || type === 'bookmk') {
      type = 'bookmark';
    }
    syncUpdateData(req, type);
    _success(res, '恢复成功')(req, `${type}-${ids.length}`);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
