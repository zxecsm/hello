import express from 'express';

import {
  _err,
  validaString,
  paramErr,
  _success,
  uLog,
} from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { _delDir } from '../file/file.js';
import { fieldLength } from '../config.js';

const route = express.Router();

// 读取便条
route.get('/', async (req, res) => {
  try {
    const { k } = req.query;

    if (!validaString(k, 1, fieldLength.filename, 1)) {
      paramErr(res, req);
      return;
    }

    const p = appConfig.notepadDir(`${k}.md`);

    const note = (await _f.readFile(p, null, '')).toString();

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
      !validaString(k, 1, fieldLength.filename, 1) ||
      !validaString(data, 0, 0, 0, 1) ||
      _f.getTextSize(data) > fieldLength.noteSize
    ) {
      paramErr(res, req);
      return;
    }

    const p = appConfig.notepadDir(`${k}.md`);

    if (data) {
      await _f.writeFile(p, data);

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
