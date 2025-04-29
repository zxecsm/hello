import express from 'express';

import appConfig from '../../data/config.js';
import { _d } from '../../data/data.js';
import _connect from '../../utils/connect.js';
import mailer from '../../utils/email.js';
import _f from '../../utils/f.js';
import _2fa from '../../utils/_2fa.js';

import {
  updateData,
  queryData,
  runSqlite,
  getTableRowCount,
  insertData,
} from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import {
  _success,
  _err,
  validaString,
  validationValue,
  paramErr,
  createPagingData,
  nanoid,
  isEmail,
  concurrencyTasks,
  isFilename,
} from '../../utils/utils.js';

import { becomeFriends, cleanUpload } from '../chat/chat.js';

import { fieldLenght } from '../config.js';

import { _delDir, delEmptyFolder, getAllFile, readMenu } from '../file/file.js';

import { deleteUser } from '../user/user.js';
import _path from '../../utils/path.js';
import { cleanFavicon, cleanSiteInfo } from '../bmk/bmk.js';
import _crypto from '../../utils/crypto.js';
import { getSystemUsage } from '../../utils/sys.js';

const route = express.Router();

// 验证管理员
route.use((req, res, next) => {
  if (!req._hello.isRoot) {
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
      !validationValue(state, [1, 0]) ||
      !validationValue(secure, [1, 0]) ||
      port < 0 ||
      !validaString(user, 0, fieldLenght.email) ||
      !validaString(host, 0, fieldLenght.email) ||
      !validaString(pass, 0, 100) ||
      (state === 1 && !isEmail(user)) ||
      (state === 1 && !validaString(host, 1, fieldLenght.email))
    ) {
      paramErr(res, req);
      return;
    }

    _d.email = {
      user,
      pass,
      host,
      secure: secure === 1 ? true : false,
      port,
      state: state === 1 ? true : false,
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
      pageSize > fieldLenght.userPageSize
    ) {
      paramErr(res, req);
      return;
    }

    const total = await getTableRowCount('user', `WHERE account != ?`, [
      'hello',
    ]);

    const result = createPagingData(Array(total), pageSize, pageNo);

    const offset = (result.pageNo - 1) * pageSize;

    let list = await queryData(
      'user',
      'account,username,update_at,email,state,hide',
      `WHERE account != ? ORDER BY update_at DESC LIMIT ? OFFSET ?`,
      ['hello', pageSize, offset]
    );

    const cons = _connect.getConnects();

    list = list.map((item) => {
      const con = cons[item.account];
      return {
        ...item,
        os: con ? con.onlines.map((item) => `${item.os}(${item.ip})`) : [],
        online: Date.now() - item.update_at >= 1000 * 30 ? 0 : 1,
      };
    });

    _success(res, 'ok', {
      ...result,
      registerState: _d.registerState,
      trashState: _d.trashState,
      cacheExp: _d.cacheExp,
      pubApi: _d.pubApi,
      email: _d.email,
      data: list,
    });
  } catch (error) {
    _err(res)(req, error);
  }
});

// 账号状态
route.post('/account-state', async (req, res) => {
  try {
    const { account, state = 1 } = req.body;

    if (
      !validaString(account, 1, fieldLenght.id, 1) ||
      !validationValue(state, [1, 0]) ||
      account === 'hello' ||
      account === 'root'
    ) {
      paramErr(res, req);
      return;
    }

    await updateData(
      'user',
      {
        state,
      },
      `WHERE account = ?`,
      [account]
    );

    if (state === 1) {
      _success(res, '激活账号成功')(req, account, 1);
    } else {
      _success(res, '关闭账号成功')(req, account, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 刪除账号
route.post('/delete-account', async (req, res) => {
  try {
    const { account } = req.body;

    if (
      !validaString(account, 1, fieldLenght.id, 1) ||
      account === 'root' ||
      account === 'hello'
    ) {
      paramErr(res, req);
      return;
    }

    await deleteUser(account); // 删除账号数据

    _success(res, '销毁账号成功')(req, account, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清理歌曲文件
route.get('/clean-music-file', async (req, res) => {
  try {
    const musicDir = _path.normalize(`${appConfig.appData}/music`);

    if (await _f.exists(musicDir)) {
      const songs = await queryData('songs', 'url');
      const allMusicFile = await getAllFile(musicDir);

      await concurrencyTasks(allMusicFile, 5, async (item) => {
        const { path, name } = item;

        const url = `${path.slice(musicDir.length + 1)}/${
          _path.extname(name)[0]
        }`;
        if (!songs.some((item) => _path.extname(item.url)[0] === url)) {
          await _delDir(_path.normalize(`${path}/${name}`));
        }
      });

      await delEmptyFolder(musicDir);
    }
    _success(res, '清理歌曲文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清理壁纸文件
route.get('/clean-bg-file', async (req, res) => {
  try {
    const bgDir = _path.normalize(`${appConfig.appData}/bg`);

    if (await _f.exists(bgDir)) {
      const bgs = await queryData('bg', '*');
      const allBgFile = await getAllFile(bgDir);

      await concurrencyTasks(allBgFile, 5, async (item) => {
        const { path, name } = item;
        const url = _path.normalize(`${path.slice(bgDir.length + 1)}/${name}`);
        if (!bgs.some((item) => item.url === url)) {
          await _delDir(_path.normalize(`${path}/${name}`));
        }
      });

      await delEmptyFolder(bgDir);
    }
    _success(res, '清理壁纸文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 清理图床文件
route.get('/clean-pic-file', async (req, res) => {
  try {
    const picDir = _path.normalize(`${appConfig.appData}/pic`);

    if (await _f.exists(picDir)) {
      const pics = await queryData('pic', '*');
      const allPicFile = await getAllFile(picDir);

      await concurrencyTasks(allPicFile, 5, async (item) => {
        const { path, name } = item;
        const url = _path.normalize(`${path.slice(picDir.length + 1)}/${name}`);
        if (!pics.some((item) => item.url === url)) {
          await _delDir(_path.normalize(`${path}/${name}`));
        }
      });

      await delEmptyFolder(picDir);
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
      type === 'all'
        ? _path.normalize(`${appConfig.appData}/thumb`)
        : _path.normalize(`${appConfig.appData}/thumb/${type}`);

    await _delDir(delP);

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
    _d.tokenKey = _crypto.generateSecureKey();

    _success(res, '更新tokenKey成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取日志
route.get('/log', async (req, res) => {
  try {
    const { name } = req.query;

    if (!validaString(name, 1, fieldLenght.filename) || !isFilename(name)) {
      paramErr(res, req);
      return;
    }

    const log = (
      await _f.fsp.readFile(_path.normalize(`${appConfig.appData}/log/${name}`))
    )
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
    const list = (
      await readMenu(_path.normalize(`${appConfig.appData}/log`))
    ).filter((f) => f.type === 'file');

    list.sort((a, b) => b.time - a.time);
    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 删除日志
route.post('/delete-log', async (req, res) => {
  try {
    const { name } = req.body;
    if (!validaString(name, 1, fieldLenght.filename) || !isFilename(name)) {
      paramErr(res, req);
      return;
    }

    if (name === 'all') {
      await _delDir(_path.normalize(`${appConfig.appData}/log`));
    } else {
      await _delDir(_path.normalize(`${appConfig.appData}/log/${name}`));
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

// 公开api状态
route.post('/pub-api-state', async (req, res) => {
  try {
    const { randomBgApi, siteInfoApi, faviconApi } = req.body;
    if (
      !validationValue(randomBgApi, [0, 1]) ||
      !validationValue(siteInfoApi, [0, 1]) ||
      !validationValue(faviconApi, [0, 1])
    ) {
      paramErr(res, req);
      return;
    }

    _d.pubApi = {
      randomBgApi: !!randomBgApi,
      siteInfoApi: !!siteInfoApi,
      faviconApi: !!faviconApi,
    };

    _success(res, `修改接口状态成功`, _d.pubApi)(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 文件缓存时间
route.post('/change-cache-time', async (req, res) => {
  try {
    let { uploadSaveDay, faviconCache, siteInfoCache } = req.body;

    uploadSaveDay = parseInt(uploadSaveDay);
    faviconCache = parseInt(faviconCache);
    siteInfoCache = parseInt(siteInfoCache);

    if (
      isNaN(uploadSaveDay) ||
      uploadSaveDay < 0 ||
      uploadSaveDay > fieldLenght.expTime ||
      isNaN(faviconCache) ||
      faviconCache < 0 ||
      faviconCache > fieldLenght.expTime ||
      isNaN(siteInfoCache) ||
      siteInfoCache < 0 ||
      siteInfoCache > fieldLenght.expTime
    ) {
      paramErr(res, req);
      return;
    }

    const uploadSaveDayIschange = _d.cacheExp.uploadSaveDay !== uploadSaveDay;
    const faviconCacheIschange = _d.cacheExp.faviconCache !== faviconCache;
    const siteInfoCacheIschange = _d.cacheExp.siteInfoCache !== siteInfoCache;

    _d.cacheExp = {
      uploadSaveDay,
      faviconCache,
      siteInfoCache,
    };

    if (uploadSaveDayIschange) {
      await cleanUpload(req);
    }

    if (faviconCacheIschange) {
      await cleanFavicon(req);
    }

    if (siteInfoCacheIschange) {
      await cleanSiteInfo(req);
    }

    _success(res, `修改文件缓存过期时间成功`, _d.cacheExp)(req);
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
    let bmk = await queryData('bmk', 'logo', `WHERE logo != ?`, ['']);
    bmk = bmk.map((item) => _path.basename(item.logo)[0]);

    let user = await queryData('user', 'logo', `WHERE logo != ?`, ['']);
    user = user.map((item) => _path.basename(item.logo)[0]);

    const logos = [...bmk, ...user];
    const dir = _path.normalize(`${appConfig.appData}/logo`);

    const logoFiles = await getAllFile(dir);

    await concurrencyTasks(logoFiles, 5, async (item) => {
      const { name, path } = item;
      const p = _path.normalize(`${path}/${name}`);
      if (!logos.some((item) => item === name)) {
        await _delDir(p);
      }
    });

    await delEmptyFolder(dir);
    _success(res, '清理LOGO文件成功')(req);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 自定义代码
route.post('/custom-code', async (req, res) => {
  try {
    const { body = '', head = '' } = req.body;

    if (
      !validaString(body, 0, 0, 0, 1) ||
      !validaString(head, 0, 0, 0, 1) ||
      _f.getTextSize(body) > fieldLenght.customCodeSize ||
      _f.getTextSize(head) > fieldLenght.customCodeSize
    ) {
      paramErr(res, req);
      return;
    }

    const u = _path.normalize(`${appConfig.appData}/custom`);

    await _f.mkdir(u);
    await _f.fsp.writeFile(_path.normalize(`${u}/custom_head.html`), head);
    await _f.fsp.writeFile(_path.normalize(`${u}/custom_body.html`), body);

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

    Object.keys(_connect.getConnects()).forEach((key) => {
      _connect.send(key, temId, {
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

    if (!validaString(email, 1, fieldLenght.email) || !isEmail(email)) {
      paramErr(res, req);
      return;
    }

    if (!_d.email.state) {
      _err(res, '未开启邮箱验证');
      return;
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

// 创建帐号
route.post('/create-account', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      !validaString(username, 1, fieldLenght.username) ||
      !validaString(password, 1, fieldLenght.id, 1)
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
          update_at: 0,
          account,
          username,
          chat_id: nanoid(),
          password: await _crypto.hashPassword(password),
        },
      ],
      'account'
    );

    await becomeFriends(account, 'chang');
    await becomeFriends(account, 'hello');

    _success(res, '创建账号成功', { account, username })(
      req,
      `${username}-${account}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 系统状态
route.get('/sys-status', async (req, res) => {
  try {
    _success(res, 'ok', getSystemUsage());
  } catch (error) {
    _err(res)(req, error);
  }
});

// 定期清理聊天过期文件
timedTask.add(async (flag) => {
  if (flag.slice(-6) === '003000') {
    await cleanUpload();

    // 定期清理LOG文件
    const list = (
      await readMenu(_path.normalize(`${appConfig.appData}/log`))
    ).filter((f) => f.type === 'file');

    if (list.length > 200) {
      list.sort((a, b) => b.time - a.time);
      for (const item of list.slice(200)) {
        const { name, path } = item;
        const p = _path.normalize(`${path}/${name}`);
        await _delDir(p);
      }
    }
  }
});

export default route;
