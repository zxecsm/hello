import express from 'express';
import Busboy from 'busboy';
import { createPagingMeta, getSplitWord, syncUpdateData } from '../../utils/common/utils.js';
import { fieldLength } from '../config.js';
import V from '../../utils/web/validRules.js';
import { createTerminal, getSSH, readSftpDir } from './terminal.js';
import { db } from '../../utils/db/sqlite.js';
import _f from '../../utils/fs/f.js';
import nanoid from '../../utils/common/nanoid.js';
import {
  quickGroupMoveLocation,
  quickMoveLocation,
  quickProfileOutOfLimit,
  readHistoryCommands,
  readQuickCommands,
  writeHistoryCommands,
  writeQuickCommands,
} from './ssh.js';
import _path from '../../utils/common/path.js';
import resp from '../../utils/web/response.js';
import { resolveSafeHost } from '../../utils/net/ssrf.js';
import { asyncHandler, setDownloadHeader, validate } from '../../utils/web/customMiddleware.js';

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

    const total = sshdb.count();

    const result = createPagingMeta(total, pageSize, pageNo);

    let list = [];
    if (total > 0) {
      const offset = (result.pageNo - 1) * pageSize;
      list = await sshdb
        .select(
          'id,title,port,host,username,category,top,auth_type,passphrase,password,private_key',
        )
        .page(pageSize, offset)
        .find();

      const sshCategory = db('ssh_category').select('id,title').where({ account }).find();

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

    const list = db('ssh_category')
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
        .min(0)
        .max(fieldLength.maxPagesize),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { ids } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    if (ids.length > 0) {
      db('ssh')
        .where({ id: { in: ids }, account, state: 1 })
        .update({ state: 0 });
    } else {
      db('ssh').where({ account, state: 1 }).batchUpdate({ state: 0 });
    }

    syncUpdateData(res, 'ssh');
    syncUpdateData(res, 'trash');

    resp.success(res, `${ids.length > 0 ? '删除' : '清空'}SSH配置成功`)();
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
      private_key: V.string().trim().default('').allowEmpty().max(fieldLength.sshKeyLength),
      auth_type: V.string().trim().enum(['password', 'key']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const config = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    const now = Date.now();

    // SSRF 防护：非 root 不允许保存内网/回环/保留地址
    try {
      await resolveSafeHost(config.host, { allowPrivate: !!res.locals.hello.isRoot });
    } catch (error) {
      return resp.forbidden(res, error.message)(error, 1);
    }

    db('ssh').insert({
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
      private_key: V.string().trim().default('').allowEmpty().max(fieldLength.sshKeyLength),
      auth_type: V.string().trim().enum(['password', 'key']),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id, port, username, title, password, host, private_key, passphrase, auth_type } =
      res.locals.ctx;
    if (id === 'local' && !res.locals.hello.isRoot) {
      return resp.forbidden(res, '无权操作')();
    }

    // SSRF 防护：非 root 不允许保存内网/回环/保留地址
    try {
      await resolveSafeHost(host, { allowPrivate: !!res.locals.hello.isRoot });
    } catch (error) {
      return resp.forbidden(res, error.message)(error, 1);
    }

    const { account } = res.locals.hello.userinfo;
    const now = Date.now();

    if (id === 'local') {
      const ssh = db('ssh').where({ id, account }).findOne();
      if (!ssh) {
        db('ssh').insert({
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
    db('ssh').where({ id, account }).update({
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
    const ssh = db('ssh')
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

    db('ssh').where({ id, account }).update({ top });

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
    db('ssh').where({ id, account }).update({ category: categoryStr });

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

    db('ssh_category').where({ id, account }).update({ title });

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

    const total = db('ssh_category').count();

    if (total >= fieldLength.maxNoteCategory) {
      return resp.forbidden(res, `类型限制${fieldLength.maxNoteCategory}个`)();
    }
    db('ssh_category').insert({
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
route.post(
  '/delete-category',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { id } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;

    db('ssh_category').where({ id, account }).delete();

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

    const config = db('ssh')
      .select('title,port,username,password,host,private_key,passphrase,auth_type')
      .where({ id, account })
      .findOne();

    if (!config) {
      return resp.forbidden(res, '获取配置信息失败')();
    }

    // SSRF 防护：非 root 禁止连接内网/回环/保留地址；root 可跳过
    let connectConfig = config;

    try {
      const host = await resolveSafeHost(config.host, {
        allowPrivate: !!res.locals.hello.isRoot,
      });
      connectConfig = { ...config, host };
    } catch (error) {
      return resp.forbidden(res, error.message)(error, 1);
    }

    createTerminal(
      account,
      temid,
      connectConfig,
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
      command: V.string().notEmpty().min(1).max(fieldLength.sshQuickLength),
      enter: V.number().toInt().default(0).enum([0, 1]),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { command, id, title, enter } = res.locals.ctx;
    const { account } = res.locals.hello.userinfo;
    if (await quickProfileOutOfLimit(account)) return resp.forbidden(res, '配置文件超出限制')();
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
      command: V.string().notEmpty().min(1).max(fieldLength.sshQuickLength),
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
    if (await quickProfileOutOfLimit(account)) return resp.forbidden(res, '配置文件超出限制')();
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

// 获取sftp列表
route.get(
  '/sftp-list',
  validate(
    'query',
    V.object({
      path: V.string().min(1).notEmpty().max(fieldLength.url),
    }),
  ),
  asyncHandler(async (_, res) => {
    let temid = res.locals.hello.temid;
    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    const ssh = getSSH(temid);
    if (!ssh || !ssh.sftp) return resp.forbidden(res, '已断开SSH连接')();

    const { path } = res.locals.ctx;
    const p = _path.normalizeNoSlash('/', path);

    const list = await readSftpDir(ssh.sftp, p);

    resp.success(res, 'ok', list)();
  }),
);

// 上传sftp
route.post(
  '/sftp-up',
  validate(
    'query',
    V.object({
      path: V.string().min(1).notEmpty().max(fieldLength.url),
      name: V.string()
        .trim()
        .preprocess((v) => (typeof v === 'string' ? _path.sanitizeFilename(v) : v))
        .min(1)
        .max(fieldLength.filename),
    }),
  ),
  asyncHandler(async (req, res) => {
    let temid = res.locals.hello.temid;
    try {
      temid = await V.parse(temid, V.string().trim().min(1), 'temid');
    } catch (error) {
      return resp.badRequest(res)(error, 1);
    }

    const ssh = getSSH(temid);
    if (!ssh || !ssh.sftp) return resp.forbidden(res, '已断开SSH连接')();

    const { path, name } = res.locals.ctx;
    const p = _path.normalizeNoSlash('/', path, name);

    // 边收边写远端：请求体经 busboy 直接 pipeline 到 sftp 写流，
    // 不落本地临时文件，也不等整个请求体接收完再开始上传
    const jobs = [];
    const remoteStreams = [];
    let started = false;

    try {
      await new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });

        busboy.on('file', (_, fileStream) => {
          // 只处理第一个文件，多余的直接丢弃
          if (remoteStreams.length) return fileStream.resume();

          started = true;
          const remoteStream = ssh.sftp.createWriteStream(p);
          remoteStreams.push(remoteStream);
          jobs.push(_f.streamp.pipeline(fileStream, remoteStream));
        });

        // close：所有内容解析完，且 file stream 已被消费完
        busboy.on('close', resolve);
        busboy.on('error', reject);
        // 客户端中途断开
        req.on('close', () => {
          if (!req.complete) reject(new Error('客户端已取消上传'));
        });

        // 将请求体接入 busboy
        req.pipe(busboy);
      });

      // 等远端写流真正写完（sftp 侧 flush/close）
      await Promise.all(jobs);
    } catch (error) {
      // 中止远端写入，等 pipeline 收尾后再清理写了一半的文件
      remoteStreams.forEach((s) => s.destroy());
      await Promise.allSettled(jobs);
      if (started) {
        await new Promise((resolve) => ssh.sftp.unlink(p, () => resolve()));
      }
      throw error;
    }

    if (!started) return resp.badRequest(res, '未接收到文件')();

    resp.success(res, '上传文件成功')();
  }),
);

// 下载sftp
route.get(
  '/sftp-down',
  validate(
    'query',
    V.object({
      path: V.string().min(1).notEmpty().max(fieldLength.url),
      id: V.string().trim().min(1),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { path, id } = res.locals.ctx;
    const ssh = getSSH(res.locals.hello.userinfo.account + id);
    if (!ssh || !ssh.sftp) return resp.forbidden(res, '已断开SSH连接')();

    const p = _path.normalizeNoSlash('/', path);

    const remoteReadableStream = ssh.sftp.createReadStream(p);

    setDownloadHeader(res, _path.basename(path)[0]);

    await _f.streamp.pipeline(remoteReadableStream, res);
  }),
);

// 获取历史命令
route.get(
  '/history-commands',
  asyncHandler(async (_, res) => {
    const { account } = res.locals.hello.userinfo;
    resp.success(res, 'ok', await readHistoryCommands(account))();
  }),
);

// 保存历史命令
route.post(
  '/history-commands',
  validate(
    'body',
    V.object({
      command: V.string().trim().min(1).max(fieldLength.sshQuickLength),
    }),
  ),
  asyncHandler(async (_, res) => {
    const { command } = res.locals.ctx;

    const { account } = res.locals.hello.userinfo;
    let list = (await readHistoryCommands(account)).filter((item) => item !== command);

    list.push(command);

    if (list.length > fieldLength.sshHistoryCommandsLength) {
      list = list.slice(-fieldLength.sshHistoryCommandsLength);
    }

    await writeHistoryCommands(account, list);

    syncUpdateData(res, 'historyCommands');

    resp.success(res, `保存历史命令成功`)();
  }),
);

export default route;
