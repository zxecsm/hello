const express = require('express');

const {
  _nologin,
  validaString,
  _success,
  _err,
  paramErr,
  isTextFile,
  receiveFiles,
  mergefile,
  validationValue,
  _type,
  _nothing,
  hdFilename,
  syncUpdateData,
  isFilename,
  uLog,
  isRoot,
  concurrencyTasks,
  errorNotifyMsg,
  nanoid,
} = require('../../utils/utils');

const configObj = require('../../data/config');

const { insertData } = require('../../utils/sqlite');

const _f = require('../../utils/f');

const { getFriendDes } = require('../chat/chat');

const fileSize = require('./cacheFileSize');

const {
  hdPath,
  getRootDir,
  getTrashDir,
  getCurPath,
  isParentDir,
  getPathFilename,
  getDirSize,
  getSuffix,
  getRandomName,
  getFileDir,
  compressDir,
  compressFile,
  uncompress,
  readMenu,
} = require('./file');
const { fieldLenght } = require('../config');
const {
  validShareState,
  validShareAddUserState,
  splitShareFlag,
} = require('../user/user');

const route = express.Router();

// 分享文件
route.get('/share', async (req, res) => {
  try {
    const { id, pass = '' } = req.query;

    if (
      !validaString(id, 1, fieldLenght.id, 1) ||
      !validaString(pass, 0, fieldLenght.sharePass)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const share = await validShareAddUserState(req, ['file', 'dir'], id, pass);

    if (share.state === 3) {
      _nothing(res, share.text);
      return;
    }

    if (share.state === 0) {
      _err(res, share.text)(req, id, 1);
      return;
    }

    let {
      username,
      logo,
      email,
      exp_time,
      title,
      account: acc,
      data,
    } = share.data;

    if (account && account != acc) {
      const des = await getFriendDes(account, acc);

      username = des || username;
    }

    _success(res, '获取文件分享成功', {
      username,
      logo,
      email,
      exp_time,
      account: acc,
      data,
      title,
    })(req, id, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

//读取目录
route.get('/read-dir', async (req, res) => {
  try {
    const { path, flag = '' } = req.query;

    if (
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(flag, 0, fieldLenght.shareFlag)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!flag && !account) {
      _nologin(res);
      return;
    }

    let p = '';
    let rootP = '';

    if (flag) {
      const [id, pass] = splitShareFlag(flag);

      const share = await validShareState(req, ['dir'], id, pass);

      if (share.state === 0) {
        _err(res, share.text)(req, id, 1);
        return;
      }

      const { data, account } = share.data;

      const { name } = data;

      rootP = hdPath(getRootDir(account) + '/' + data.path + '/' + name);

      p = hdPath(`${rootP}/${path}`);
    } else {
      p = getCurPath(account, path);
      rootP = getRootDir(account);
    }

    if (_f.c.existsSync(p)) {
      const arr = [];

      (await readMenu(p)).forEach((item) => {
        const fullPath = hdPath(`${item.path}/${item.name}`);

        // 隐藏回收站目录
        if (account && item.type === 'dir' && getTrashDir(account) === fullPath)
          return;

        const path = hdPath('/' + item.path.slice(rootP.length));

        const obj = {
          ...item,
          path,
        };

        if (item.type === 'dir') {
          obj.size = fileSize.get(fullPath);
        }

        arr.push(obj);
      });

      _success(res, 'ok', arr);
    } else {
      _success(res, 'ok', []);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 读取目录大小
route.get('/read-dir-size', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { path, flag = '' } = req.query;

    if (
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(flag, 0, fieldLenght.shareFlag)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!flag && !account) {
      _nologin(res);
      return;
    }

    let p = '';

    if (flag) {
      const [id, pass] = splitShareFlag(flag);

      const share = await validShareState(req, ['dir'], id, pass);

      if (share.state === 0) {
        _err(res, share.text)(req, id, 1);
        return;
      }

      const { data, account } = share.data;

      const { name } = data;

      const rootP = hdPath(getRootDir(account) + '/' + data.path + '/' + name);

      p = hdPath(`${rootP}/${path}`);
    } else {
      p = getCurPath(account, path);
    }

    let size = 0;

    if (_f.c.existsSync(p)) {
      size = await getDirSize(p);

      fileSize.add(p, size);
    }

    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res, '读取文件夹大小成功', { size })(req, p, 1);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `读取文件夹大小失败`);
    }

    _err(res)(req, error);
  }
});

// 读取文件
route.get('/read-file', async (req, res) => {
  try {
    const { path = '', flag = '' } = req.query;

    if (
      !validaString(path, 0, fieldLenght.url) ||
      !validaString(flag, 0, fieldLenght.shareFlag)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    if (!flag && !account) {
      _nologin(res);
      return;
    }

    let p = '';

    if (flag) {
      const [id, pass] = splitShareFlag(flag);

      const share = await validShareState(req, ['dir', 'file'], id, pass);

      if (share.state === 0) {
        _err(res, share.text)(req, id, 1);
        return;
      }

      const { data, account } = share.data;

      const { name, type } = data;

      const rootP = hdPath(getRootDir(account) + '/' + data.path + '/' + name);

      if (type === 'file') {
        p = rootP;
      } else if (type === 'dir') {
        p = hdPath(`${rootP}/${path}`);
      }
    } else {
      p = getCurPath(account, path);
    }

    if (!_f.c.existsSync(p)) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    const stat = await _f.p.stat(p);

    if (stat.isDirectory()) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    if (stat.isFile() && isTextFile(p)) {
      //文本文件
      _success(res, 'ok', {
        type: 'text',
        data: (await _f.p.readFile(p)).toString(),
      });
    } else {
      _success(res, 'ok', {
        type: 'other',
      });
    }
  } catch (error) {
    _err(res)(req, error);
  }
});

// 拦截器
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 新建文件
route.post('/create-file', async (req, res) => {
  try {
    const { path, name } = req.body;

    if (
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(name, 1, fieldLenght.filename)
    ) {
      paramErr(res, req);
      return;
    }

    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const dir = getCurPath(req._hello.userinfo.account, path);
    const fpath = hdPath(`${dir}/${name}`);

    const { account } = req._hello.userinfo;

    if (_f.c.existsSync(fpath) || getTrashDir(account) === fpath) {
      _err(res, '已存在重名文件')(req, fpath, 1);
      return;
    }

    await _f.mkdir(dir);
    await _f.p.writeFile(fpath, '');

    syncUpdateData(req, 'file');

    _success(res, '新建文件成功')(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 分享
route.post('/share', async (req, res) => {
  try {
    let { data, title, expireTime, pass = '' } = req.body;
    expireTime = parseInt(expireTime);

    if (
      !validaString(title, 1, fieldLenght.title) ||
      !validaString(pass, 0, fieldLenght.sharePass) ||
      isNaN(expireTime) ||
      expireTime > fieldLenght.expTime ||
      (!_type.isObject(data) &&
        !validaString(data.name, 1, fieldLenght.filename) &&
        !validaString(data.path, 1, fieldLenght.url) &&
        hdPath(data.path) !== '/' &&
        !validationValue(data.type, ['dir', 'file']))
    ) {
      paramErr(res, req);
      return;
    }

    data.name = hdFilename(data.name);

    if (!data.name) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    await insertData('share', [
      {
        account,
        type: data.type,
        exp_time:
          expireTime === 0 ? 0 : Date.now() + expireTime * 24 * 60 * 60 * 1000,
        title,
        pass,
        data: JSON.stringify(data),
      },
    ]);

    syncUpdateData(req, 'sharelist');

    _success(res, `分享${data.type === 'dir' ? '文件夹' : '文件'}成功`)(
      req,
      `${data.path}/${data.name}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 保存文件
route.post('/save-file', async (req, res) => {
  try {
    const { path, text = '' } = req.body;

    if (!validaString(path, 1, fieldLenght.url) || !validaString(text)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const fpath = getCurPath(account, path);

    if (!_f.c.existsSync(fpath) || getTrashDir(account) === fpath) {
      _err(res, '文件不存在')(req, fpath, 1);
      return;
    }

    await _f.p.writeFile(fpath, text);

    syncUpdateData(req, 'file');

    _success(res, '保存文件成功')(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 复制
route.post('/copy', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { path, data } = req.body;

    if (
      !validaString(path, 1) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLenght.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    if (!_f.c.existsSync(p)) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    const trashDir = getTrashDir(account);

    await concurrencyTasks(data, 5, async (task) => {
      let { name, path, type } = task;
      name = hdFilename(name);

      const f = getCurPath(account, `${path}/${name}`);

      let to = hdPath(`${p}/${name}`);

      if (isParentDir(f, to) || !name) return;

      if (_f.c.existsSync(to) || to === trashDir) {
        to = hdPath(`${p}/${getRandomName(name)}`);
      }

      await _f.cp(f, to);

      await uLog(req, `复制${type === 'dir' ? '文件夹' : '文件'}(${f}=>${to})`);
    });

    if (timer) {
      syncUpdateData(req, 'file');
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `复制文件失败`);
    }

    _err(res)(req, error);
  }
});

// 移动
route.post('/move', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { path, data } = req.body;

    if (
      !validaString(path, 1) ||
      !_type.isArray(data) ||
      data.length === 0 ||
      data.length > fieldLenght.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);

    if (!_f.c.existsSync(p)) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    const trashDir = getTrashDir(account);

    await concurrencyTasks(data, 5, async (task) => {
      let { name, path, type } = task;
      name = hdFilename(name);

      const f = getCurPath(account, `${path}/${name}`);

      let t = hdPath(`${p}/${name}`);

      if (f === t || isParentDir(f, t) || !name) return;

      if (_f.c.existsSync(t) || t === trashDir) {
        t = hdPath(`${p}/${getRandomName(name)}`);
      }

      try {
        await _f.p.rename(f, t);
        // eslint-disable-next-line no-unused-vars
      } catch (error) {
        await _f.cp(f, t);
        await _f.del(f);
      }

      await uLog(req, `移动${type === 'dir' ? '文件夹' : '文件'}(${f}=>${t})`);
    });

    if (timer) {
      syncUpdateData(req, 'file');
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `移动文件失败`);
    }

    _err(res)(req, error);
  }
});

// 压缩
route.post('/zip', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { data } = req.body;

    if (
      !_type.isObject(data) &&
      !validaString(data.name, 1, fieldLenght.filename) &&
      !validaString(data.path, 1, fieldLenght.url) &&
      !validationValue(data.type, ['file', 'dir'])
    ) {
      paramErr(res, req);
      return;
    }

    let { name, path, type } = data;
    name = hdFilename(name);

    if (!name) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);
    const f = hdPath(`${p}/${name}`);

    const fname = getSuffix(name)[0] + '.zip';

    let t = hdPath(`${p}/${fname}`);

    if (_f.c.existsSync(t) || t === getTrashDir(account)) {
      t = hdPath(`${p}/${getRandomName(fname)}`);
    }

    if (type === 'dir') {
      await compressDir(f, t);
    } else {
      await compressFile(f, t);
    }

    await uLog(req, `压缩${type === 'dir' ? '文件夹' : '文件'}(${f}=>${t})`);

    if (timer) {
      syncUpdateData(req, 'file');
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `压缩失败`);
    }

    _err(res)(req, error);
  }
});

// 解压缩
route.post('/unzip', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { data } = req.body;

    if (
      !_type.isObject(data) &&
      !validaString(data.name, 1, fieldLenght.filename) &&
      getSuffix(data.name)[1].toLowerCase() != 'zip' &&
      !validaString(data.path, 1, fieldLenght.url) &&
      !validationValue(data.type, ['file'])
    ) {
      paramErr(res, req);
      return;
    }

    let { name, path } = data;

    name = hdFilename(name);

    if (!name) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const p = getCurPath(account, path);
    const f = hdPath(`${p}/${name}`);

    const fname = getSuffix(name)[0];

    let t = hdPath(`${p}/${fname}`);

    if (_f.c.existsSync(t) || t === getTrashDir(account)) {
      t = hdPath(`${p}/${getRandomName(fname)}`);

      await uncompress(f, t);
      await uLog(req, `解压文件(${f}=>${t})`);
    } else {
      await uncompress(f, hdPath(`${t}/`));
      await uLog(req, `解压文件(${f}=>${t}/)`);
    }

    if (timer) {
      syncUpdateData(req, 'file');
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `解压失败`);
    }

    _err(res)(req, error);
  }
});

// 删除
route.post('/delete', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { data, force = 0 } = req.body;

    if (
      !_type.isArray(data) ||
      !validationValue(force, [1, 0]) ||
      data.length === 0 ||
      data.length > fieldLenght.maxPagesize ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1, fieldLenght.filename) &&
          validaString(item.path, 1, fieldLenght.url) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const trashDir = getTrashDir(account);

    await concurrencyTasks(data, 5, async (task) => {
      let { path, name, type } = task;

      const p = getCurPath(account, `${path}/${name}`);

      if (
        force === 1 ||
        p === trashDir ||
        isParentDir(p, trashDir) ||
        isParentDir(trashDir, p)
      ) {
        await _f.del(p);
      } else {
        await _f.mkdir(trashDir);

        if (_f.c.existsSync(`${trashDir}/${name}`)) {
          name = getRandomName(name);
        }

        try {
          await _f.p.rename(p, `${trashDir}/${name}`);
          // eslint-disable-next-line no-unused-vars
        } catch (error) {
          await _f.cp(p, `${trashDir}/${name}`);
          await _f.del(p);
        }
      }

      await uLog(req, `删除${type === 'dir' ? '文件夹' : '文件'}(${p})`);
    });

    if (timer) {
      syncUpdateData(req, 'file');
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `删除失败`);
    }

    _err(res)(req, error);
  }
});

// 清空回收站
route.get('/clear-trash', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    const { account } = req._hello.userinfo;

    const trashDir = getTrashDir(account);

    if (_f.c.existsSync(trashDir)) {
      const list = await _f.p.readdir(trashDir);

      await concurrencyTasks(list, 5, async (item) => {
        const p = `${trashDir}/${item}`;

        await _f.del(p);
      });
    }

    if (timer) {
      syncUpdateData(req, 'file');
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res, '清空回收站成功')(req);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `清空回收站失败`);
    }

    _err(res)(req, error);
  }
});

// 新建目录
route.post('/create-dir', async (req, res) => {
  try {
    const { path, name } = req.body;

    if (
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(name, 1, fieldLenght.filename)
    ) {
      paramErr(res, req);
      return;
    }

    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const fpath = getCurPath(req._hello.userinfo.account, `${path}/${name}`);

    if (_f.c.existsSync(fpath)) {
      _err(res, '已存在重名文件')(req, fpath, 1);
      return;
    }

    await _f.mkdir(fpath);

    syncUpdateData(req, 'file');

    _success(res, '新建文件夹成功')(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 重命名
route.post('/rename', async (req, res) => {
  try {
    const { data, name } = req.body;

    if (
      !validaString(name, 1, fieldLenght.filename) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLenght.filename) ||
      !validaString(data.path, 1, fieldLenght.url) ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }

    const { account } = req._hello.userinfo;

    const dir = getCurPath(account, data.path);

    const p = hdPath(`${dir}/${data.name}`),
      t = hdPath(`${dir}/${name}`);

    if (_f.c.existsSync(t) || getTrashDir(account) === t) {
      _err(res, '已存在重名文件')(req, t, 1);
      return;
    }

    await _f.p.rename(p, t);

    syncUpdateData(req, 'file');

    _success(res, `重命名${data.type === 'dir' ? '文件夹' : '文件'}成功`)(
      req,
      `${p}=>${t}`,
      1
    );
  } catch (error) {
    _err(res)(req, error);
  }
});

// 文件权限
route.post('/mode', async (req, res) => {
  try {
    const { data, mode } = req.body;

    if (
      !/^[0-7]{3}$/.test(mode) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1, fieldLenght.filename) ||
      !validaString(data.path, 1, fieldLenght.url) ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const dir = getCurPath(account, data.path);
    const p = hdPath(`${dir}/${data.name}`);

    if (!isRoot(req)) {
      _err(res, '无权操作')(req, p, 1);
      return;
    }

    const txt = data.type === 'dir' ? '文件夹' : '文件';
    if (!_f.c.existsSync(p)) {
      _err(res, `${txt}不存在`)(req, p, 1);
      return;
    }

    await _f.p.chmod(p, mode.toString(8));

    syncUpdateData(req, 'file');

    _success(res, `设置${txt}权限成功`)(req, `${p}-${mode}`, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 上传
route.post('/up', async (req, res) => {
  try {
    const { HASH, name } = req.query;

    if (
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(name, 1, 20, 1) ||
      !/^_[0-9]+$/.test(name)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const path = `${configObj.filepath}/tem/${account}_${HASH}`;

    await _f.mkdir(path);

    await receiveFiles(req, path, name, 50);

    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

// 合并文件
route.post('/merge', async (req, res) => {
  let timer = setTimeout(() => {
    clearTimeout(timer);
    timer = null;
  }, fieldLenght.operationTimeout);

  try {
    let { HASH, count, path } = req.body;
    count = parseInt(count);

    if (
      !validaString(HASH, 1, fieldLenght.id, 1) ||
      !validaString(path, 1, fieldLenght.url) ||
      isNaN(count) ||
      count < 1
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let fpath = getCurPath(account, path);
    const dir = getFileDir(fpath);

    let name = getPathFilename(fpath)[0];

    if (fpath === getTrashDir(account)) {
      name = getRandomName(name);
      fpath = hdPath(`${dir}/${name}`);
    }

    if (_f.c.existsSync(fpath)) {
      await _f.del(fpath);
    } else {
      await _f.mkdir(dir);
    }

    await mergefile(
      count,
      `${configObj.filepath}/tem/${account}_${HASH}`,
      `${fpath}`
    );

    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res, `上传文件成功`)(req, fpath, 1);
  } catch (error) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      errorNotifyMsg(req, `上传文件失败`);
    }

    _err(res)(req, error);
  }
});

// 断点续传
route.post('/breakpoint', async (req, res) => {
  try {
    const { HASH } = req.body;

    if (!validaString(HASH, 1, fieldLenght.id, 1)) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let path = `${configObj.filepath}/tem/${account}_${HASH}`,
      list = [];

    if (_f.c.existsSync(path)) {
      list = await _f.p.readdir(path);
    }

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 重复
route.post('/repeat', async (req, res) => {
  try {
    const { path } = req.body;

    if (!validaString(path, 1)) {
      paramErr(res, req);
      return;
    }

    const p = getCurPath(req._hello.userinfo.account, path);

    if (_f.c.existsSync(p)) {
      _success(res);
      return;
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

module.exports = route;
