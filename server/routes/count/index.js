import express from 'express';

import { db } from '../../utils/sqlite.js';

import timedTask from '../../utils/timedTask.js';

import {
  _nologin,
  _err,
  _success,
  paramErr,
  syncUpdateData,
  createPagingData,
  isValidDate,
  writelog,
  concurrencyTasks,
  validate,
} from '../../utils/utils.js';

import {
  helloHelperMsg,
  sendNotificationsToCustomAddresses,
} from '../chat/chat.js';

import { fieldLength } from '../config.js';
import { computerDay } from './count.js';
import nanoid from '../../utils/nanoid.js';
import appConfig from '../../data/config.js';
import V from '../../utils/validRules.js';

const route = express.Router();

// 验证登录态
route.use((req, res, next) => {
  if (req._hello.userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 定时通知是否有未完成代办事项和倒计时到期
let countNum = 0;
timedTask.add(async () => {
  countNum++;
  if (countNum >= 5 * 60 * 60) {
    countNum = 0;

    const obj = {};

    // 倒计时剩下两天时通知
    const t = Date.now() + 2 * 1000 * 60 * 60 * 24;
    let lastSerial = 0;

    while (true) {
      const list = await db('count_down')
        .select('account')
        .where({ state: 1, end: { '<': t }, serial: { '>': lastSerial } })
        .orderBy('serial', 'asc')
        .limit(800)
        .find();

      if (list.length === 0) break;

      lastSerial = list[list.length - 1].serial;

      list.forEach((item) => {
        const { account } = item;

        if (obj.hasOwnProperty(account)) {
          obj[account].count_down++;
        } else {
          obj[account] = {
            count_down: 1,
            todo: 0,
          };
        }
      });
    }

    lastSerial = 0;

    while (true) {
      const list = await db('todo')
        .select('account')
        .where({ state: 1, serial: { '>': lastSerial } })
        .orderBy('serial', 'asc')
        .limit(800)
        .find();

      if (list.length === 0) break;

      lastSerial = list[list.length - 1].serial;

      list.forEach((item) => {
        const { account } = item;

        if (obj.hasOwnProperty(account)) {
          obj[account].todo++;
        } else {
          obj[account] = {
            count_down: 0,
            todo: 1,
          };
        }
      });
    }

    const keys = Object.keys(obj);

    await concurrencyTasks(keys, 5, async (key) => {
      const { count_down, todo } = obj[key];

      let text = '';

      if (count_down > 0 && todo > 0) {
        text = `您有 ${count_down} 条已到期或即将到期的倒计时，和 ${todo} 条未完成事项`;
      } else if (count_down > 0) {
        text = `您有 ${count_down} 条已到期或即将到期的倒计时`;
      } else if (todo > 0) {
        text = `您有 ${todo} 条未完成事项`;
      }

      const msg = await helloHelperMsg(key, text);

      sendNotificationsToCustomAddresses(
        {
          _hello: {
            userinfo: {
              username: appConfig.notifyAccount,
              account: appConfig.notifyAccount,
            },
          },
        },
        msg
      ).catch((err) => {
        writelog(false, `发送通知到自定义地址失败(${err})`, 'error');
      });
    });

    writelog(false, `通知倒计时和代办事项成功`, 'user');
  }
});

// 倒计时列表
route.get(
  '/list',
  validate(
    'query',
    V.object({
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(40)
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { pageNo, pageSize } = req._vdata;

      const { account } = req._hello.userinfo;

      const total = await db('count_down').where({ account }).count();

      const result = createPagingData(Array(total), pageSize, pageNo);

      const offset = (result.pageNo - 1) * pageSize;

      let list = [],
        expireCount = 0;

      if (total > 0) {
        // 剩下不到两天的数量
        expireCount = await db('count_down')
          .where({
            account,
            state: 1,
            end: { '<': Date.now() + 2 * 1000 * 60 * 60 * 24 },
          })
          .count();

        list = (
          await db('count_down')
            .select('id,title,link,start,end,state,top')
            .where({ account })
            .orderBy('top', 'desc')
            .orderBy('end', 'asc')
            .page(pageSize, offset)
            .find()
        ).map((item) => {
          const { start, end } = item;
          return {
            ...item,
            ...computerDay(start, end),
          };
        });
      }

      _success(res, 'ok', {
        ...result,
        data: list,
        expireCount,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 增加
route.post(
  '/add',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      start: V.string().trim().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      end: V.string().trim().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      link: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.url)
        .httpUrl(),
    })
  ),
  async (req, res) => {
    try {
      let { title, start, end, link } = req._vdata;

      start = new Date(start + ' 00:00:00').getTime();
      end = new Date(end + ' 00:00:00').getTime();

      if (start >= end) {
        paramErr(res, req);
        return;
      }

      const { account } = req._hello.userinfo;

      await db('count_down').insert({
        id: nanoid(),
        create_at: Date.now(),
        account,
        title,
        start,
        end,
        link,
      });

      syncUpdateData(req, 'countlist');

      _success(res, `添加倒计时成功`)(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除
route.post(
  '/delete',
  validate(
    'body',
    V.object({
      ids: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .min(1)
        .max(fieldLength.maxPagesize),
    })
  ),
  async (req, res) => {
    try {
      const { ids } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('count_down')
        .where({ id: { in: ids }, account })
        .delete();

      syncUpdateData(req, 'countlist');

      _success(res, `删除倒计时成功`)(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑
route.post(
  '/edit',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      start: V.string().trim().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      end: V.string().trim().custom(isValidDate, '必须 YYYY-MM-DD 格式'),
      link: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.url)
        .httpUrl(),
    })
  ),
  async (req, res) => {
    try {
      let { id, title, start, end, link } = req._vdata;

      start = new Date(start + ' 00:00:00').getTime();
      end = new Date(end + ' 00:00:00').getTime();

      if (start >= end) {
        paramErr(res, req);
        return;
      }

      const { account } = req._hello.userinfo;

      await db('count_down').where({ id, account }).update({
        title,
        start,
        end,
        link,
      });

      syncUpdateData(req, 'countlist');

      _success(res, '更新倒计时成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 置顶权重
route.post(
  '/top',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      top: V.number().toInt().min(0).max(fieldLength.top),
    })
  ),
  async (req, res) => {
    try {
      let { id, top } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('count_down').where({ id, account }).update({ top });

      syncUpdateData(req, 'countlist');

      _success(res, '修改倒计时权重成功')(req, `${id}-${top}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 状态
route.post(
  '/state',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      state: V.number().toInt().enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const { id, state } = req._vdata;

      const { account } = req._hello.userinfo;

      await db('count_down').where({ id, account }).update({ state });

      syncUpdateData(req, 'countlist');

      _success(res, '修改倒计时状态成功')(req, `${id}-${state}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

export default route;
