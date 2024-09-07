const express = require('express');
const {
  _nologin,
  validaString,
  readMenu,
  _success,
  _err,
  paramErr,
  _hdPath,
  getRootDir,
  hdPath,
  isTextFile,
  getFileDir,
  receiveFiles,
  mergefile,
  validationValue,
  _type,
  getSuffix,
  getRandomName,
  compressDir,
  compressFile,
  uncompress,
  nanoid,
  isParentDir,
  _nothing,
  isValid,
  errLog,
  hdFilename,
  syncUpdateData,
  isFilename,
  uLog,
  isRoot,
  getDirSize,
  getTrashDir,
  getPathFilename,
} = require('../utils/utils');
const configObj = require('../data/config');
const { insertData, queryData } = require('../utils/sqlite');
const _f = require('../utils/f');
const shareVerify = require('../utils/shareVerify');
const route = express.Router();
// 分享文件
route.get('/share', async (req, res) => {
  try {
    const { id, pass = '' } = req.query;
    if (!validaString(id, 1, 50, 1) || !validaString(pass, 0, 20)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const ip = req._hello.ip;
    if (shareVerify.verify(ip, id)) {
      const share = (
        await queryData('getshare', '*', `WHERE id=? AND type IN(?,?)`, [
          id,
          'file',
          'dir',
        ])
      )[0];
      if (!share) {
        _err(res, '分享已取消')(req, id, 1);
        return;
      }
      if (isValid(share.valid)) {
        _err(res, '分享已过期')(req, id, 1);
        return;
      }
      if (share.pass && pass !== share.pass) {
        if (pass) {
          shareVerify.add(ip, id);
        }
        await errLog(req, `提取码错误(${id})`);
        _nothing(res, '提取码错误');
        return;
      }
      if (account && account != share.account) {
        const fArr = await queryData('friends', '*', `WHERE account=?`, [
          account,
        ]);
        const f = fArr.find((item) => item.friend == share.account);
        if (f) {
          share.username = f.des || share.username;
        }
      }
      _success(res, '获取文件分享成功', {
        ...share,
        data: JSON.parse(share.data),
      })(req, id, 1);
    } else {
      _err(res, '提取码多次错误，请10分钟后再试')(req, id, 1);
    }
  } catch (error) {
    _err(res)(req, error);
  }
});
const fileSize = {
  keys: {},
  add(p, size) {
    const key = `h_${p}`;
    this.keys[key] = { size, t: Date.now() };
  },
  get(p) {
    this.clear();
    const key = `h_${p}`;
    const value = this.keys[key];
    return value ? this.keys[key].size : 0;
  },
  clear() {
    const t = Date.now();
    Object.keys(this.keys).forEach((key) => {
      if (t - this.keys[key].t >= 60 * 60 * 1000) {
        delete this.keys[key];
      }
    });
  },
};
//读取目录
route.get('/read-dir', async (req, res) => {
  try {
    const { path, flag = '' } = req.query;
    if (!validaString(path, 1) || !validaString(flag, 0, 70)) {
      paramErr(res, req);
      return;
    }
    let p = '';
    let rootP = '';
    const { account } = req._hello.userinfo;
    if (flag) {
      const [id, pass] = flag.split('/');
      const share = (
        await queryData('share', '*', `WHERE id=? AND type=? AND pass=?`, [
          id,
          'dir',
          pass,
        ])
      )[0];
      if (!share || isValid(share.valid)) {
        p = '';
      } else {
        const obj = JSON.parse(share.data);
        const { name } = obj;
        rootP = hdPath(getRootDir(share.account) + '/' + obj.path + '/' + name);
        p = hdPath(`${rootP}/${path}`);
      }
    } else {
      if (!account) {
        _nologin(res);
        return;
      }
      p = _hdPath(account, path);
      rootP = getRootDir(account);
    }
    if (_f.c.existsSync(p)) {
      const arr = [];
      (await readMenu(p)).forEach((item) => {
        const fullPath = hdPath(`${item.path}/${item.name}`);
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
  try {
    const { path, flag = '' } = req.query;
    if (!validaString(path, 1) || !validaString(flag, 0, 70)) {
      paramErr(res, req);
      return;
    }
    let p = '';
    if (flag) {
      const [id, pass] = flag.split('/');
      const share = (
        await queryData('share', '*', `WHERE id=? AND type=? AND pass=?`, [
          id,
          'dir',
          pass,
        ])
      )[0];
      if (!share || isValid(share.valid)) {
        p = '';
      } else {
        const obj = JSON.parse(share.data);
        const { name } = obj;
        const rootP = hdPath(
          getRootDir(share.account) + '/' + obj.path + '/' + name
        );
        p = hdPath(`${rootP}/${path}`);
      }
    } else {
      const { account } = req._hello.userinfo;
      if (!account) {
        _nologin(res);
        return;
      }
      p = _hdPath(account, path);
    }
    let size = 0;
    if (_f.c.existsSync(p)) {
      size = await getDirSize(p);
      fileSize.add(p, size);
    }
    _success(res, '读取文件夹大小成功', { size })(req, p, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 读取文件
route.get('/read-file', async (req, res) => {
  try {
    const { path = '', flag = '' } = req.query;
    if (!validaString(path) || !validaString(flag, 0, 70)) {
      paramErr(res, req);
      return;
    }
    let p = '';
    if (flag) {
      const [id, pass] = flag.split('/');
      const share = (
        await queryData(
          'share',
          '*',
          `WHERE id=? AND type IN(?,?) AND pass=?`,
          [id, 'file', 'dir', pass]
        )
      )[0];
      if (!share || isValid(share.valid)) {
        p = '';
      } else {
        const obj = JSON.parse(share.data);
        const { name, type } = obj;
        const rootP = hdPath(
          getRootDir(share.account) + '/' + obj.path + '/' + name
        );
        if (type == 'file') {
          p = rootP;
        } else if (type == 'dir') {
          p = hdPath(`${rootP}/${path}`);
        }
      }
    } else {
      const { account } = req._hello.userinfo;
      if (!account) {
        _nologin(res);
        return;
      }
      p = _hdPath(account, path);
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
    if (!validaString(path, 1) || !validaString(name, 1, 255)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }
    const dir = _hdPath(req._hello.userinfo.account, path);
    const fpath = hdPath(`${dir}/${name}`);
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
    const { account } = req._hello.userinfo;
    let { data, title, valid, pass = '' } = req.body;
    valid = parseInt(valid);
    if (
      !validaString(title, 1, 100) ||
      !validaString(pass, 0, 20) ||
      isNaN(valid) ||
      valid > 999 ||
      (!_type.isObject(data) &&
        !validaString(data.name, 1) &&
        !validaString(data.path, 1) &&
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
    await insertData('share', [
      {
        id: nanoid(),
        account,
        type: data.type,
        valid: valid == 0 ? 0 : Date.now() + valid * 24 * 60 * 60 * 1000,
        title,
        pass,
        data: JSON.stringify(data),
      },
    ]);
    syncUpdateData(req, 'sharelist');
    _success(res, `分享${data.type == 'dir' ? '文件夹' : '文件'}成功`)(
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
    if (!validaString(path, 1) || !validaString(text)) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const fpath = _hdPath(account, path);
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
  try {
    const { path, data } = req.body;
    if (
      !validaString(path, 1) ||
      !_type.isArray(data) ||
      data.length == 0 ||
      data.length > 200 ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1) &&
          validaString(item.path, 1) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const p = _hdPath(account, path);
    if (!_f.c.existsSync(p)) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }
    const trashDir = getTrashDir(account);
    for (let i = 0; i < data.length; i++) {
      let { name, path, type } = data[i];
      name = hdFilename(name);
      const f = _hdPath(account, `${path}/${name}`);
      let to = hdPath(`${p}/${name}`);
      if (isParentDir(f, to) || !name) {
        continue;
      }
      if (_f.c.existsSync(to) || to === trashDir) {
        to = hdPath(`${p}/${getRandomName(name)}`);
      }
      await _f.cp(f, to);
      await uLog(req, `复制${type == 'dir' ? '文件夹' : '文件'}(${f}=>${to})`);
    }
    syncUpdateData(req, 'file');
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 移动
route.post('/move', async (req, res) => {
  try {
    const { path, data } = req.body;
    if (
      !validaString(path, 1) ||
      !_type.isArray(data) ||
      data.length == 0 ||
      data.length > 200 ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1) &&
          validaString(item.path, 1) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const p = _hdPath(account, path);
    if (!_f.c.existsSync(p)) {
      _err(res, '目标文件夹不存在')(req, p, 1);
      return;
    }
    const trashDir = getTrashDir(account);
    for (let i = 0; i < data.length; i++) {
      let { name, path, type } = data[i];
      name = hdFilename(name);
      const f = _hdPath(account, `${path}/${name}`);
      let t = hdPath(`${p}/${name}`);
      if (f === t || isParentDir(f, t) || !name) {
        continue;
      }
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
      await uLog(req, `移动${type == 'dir' ? '文件夹' : '文件'}(${f}=>${t})`);
    }
    syncUpdateData(req, 'file');
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 压缩
route.post('/zip', async (req, res) => {
  try {
    const { data } = req.body;
    if (
      !_type.isObject(data) &&
      !validaString(data.name, 1) &&
      !validaString(data.path, 1) &&
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
    const p = _hdPath(account, path);
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
    syncUpdateData(req, 'file');
    await uLog(req, `压缩${type == 'dir' ? '文件夹' : '文件'}(${f}=>${t})`);
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 解压缩
route.post('/unzip', async (req, res) => {
  try {
    const { data } = req.body;
    if (
      !_type.isObject(data) &&
      !validaString(data.name, 1) &&
      getSuffix(data.name)[1].toLowerCase() != 'zip' &&
      !validaString(data.path, 1) &&
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
    const p = _hdPath(account, path);
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
    syncUpdateData(req, 'file');
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 删除
route.post('/delete', async (req, res) => {
  try {
    const { data, force = 'n' } = req.body;
    if (
      !_type.isArray(data) ||
      !validationValue(force, ['y', 'n']) ||
      data.length == 0 ||
      data.length > 200 ||
      !data.every(
        (item) =>
          _type.isObject(item) &&
          validaString(item.name, 1) &&
          validaString(item.path, 1) &&
          validationValue(item.type, ['dir', 'file'])
      )
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    const trashDir = getTrashDir(account);
    for (let i = 0; i < data.length; i++) {
      let { path, name, type } = data[i];
      const p = _hdPath(account, `${path}/${name}`);
      if (
        force === 'y' ||
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
      await uLog(req, `删除${type == 'dir' ? '文件夹' : '文件'}(${p})`);
    }
    syncUpdateData(req, 'file');
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 新建目录
route.post('/create-dir', async (req, res) => {
  try {
    const { path, name } = req.body;
    if (!validaString(path, 1) || !validaString(name, 1, 255)) {
      paramErr(res, req);
      return;
    }
    if (!isFilename(name)) {
      _err(res, '名称包含了不允许的特殊字符')(req, name, 1);
      return;
    }
    const fpath = _hdPath(req._hello.userinfo.account, `${path}/${name}`);
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
      !validaString(name, 1, 255) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1) ||
      !validaString(data.path, 1) ||
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
    const dir = _hdPath(account, data.path);
    const p = hdPath(`${dir}/${data.name}`),
      t = hdPath(`${dir}/${name}`);
    if (_f.c.existsSync(t) || getTrashDir(account) === t) {
      _err(res, '已存在重名文件')(req, t, 1);
      return;
    }
    await _f.p.rename(p, t);
    syncUpdateData(req, 'file');
    _success(res, `重命名${data.type == 'dir' ? '文件夹' : '文件'}成功`)(
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
    const { account } = req._hello.userinfo;
    if (
      !/^[0-7]{3}$/.test(mode) ||
      !_type.isObject(data) ||
      !validaString(data.name, 1) ||
      !validaString(data.path, 1) ||
      !validationValue(data.type, ['dir', 'file'])
    ) {
      paramErr(res, req);
      return;
    }
    const dir = _hdPath(account, data.path);
    const p = hdPath(`${dir}/${data.name}`);
    if (!isRoot(req)) {
      _err(res, '无权操作')(req, p, 1);
      return;
    }
    const txt = data.type == 'dir' ? '文件夹' : '文件';
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
      !validaString(HASH, 1, 50, 1) ||
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
  try {
    let { HASH, count, path } = req.body;
    count = parseInt(count);
    if (
      !validaString(HASH, 1, 50, 1) ||
      !validaString(path, 1) ||
      isNaN(count) ||
      count < 1
    ) {
      paramErr(res, req);
      return;
    }
    const { account } = req._hello.userinfo;
    let fpath = _hdPath(account, path);
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
    _success(res, `上传文件成功`)(req, fpath, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 断点续传
route.post('/breakpoint', async (req, res) => {
  try {
    const { HASH } = req.body;
    if (!validaString(HASH, 1, 50, 1)) {
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
    const p = _hdPath(req._hello.userinfo.account, path);
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
