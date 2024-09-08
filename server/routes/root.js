const express = require('express'),
  route = express.Router();
const configObj = require('../data/config');
const { _d, generateKey } = require('../data/data');
const msg = require('../data/msg');
const mailer = require('../utils/email');
const _f = require('../utils/f');
const _2fa = require('../utils/speakeasy');
const {
  updateData,
  deleteData,
  queryData,
  runSqlite,
} = require('../utils/sqlite');
const timedTask = require('../utils/timedTask');
const {
  _success,
  _err,
  getSuffix,
  validaString,
  validationValue,
  paramErr,
  _delDir,
  readMenu,
  getAllFile,
  delEmptyFolder,
  cleanUpload,
  hdFilename,
  getPathFilename,
  createPagingData,
  nanoid,
  isEmail,
  isRoot,
  concurrencyTasks,
} = require('../utils/utils');
//拦截器
route.use((req, res, next) => {
  if (!isRoot(req)) {
    _err(res, '无权操作')(req);
  } else {
    next();
  }
});
// 配置邮箱
route.post('/email', async (req, res) => {
  try {
    let { user = '', pass = '', host = '', secure, port, state } = req.body;
    port = parseInt(port) || 465;
    if (
      !validationValue(state, ['y', 'n']) ||
      !validationValue(secure, ['y', 'n']) ||
      port < 0 ||
      !validaString(user, 0, 100) ||
      !validaString(host, 0, 100) ||
      !validaString(pass, 0, 50) ||
      (state === 'y' && !isEmail(user)) ||
      (state === 'y' && !validaString(host, 1, 100))
    ) {
      paramErr(res, req);
      return;
    }
    _d.email = {
      user,
      pass,
      host,
      secure: secure === 'y' ? true : false,
      port,
      state: state === 'y' ? true : false,
    };
    _success(res, '更新邮箱配置成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 获取用户列表
route.get('/user-list', async (req, res) => {
  try {
    let { pageNo = 1, pageSize = 10 } = req.query;
    pageNo = parseInt(pageNo);
    pageSize = parseInt(pageSize);
    if (
      isNaN(pageNo) ||
      isNaN(pageSize) ||
      pageNo < 1 ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      paramErr(res, req);
      return;
    }
    let list = await queryData('user', '*');
    const cons = msg.getConnect();
    list = list.map((item) => {
      const con = cons[item.account];
      return {
        ...item,
        os: con ? con.onlines.map((item) => `${item.os}(${item.ip})`) : [],
        online: Date.now() - item.time >= 1000 * 30 ? 'n' : 'y',
      };
    });
    list.sort((a, b) => b.time - a.time);
    _success(res, 'ok', {
      uploadSaveDay: _d.uploadSaveDay,
      registerState: _d.registerState,
      trashState: _d.trashState,
      randomBgApi: _d.randomBgApi,
      email: _d.email,
      ...createPagingData(list, pageSize, pageNo),
    });
  } catch (error) {
    _err(res)(req, error);
  }
});
// 账号状态
route.post('/account-state', async (req, res) => {
  try {
    const { acc, flag = '1' } = req.body;
    if (!validaString(acc, 1, 50, 1) || !validationValue(flag, ['0', '1'])) {
      paramErr(res, req);
      return;
    }
    if (acc !== 'root') {
      await updateData(
        'user',
        {
          state: flag,
        },
        `WHERE account=?`,
        [acc]
      );
      if (flag == '0') {
        _success(res, '激活账号成功')(req, acc, 1);
      } else {
        _success(res, '关闭账号成功')(req, acc, 1);
      }
    } else {
      _err(res, '无权操作')(req, acc, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 刪除账号
route.post('/delete-account', async (req, res) => {
  try {
    const { acc } = req.body;
    if (!validaString(acc, 1, 50, 1)) {
      paramErr(res, req);
      return;
    }
    if (acc !== 'root') {
      await deleteData('user', `WHERE account=?`, [acc]);
      await _delDir(`${configObj.filepath}/logo/${acc}`).catch(() => {});
      _success(res, '销毁账号成功')(req, acc, 1);
    } else {
      _err(res, '无权操作')(req, acc, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清理歌曲文件
route.get('/clean-music-file', async (req, res) => {
  try {
    const musicDir = `${configObj.filepath}/music`;
    if (_f.c.existsSync(musicDir)) {
      const musics = await queryData('musics', '*');
      const allMusicFile = await getAllFile(musicDir);
      await concurrencyTasks(allMusicFile, 5, async (item) => {
        const { path, name } = item;
        const url = `${path.slice(musicDir.length + 1)}/${getSuffix(name)[0]}`;
        if (!musics.some((item) => getSuffix(item.url)[0] == url)) {
          await _delDir(`${path}/${name}`).catch(() => {});
        }
      });
      await delEmptyFolder(musicDir).catch(() => {});
    }
    _success(res, '清理歌曲文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清理壁纸文件
route.get('/clean-bg-file', async (req, res) => {
  try {
    const bgDir = `${configObj.filepath}/bg`;
    if (_f.c.existsSync(bgDir)) {
      const bgs = await queryData('bg', '*');
      const allBgFile = await getAllFile(bgDir);
      await concurrencyTasks(allBgFile, 5, async (item) => {
        const { path, name } = item;
        const url = `${path.slice(bgDir.length + 1)}/${name}`;
        if (!bgs.some((item) => item.url == url)) {
          await _delDir(`${path}/${name}`).catch(() => {});
        }
      });
      await delEmptyFolder(bgDir).catch(() => {});
    }
    _success(res, '清理壁纸文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清理图床文件
route.get('/clean-pic-file', async (req, res) => {
  try {
    const picDir = `${configObj.filepath}/pic`;
    if (_f.c.existsSync(picDir)) {
      const pics = await queryData('pic', '*');
      const allPicFile = await getAllFile(picDir);
      await concurrencyTasks(allPicFile, 5, async (item) => {
        const { path, name } = item;
        const url = `${path.slice(picDir.length + 1)}/${name}`;
        if (!pics.some((item) => item.url == url)) {
          await _delDir(`${path}/${name}`).catch(() => {});
        }
      });
      await delEmptyFolder(picDir).catch(() => {});
    }
    _success(res, '清理图床文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清理缩略图文件
route.get('/clean-thumb-file', async (req, res) => {
  try {
    const { type } = req.query;
    if (
      !validationValue(type, ['pic', 'music', 'bg', 'upload', 'all', 'file'])
    ) {
      paramErr(res, req);
    }
    const delP =
      type == 'all'
        ? `${configObj.filepath}/thumb`
        : `${configObj.filepath}/thumb/${type}`;
    await _delDir(delP).catch(() => {});
    _success(res, '清理缩略图文件成功')(req, type, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 设置注册状态
route.post('/register-state', async (req, res) => {
  try {
    _d.registerState = !_d.registerState;
    _success(
      res,
      `${_d.registerState ? '开启' : '关闭'}注册成功`,
      _d.registerState
    )(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 更新tokenKey
route.post('/update-tokenkey', async (req, res) => {
  try {
    _d.tokenKey = generateKey(30);
    _success(res, '更新tokenKey成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 定时清理聊天文件
route.post('/clean-chat-file', async (req, res) => {
  try {
    let { day } = req.body;
    day = parseInt(day);
    if (isNaN(day) || day < 0 || day > 999) {
      paramErr(res, req);
      return;
    }
    _d.uploadSaveDay = day;
    cleanUpload();
    _success(res, '设置聊天文件过期时间成功')(req, _d.uploadSaveDay, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 读取日志
route.get('/log', async (req, res) => {
  try {
    const { name } = req.query;
    if (!validaString(name, 1)) {
      paramErr(res, req);
      return;
    }
    const log = (await _f.p.readFile(`${configObj.filepath}/log/${name}`))
      .toString()
      .split('\n');
    log.pop();
    log.reverse();
    _success(res, 'ok', log);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 日志文件列表
route.get('/log-list', async (req, res) => {
  try {
    const list = (await readMenu(`${configObj.filepath}/log`)).filter(
      (f) => f.type === 'file'
    );
    list.sort((a, b) => b.time - a.time);
    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除日志
route.post('/delete-log', async (req, res) => {
  try {
    let { name } = req.body;
    if (!validaString(name, 1)) {
      paramErr(res, req);
      return;
    }
    name = hdFilename(name);
    if (!name) {
      paramErr(res, req);
      return;
    }
    if (name == 'all') {
      await _delDir(`${configObj.filepath}/log`).catch(() => {});
    } else {
      await _delDir(`${configObj.filepath}/log/${name}`).catch(() => {});
    }
    _success(res, '删除日志成功')(req, name, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 回收站状态
route.post('/trash-state', async (req, res) => {
  try {
    _d.trashState = !_d.trashState;
    _success(
      res,
      `${_d.trashState ? '开启' : '关闭'}文件回收站成功`,
      _d.trashState
    )(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 随机壁纸接口状态
route.post('/random-bg-state', async (req, res) => {
  try {
    _d.randomBgApi = !_d.randomBgApi;
    _success(
      res,
      `${_d.randomBgApi ? '开启' : '关闭'}随机壁纸接口成功`,
      _d.randomBgApi
    )(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清理数据库
route.post('/clean-database', async (req, res) => {
  try {
    await runSqlite('VACUUM;');
    _success(res, '清理数据库成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 清理logo文件
route.get('/clean-logo-file', async (req, res) => {
  try {
    let bmk = await queryData('bookmk', 'logo', `WHERE logo!=?`, ['']);
    bmk = bmk.map((item) => getPathFilename(item.logo)[0]);
    let user = await queryData('user', 'logo', `WHERE logo!=?`, ['']);
    user = user.map((item) => getPathFilename(item.logo)[0]);
    const logos = [...bmk, ...user];
    const logoFiles = await getAllFile(`${configObj.filepath}/logo`);
    await concurrencyTasks(logoFiles, 5, async (item) => {
      const { name, path } = item;
      const p = `${path}/${name}`;
      if (!logos.some((item) => item == name)) {
        await _delDir(p).catch(() => {});
      }
    });
    await delEmptyFolder(`${configObj.filepath}/logo`).catch(() => {});
    _success(res, '清理LOGO文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 自定义代码
route.post('/custom-code', async (req, res) => {
  try {
    const { js = '', css = '' } = req.body;
    if (!validaString(js, 0) || !validaString(css, 0)) {
      paramErr(res, req);
      return;
    }
    const u = `${configObj.filepath}/custom`;
    await _f.mkdir(u);
    await _f.p.writeFile(`${u}/custom.js`, js);
    await _f.p.writeFile(`${u}/custom.css`, css);
    _success(res, '添加自定义代码成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// tipsFlag
route.post('/tips', async (req, res) => {
  try {
    const { flag } = req.body;
    if (!validationValue(flag, ['close', 'update'])) {
      paramErr(res, req);
      return;
    }
    if (flag === 'close') {
      _d.tipsFlag = 0;
    } else if (flag === 'update') {
      _d.tipsFlag = nanoid();
    }
    const temId = nanoid();
    Object.keys(msg.getConnect()).forEach((key) => {
      msg.set(key, temId, {
        type: 'updatedata',
        data: {
          flag: 'tips',
        },
      });
    });
    _success(res, '修改tips状态成功')(req, _d.tipsFlag, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 测试邮箱
route.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!isEmail(email)) {
      paramErr(res, req);
      return;
    }
    if (!_d.email.state) {
      _err(res, '未开启邮箱验证');
    }
    await mailer.sendMail(email, 'Hello账号验证邮件', '测试邮件');
    _success(res, '测试邮件发送成功')(req, email, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 测试两步验证
route.post('/test-tfa', async (req, res) => {
  try {
    const { token } = req.body;
    if (!validaString(token, 6, 6, 1)) {
      paramErr(res, req);
      return;
    }
    const verify = req._hello.userinfo.verify;
    if (!verify) {
      _err(res, '未开启两步验证')(req);
    } else if (_2fa.verify(verify, token)) {
      _success(res, '验证码正确')(req);
    } else {
      _err(res, '验证码错误')(req);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
timedTask.add(async (flag) => {
  if (flag.slice(-6) == '002000') {
    await cleanUpload();
  }
});
module.exports = route;
