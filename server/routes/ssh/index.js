import express from 'express';
import { createPagingData, getSplitWord, syncUpdateData } from '../../utils/utils.js';
import { fieldLength } from '../config.js';
import V from '../../utils/validRules.js';
import { createTerminal } from './terminal.js';
import { db } from '../../utils/sqlite.js';
import _f from '../../utils/f.js';
import nanoid from '../../utils/nanoid.js';
import {
  quickGroupMoveLocation,
  quickMoveLocation,
  readQuickCommands,
  writeQuickCommands,
} from './ssh.js';
import _path from '../../utils/path.js';
import resp from '../../utils/response.js';
import { asyncHandler, validate } from '../../utils/customMiddleware.js';

const route = express.Router();

// 验证登录态
route.use(
  asyncHandler((_, res, next) => {
    if (res.locals.hello.userinfo.account) {
      next();
    } else {
      resp.unauthorized(res)();
    }
  }),
);

// 搜索ssh
route.post(
  '/search',
  validate(
    'body',
    V.object({
      word: V.string().trim().default('').allowEmpty().max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number().toInt().default(20).min(1).max(fieldLength.maxPagesize),
      category: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .default([])
        .max(10),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { word, category, pageNo, pageSize } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const sshdb = db('ssh').where({ account, state: 1 });

    if (category.length > 0) {
      sshdb.search(
        category,
        category.map(() => 'category'),
      );
    }

    let splitWord = [];

    if (word) {
      // 搜索
      splitWord = getSplitWord(word);

      const curSplit = splitWord.slice(0, 10);
      curSplit[0] = { value: curSplit[0], weight: 10 };
      sshdb.search(curSplit, ['host', 'username', 'title', 'port'], {
        sort: true,
      });
    } else {
      sshdb.orderBy('top', 'DESC').orderBy('serial', 'DESC');
    }

    const total = await sshdb.count();

    const result = createPagingData(Array(total), pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;
      list = await sshdb
        .select(
          'id,title,port,host,username,category,top,auth_type,passphrase,password,private_key',
        )
        .page(pageSize, offset)
        .find();

      const sshCategory = await db('ssh_category').select('id,title').where({ account }).find();

      list = list.map((item) => {
        const cArr = item.category.split('-').filter(Boolean);
        const categoryArr = sshCategory.filter((item) => cArr.includes(item.id));

        return {
          ...item,
          categoryArr,
        };
      });
    }

    resp.success(res, 'ok', {
      ...result,
      data: list,
      splitWord,
    })();
  }),
);

// 获取分类
route.get(
  '/category',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;

    const list = await db('ssh_category')
      .select('id,title')
      .where({ account })
      .orderBy('serial', 'DESC')
      .find();

    resp.success(res, 'ok', list)();
  }),
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
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('ssh')
      .where({ id: { in: ids }, account, state: 1 })
      .update({ state: 0 });

    syncUpdateData(res, 'ssh');
    syncUpdateData(res, 'trash');

    resp.success(res, '删除SSH配置成功')();
  }),
);

// 添加ssh
route.post(
  '/add',
  validate(
    'body',
    V.object({
      port: V.number().toInt().default(22).min(1).max(65535),
      username: V.string().trim().min(1).max(fieldLength.filename),
      title: V.string().trim().min(1).max(fieldLength.title),
      password: V.string().trim().default('').allowEmpty().max(fieldLength.filename),
      passphrase: V.string().trim().default('').allowEmpty().max(fieldLength.filename),
      host: V.string().trim().min(1).max(fieldLength.filename),
      private_key: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `ssh key不能超过: ${fieldLength.customCodeSize} 字节`,
        ),
      auth_type: V.string().trim().enum(['password', 'key']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const config = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const now = Date.now();

    await db('ssh').insert({
      ...config,
      id: nanoid(),
      account,
      create_at: now,
      update_at: now,
    });
    syncUpdateData(res, 'ssh');

    resp.success(res, '添加SSH配置成功')();
  }),
);

// 编辑ssh
route.post(
  '/edit',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      port: V.number().toInt().default(22).min(1).max(65535),
      username: V.string().trim().min(1).max(fieldLength.filename),
      title: V.string().trim().min(1).max(fieldLength.title),
      password: V.string().trim().default('').allowEmpty().max(fieldLength.filename),
      passphrase: V.string().trim().default('').allowEmpty().max(fieldLength.filename),
      host: V.string().trim().min(1).max(fieldLength.filename),
      private_key: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `ssh key不能超过: ${fieldLength.customCodeSize} 字节`,
        ),
      auth_type: V.string().trim().enum(['password', 'key']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, port, username, title, password, host, private_key, passphrase, auth_type } =
      res.locals.ctx;
    if (id === 'local' && !res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权操作')();
    }

    const { account } = res.locals.hello.userinfo;
    const now = Date.now();

    if (id === 'local') {
      const ssh = await db('ssh').where({ id, account }).findOne();
      if (!ssh) {
        await db('ssh').insert({
          id,
          port,
          username,
          title,
          password,
          host,
          private_key,
          passphrase,
          auth_type,
          create_at: now,
          update_at: now,
          account,
        });
        syncUpdateData(res, 'ssh');
        return resp.success(res, '添加本机SSH配置成功')();
      }
    }
    await db('ssh').where({ id, account }).update({
      port,
      username,
      title,
      password,
      host,
      private_key,
      passphrase,
      auth_type,
      update_at: now,
    });
    syncUpdateData(res, 'ssh');

    resp.success(res, '更新SSH配置成功')();
  }),
);

// 获取ssh配置
route.get(
  '/info',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const ssh = await db('ssh')
      .select('id,title,port,host,username,auth_type,passphrase,password,private_key')
      .where({ id, account })
      .findOne();
    resp.success(res, 'ok', ssh || {})();
  }),
);

// 置顶权重
route.post(
  '/top',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      top: V.number().toInt().min(0).max(fieldLength.top),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, top } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('ssh').where({ id, account }).update({ top });

    syncUpdateData(res, 'ssh');

    resp.success(res, '设置ssh权重成功')();
  }),
);

// 编辑分类
route.post(
  '/set-category',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      category: V.array(V.string().trim().min(1).max(fieldLength.id).alphanumeric())
        .default([])
        .max(10),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, category } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const categoryStr = category.join('-');
    await db('ssh').where({ id, account }).update({ category: categoryStr });

    syncUpdateData(res, 'ssh');

    resp.success(res, '更新分类成功')();
  }),
);

// 编辑分类
route.post(
  '/edit-category',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('ssh_category').where({ id, account }).update({ title });

    syncUpdateData(res, 'sshCategory');

    resp.success(res, '编辑分类标题成功')();
  }),
);

// 添加分类
route.post(
  '/add-category',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    const total = await db('ssh_category').count();

    if (total >= fieldLength.maxNoteCategory) {
      return resp.forbidden(res, `类型限制${fieldLength.maxNoteCategory}`)();
    }
    await db('ssh_category').insert({
      id: nanoid(),
      create_at: Date.now(),
      title,
      account,
    });

    syncUpdateData(res, 'sshCategory');

    resp.success(res, '添加分类成功')();
  }),
);

// 删除分类
route.get(
  '/delete-category',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    await db('ssh_category').where({ id, account }).delete();

    syncUpdateData(res, 'sshCategory');

    resp.success(res, '删除分类成功')();
  }),
);

// 连接ssh
route.post(
  '/connect',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      defaultPath: V.string().trim().allowEmpty().max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, defaultPath } = res.locals.ctx;

    let {
      userinfo: { account },
      temid,
    } = res.locals.hello;

    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    const config = await db('ssh')
      .select('title,port,username,password,host,private_key,passphrase,auth_type')
      .where({ id, account })
      .findOne();

    if (!config) {
      return resp.forbidden(res, '获取配置信息失败')();
    }
    createTerminal(
      account,
      temid,
      config,
      defaultPath ? _path.normalizeNoSlash('/', defaultPath) : '',
    );
    resp.success(res, '请求连接SSH成功', {
      title: config.title,
      username: config.username,
      host: config.host,
      port: config.port,
    })();
  }),
);

// 获取快捷命令
route.get(
  '/quick-list',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;
    resp.success(res, 'ok', await readQuickCommands(account))();
  }),
);

// 添加快捷命令
route.post(
  '/add-quick',
  validate(
    'body',
    V.object({
      id: V.string().trim().default('default').min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      command: V.string()
        .notEmpty()
        .min(1)
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `command 不能超过: ${fieldLength.customCodeSize} 字节`,
        ),
      enter: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { command, id, title, enter } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = await readQuickCommands(account);
    const quickGroup = quickGroupList.find((item) => item.id === id);

    const commandId = nanoid();
    if (quickGroup) {
      quickGroup.commands.push({ id: commandId, enter, title, command });
    } else {
      quickGroupList[0].commands.push({
        id: commandId,
        enter,
        title,
        command,
      });
    }

    await writeQuickCommands(account, quickGroupList);
    syncUpdateData(res, 'quickCommand');
    resp.success(res, '添加快捷命令成功')();
  }),
);

// 编辑快捷命令
route.post(
  '/edit-quick',
  validate(
    'body',
    V.object({
      groupId: V.string().trim().default('default').min(1).max(fieldLength.id).alphanumeric(),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      command: V.string()
        .notEmpty()
        .min(1)
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `command 不能超过: ${fieldLength.customCodeSize} 字节`,
        ),
      enter: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { command, enter, groupId, id, title } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = await readQuickCommands(account);
    const quickGroup = quickGroupList.find((item) => item.id === groupId);

    if (quickGroup) {
      const quick = quickGroup.commands.find((item) => item.id === id);
      if (quick) {
        quick.title = title;
        quick.command = command;
        quick.enter = enter;
        await writeQuickCommands(account, quickGroupList);
        syncUpdateData(res, 'quickCommand');
      }
    }

    resp.success(res, '修改快捷命令成功')();
  }),
);

// 删除快捷命令
route.post(
  '/delete-quick',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, groupId } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = await readQuickCommands(account);
    const quick = quickGroupList.find((item) => item.id === groupId);
    if (quick) {
      quick.commands = quick.commands.filter((item) => item.id !== id);
      await writeQuickCommands(account, quickGroupList);
      syncUpdateData(res, 'quickCommand');
    }
    resp.success(res, '删除快捷命令成功')();
  }),
);

// 移动快捷命令位置
route.post(
  '/move-quick',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { fromId, toId, groupId } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    await quickMoveLocation(account, groupId, fromId, toId);
    syncUpdateData(res, 'quickCommand');
    resp.success(res, '移动快捷命令位置成功')();
  }),
);

// 移动快捷命令到分组
route.post(
  '/move-to-group',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { fromId, toId, id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = await readQuickCommands(account);
    const fIdx = quickGroupList.findIndex((item) => item.id === fromId);
    const tIdx = quickGroupList.findIndex((item) => item.id === toId);
    if (fIdx >= 0 && tIdx >= 0 && fIdx !== tIdx) {
      const fCommand = quickGroupList[fIdx].commands.find((item) => item.id === id);
      if (fCommand) {
        quickGroupList[fIdx].commands = quickGroupList[fIdx].commands.filter(
          (item) => item.id !== id,
        );
        quickGroupList[tIdx].commands.push(fCommand);
        await writeQuickCommands(account, quickGroupList);
        syncUpdateData(res, 'quickCommand');
      }
    }

    resp.success(res, '移动到分组成功')();
  }),
);

// 添加快捷命令分组
route.post(
  '/add-quick-group',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = await readQuickCommands(account);

    quickGroupList.push({ id: nanoid(), title, commands: [] });

    await writeQuickCommands(account, quickGroupList);
    syncUpdateData(res, 'quickCommand');
    resp.success(res, '添加快捷命令分组成功')();
  }),
);

// 编辑快捷命令分组
route.post(
  '/edit-quick-group',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { title, id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = await readQuickCommands(account);

    const quickGroup = quickGroupList.find((item) => item.id === id);
    if (quickGroup) {
      quickGroup.title = title;
      await writeQuickCommands(account, quickGroupList);
      syncUpdateData(res, 'quickCommand');
    }

    resp.success(res, '更新快捷命令分组成功')();
  }),
);

// 移动快捷命令分组位置
route.post(
  '/move-quick-group',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { fromId, toId } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    await quickGroupMoveLocation(account, fromId, toId);
    syncUpdateData(res, 'quickCommand');
    resp.success(res, '移动快捷命令分组位置成功')();
  }),
);

// 删除快捷命令分组
route.post(
  '/delete-quick-group',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric().not('default'),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const quickGroupList = (await readQuickCommands(account)).filter((item) => item.id !== id);
    await writeQuickCommands(account, quickGroupList);

    syncUpdateData(res, 'quickCommand');
    resp.success(res, '删除快捷命令成功')();
  }),
);

export default route;
