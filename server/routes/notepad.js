const express = require('express');
const {
  _err,
  validaString,
  paramErr,
  _success,
  _delDir,
  uLog,
} = require('../utils/utils');
const configObj = require('../data/config');
const _f = require('../utils/f');
const route = express.Router();
// 读取便条
route.get('/', async (req, res) => {
  try {
    const { k } = req.query;
    if (!validaString(k, 1, 20, 1)) {
      paramErr(res, req);
      return;
    }
    let note = '';
    const p = `${configObj.filepath}/notepad/${k}.md`;
    if (_f.c.existsSync(p)) {
      note = (await _f.p.readFile(p)).toString();
    }
    _success(res, '读取便条成功', note)(req, k, 1);
  } catch (error) {
    _err(res)(req, error);
  }
});
// 保存便条
route.post('/', async (req, res) => {
  try {
    const { k, data = '' } = req.body;
    if (!validaString(k, 1, 20, 1) || !validaString(data)) {
      paramErr(res, req);
      return;
    }
    const p = `${configObj.filepath}/notepad/${k}.md`;
    if (data) {
      if (!_f.c.existsSync(p)) {
        await _f.mkdir(`${configObj.filepath}/notepad`);
      }
      await _f.p.writeFile(p, data);
      await uLog(req, `更新便条成功(${k})`);
    } else {
      if (_f.c.existsSync(p)) {
        await _delDir(p).catch(() => {});
        await uLog(req, `删除便条成功(${k})`);
      }
    }
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});
module.exports = route;
