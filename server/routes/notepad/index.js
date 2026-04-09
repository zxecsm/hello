import express from 'express';

import { uLog, validate } from '../../utils/utils.js';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { _delDir } from '../file/file.js';
import { fieldLength } from '../config.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';
import resp from '../../utils/response.js';

const route = express.Router();
const kValidate = sym('validate');

// 读取便条
route.get(
  '/',
  validate(
    'query',
    V.object({
      k: V.string().trim().min(1).max(fieldLength.filename).alphanumeric(),
    }),
  ),
  async (req, res) => {
    try {
      const { k } = req[kValidate];

      const p = appConfig.notepadDir(`${k}.md`);

      const note = (await _f.readFile(p, null, '')).toString();

      resp.success(res, '读取便条成功', note)(req, k, 1);
    } catch (error) {
      resp.error(res)(req, error);
    }
  },
);

// 保存便条
route.post(
  '/',
  validate(
    'body',
    V.object({
      k: V.string().trim().min(1).max(fieldLength.filename).alphanumeric(),
      data: V.string()
        .default('')
        .allowEmpty()
        .custom(
          (data) => _f.getTextSize(data) <= fieldLength.noteSize,
          `文本内容不能超过: ${fieldLength.noteSize} 字节`,
        ),
    }),
  ),
  async (req, res) => {
    try {
      const { k, data } = req[kValidate];

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
      resp.success(res);
    } catch (error) {
      resp.error(res)(req, error);
    }
  },
);

export default route;
