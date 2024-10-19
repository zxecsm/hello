import express from 'express';

import {
  _nologin,
  validaString,
  _success,
  _err,
  paramErr,
  receiveFiles,
  mergefile,
  validationValue,
  _type,
  _nothing,
  hdFilename,
  syncUpdateData,
  isFilename,
  uLog,
  concurrencyTasks,
  errorNotifyMsg,
  nanoid,
  formatDate,
  errLog,
} from '../../utils/utils.js';

import configObj from '../../data/config.js';

import { insertData } from '../../utils/sqlite.js';

import _f from '../../utils/f.js';

import { getFriendDes } from '../chat/chat.js';

import fileSize from './cacheFileSize.js';

import {
  getRootDir,
  getTrashDir,
  getCurPath,
  getDirSize,
  compressDir,
  compressFile,
  uncompress,
  readMenu,
  getUniqueFilename,
} from './file.js';

import { fieldLenght } from '../config.js';

import {
  validShareState,
  validShareAddUserState,
  splitShareFlag,
  isRoot,
} from '../user/user.js';

import _path from '../../utils/path.js';

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
      // 分享
      const [id, pass] = splitShareFlag(flag);

      const share = await validShareState(req, ['dir'], id, pass);

      if (share.state === 0) {
        _err(res, share.text)(req, id, 1);
        return;
      }

      const { data, account } = share.data;

      const { name } = data;

      // 用户根目录
      rootP = _path.normalize(`${getRootDir(account)}/${data.path}/${name}`);

      p = _path.normalize(`${rootP}/${path}`);
    } else {
      p = getCurPath(account, path);
      rootP = getRootDir(account);
    }

    if (await _f.exists(p)) {
      const arr = [];

      (await readMenu(p)).forEach((item) => {
        const fullPath = _path.normalize(`${item.path}/${item.name}`);

        // 隐藏回收站目录
        if (account && item.type === 'dir' && getTrashDir(account) === fullPath)
          return;

        const path = _path.normalize('/' + item.path.slice(rootP.length));

        const obj = {
          ...item,
          path,
        };

        if (item.type === 'dir') {
          // 读取缓存目录大小
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

      const rootP = _path.normalize(
        getRootDir(account) + '/' + data.path + '/' + name
      );

      p = _path.normalize(`${rootP}/${path}`);
    } else {
      p = getCurPath(account, path);
    }

    let size = 0;

    if (await _f.exists(p)) {
      size = await getDirSize(p);

      fileSize.add(p, size);
    }

    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      // 超时未处理完，完成后直接推送更新
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

      const rootP = _path.normalize(
        `${getRootDir(account)}/${data.path}/${name}`
      );

      if (type === 'file') {
        p = rootP;
      } else if (type === 'dir') {
        p = _path.normalize(`${rootP}/${path}`);
      }
    } else {
      p = getCurPath(account, path);
    }

    if (!(await _f.exists(p))) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    const stat = await _f.fsp.stat(p);

    if (stat.isDirectory()) {
      _err(res, '文件不存在')(req, p, 1);
      return;
    }

    // 文本文件直接返回
    if (stat.isFile() && _f.isTextFile(p)) {
      //文本文件
      _success(res, 'ok', {
        type: 'text',
        data: (await _f.fsp.readFile(p)).toString(),
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

// 验证登录态
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
    const fpath = _path.normalize(`${dir}/${name}`);

    const { account } = req._hello.userinfo;

    // 过滤回收站
    if ((await _f.exists(fpath)) || getTrashDir(account) === fpath) {
      _err(res, '已存在重名文件')(req, fpath, 1);
      return;
    }

    await _f.mkdir(dir);
    await _f.fsp.writeFile(fpath, '');

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
        _path.normalize(data.path) !== '/' &&
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
      _path.normalize(`${data.path}/${data.name}`),
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

    if (
      !validaString(path, 1, fieldLenght.url) ||
      !validaString(text, 0, 0, 0, 1)
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    const fpath = getCurPath(account, path);

    const stat = await _f.fsp.stat(fpath);

    if (
      !(await _f.exists(fpath)) ||
      stat.isDirectory() ||
      getTrashDir(account) === fpath
    ) {
      _err(res, '文件不存在')(req, fpath, 1);
      return;
    }

    try {
      if (stat.size > 0) {
        // 保存编辑历史版本
        const [, filename, , suffix] = _path.basename(fpath);

        const historyDir = _path.normalize(`${_path.dirname(fpath)}/.history`);

        await _f.mkdir(historyDir);

        const newName = `${filename}_${formatDate({
          template: `{0}{1}{2}-{3}{4}{5}`,
        })}${suffix ? `.${suffix}` : ''}`;

        await _f.cp(fpath, _path.normalize(`${historyDir}/${newName}`));
      }
    } catch (error) {
      await errLog(req, error);
    }

    await _f.fsp.writeFile(fpath, text);

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
      !validaString(path, 1, fieldLenght.url) ||
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

    if (!(await _f.exists(p))) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    const trashDir = getTrashDir(account);

    await concurrencyTasks(data, 5, async (task) => {
      let { name, path, type } = task;
      name = hdFilename(name);

      const f = getCurPath(account, _path.normalize(`${path}/${name}`));

      let to = _path.normalize(`${p}/${name}`);

      if (_path.isPathWithin(f, to) || !name) return;

      // 已存在添加后缀
      if ((await _f.exists(to)) || to === trashDir) {
        to = await getUniqueFilename(to);
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
      !validaString(path, 1, fieldLenght.url) ||
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

    if (!(await _f.exists(p))) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }

    const trashDir = getTrashDir(account);

    await concurrencyTasks(data, 5, async (task) => {
      let { name, path, type } = task;
      name = hdFilename(name);

      const f = getCurPath(account, _path.normalize(`${path}/${name}`));

      let t = _path.normalize(`${p}/${name}`);

      if (f === t || _path.isPathWithin(f, t) || !name) return;

      if ((await _f.exists(t)) || t === trashDir) {
        t = await getUniqueFilename(t);
      }

      try {
        await _f.fsp.rename(f, t);
      } catch {
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
    const f = _path.normalize(`${p}/${name}`);

    const fname = _path.extname(name)[0] + '.zip';

    let t = _path.normalize(`${p}/${fname}`);

    if ((await _f.exists(t)) || t === getTrashDir(account)) {
      t = await getUniqueFilename(t);
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
      _path.extname(data.name)[2].toLowerCase() != 'zip' &&
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
    const f = _path.normalize(`${p}/${name}`);

    const fname = _path.extname(name)[0];

    let t = _path.normalize(`${p}/${fname}`);

    if ((await _f.exists(t)) || t === getTrashDir(account)) {
      t = await getUniqueFilename(t);

      await uncompress(f, t);
    } else {
      await uncompress(f, _path.normalize(`${t}/`));
    }

    await uLog(req, `解压文件(${f}=>${t})`);

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

      const p = getCurPath(account, _path.normalize(`${path}/${name}`));

      if (
        force === 1 ||
        p === trashDir ||
        _path.isPathWithin(p, trashDir) ||
        _path.isPathWithin(trashDir, p)
      ) {
        await _f.del(p);
      } else {
        await _f.mkdir(trashDir);

        let targetPath = _path.normalize(`${trashDir}/${name}`);
        if (await _f.exists(targetPath)) {
          targetPath = await getUniqueFilename(targetPath);
        }

        try {
          // 移动失败则复制然后删除
          await _f.fsp.rename(p, targetPath);
        } catch {
          await _f.cp(p, targetPath);
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

    if (await _f.exists(trashDir)) {
      const list = await _f.fsp.readdir(trashDir);

      await concurrencyTasks(list, 5, async (item) => {
        const p = _path.normalize(`${trashDir}/${item}`);

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

    const fpath = getCurPath(
      req._hello.userinfo.account,
      _path.normalize(`${path}/${name}`)
    );

    if (await _f.exists(fpath)) {
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

    const p = _path.normalize(`${dir}/${data.name}`),
      t = _path.normalize(`${dir}/${name}`);

    if ((await _f.exists(t)) || getTrashDir(account) === t) {
      _err(res, '已存在重名文件')(req, t, 1);
      return;
    }

    await _f.fsp.rename(p, t);

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
    const p = _path.normalize(`${dir}/${data.name}`);

    if (!isRoot(req)) {
      _err(res, '无权操作')(req, p, 1);
      return;
    }

    const txt = data.type === 'dir' ? '文件夹' : '文件';
    if (!(await _f.exists(p))) {
      _err(res, `${txt}不存在`)(req, p, 1);
      return;
    }

    await _f.fsp.chmod(p, mode.toString(8));

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

    const path = _path.normalize(
      `${configObj.filepath}/tem/${account}_${HASH}`
    );

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
      count < 1 ||
      count > fieldLenght.maxFileSlice
    ) {
      paramErr(res, req);
      return;
    }

    const { account } = req._hello.userinfo;

    let targetPath = getCurPath(account, path);

    if (targetPath === getTrashDir(account)) {
      targetPath = await getUniqueFilename(targetPath);
    }

    // 存在先删除
    if (await _f.exists(targetPath)) {
      await _f.del(targetPath);
    } else {
      await _f.mkdir(_path.dirname(targetPath));
    }

    await mergefile(
      count,
      _path.normalize(`${configObj.filepath}/tem/${account}_${HASH}`),
      targetPath
    );

    if (timer) {
      clearTimeout(timer);
      timer = null;
    } else {
      req._hello.temid = nanoid();
      syncUpdateData(req, 'file');
    }

    _success(res, `上传文件成功`)(req, targetPath, 1);
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

    let path = _path.normalize(`${configObj.filepath}/tem/${account}_${HASH}`),
      list = [];

    if (await _f.exists(path)) {
      list = await _f.fsp.readdir(path);
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

    if (!validaString(path, 1, fieldLenght.url)) {
      paramErr(res, req);
      return;
    }

    const p = getCurPath(req._hello.userinfo.account, path);

    if (await _f.exists(p)) {
      _success(res);
      return;
    }

    _nothing(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
