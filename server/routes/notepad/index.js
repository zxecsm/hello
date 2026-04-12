import express from 'express';

import appConfig from '../../data/config.js';

import _f from '../../utils/f.js';

import { _delDir } from '../file/file.js';
import { fieldLength } from '../config.js';
import V from '../../utils/validRules.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 读取便条
route.get(
  '/',
  validate(
    'query',
    V.object({
      k: V.string().trim().min(1).max(fieldLength.filename).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { k } = res.locals.ctx;

    const p = appConfig.notepadDir(`${k}.md`);

    const note = (await _f.readFile(p, null, '')).toString();

    resp.success(res, '读取便条成功', note)();
  }),
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
  asyncHandler(async (_, res) => {
    const { k, data } = res.locals.ctx;

    const p = appConfig.notepadDir(`${k}.md`);

    if (data) {
      await _f.writeFile(p, data);
    } else {
      if (await _f.exists(p)) {
        await _delDir(p);
      }
    }
    resp.success(res, '更新便条成功')();
  }),
);

export default route;
