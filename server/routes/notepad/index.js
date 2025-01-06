import express from 'express';

import {
  _err,
  validaString,
  paramErr,
  _success,
  uLog,
  getTextSize,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { _delDir } from '../file/file.js';
import _path from '../../utils/path.js';
import { fieldLenght } from '../config.js';

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

    const p = _path.normalize(`${appConfig.appData}/notepad/${k}.md`);

    if (await _f.exists(p)) {
      note = (await _f.fsp.readFile(p)).toString();
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

    if (
      !validaString(k, 1, 20, 1) ||
      !validaString(data, 0, 0, 0, 1) ||
      getTextSize(data) > fieldLenght.noteSize
    ) {
      paramErr(res, req);
      return;
    }

    const p = _path.normalize(`${appConfig.appData}/notepad/${k}.md`);

    if (data) {
      if (!(await _f.exists(p))) {
        await _f.mkdir(_path.dirname(p));
      }

      await _f.fsp.writeFile(p, data);

      await uLog(req, `更新便条成功(${k})`);
    } else {
      if (await _f.exists(p)) {
        await _delDir(p);

        await uLog(req, `删除便条成功(${k})`);
      }
    }
    _success(res);
  } catch (error) {
    _err(res)(req, error);
  }
});

export default route;
