import express from 'express';
import {
  _err,
  _nologin,
  _success,
  createPagingData,
  getSplitWord,
  syncUpdateData,
  validate,
} from '../../utils/utils.js';
import { fieldLength } from '../config.js';
import V from '../../utils/validRules.js';
import { sym } from '../../utils/symbols.js';
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

const route = express.Router();
const kHello = sym('hello');
const kValidate = sym('validate');

// 验证登录态
route.use((req, res, next) => {
  if (req[kHello].userinfo.account) {
    next();
  } else {
    _nologin(res);
  }
});

// 搜索ssh
route.post(
  '/search',
  validate(
    'body',
    V.object({
      word: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.searchWord),
      pageNo: V.number().toInt().default(1).min(1),
      pageSize: V.number()
        .toInt()
        .default(20)
        .min(1)
        .max(fieldLength.maxPagesize),
      category: V.array(
        V.string().trim().min(1).max(fieldLength.id).alphanumeric()
      )
        .default([])
        .max(10),
    })
  ),
  async (req, res) => {
    try {
      const { word, category, pageNo, pageSize } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const sshdb = db('ssh').where({ account, state: 1 });

      if (category.length > 0) {
        sshdb.search(
          category,
          category.map(() => 'category')
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
            'id,title,port,host,username,category,top,auth_type,passphrase,password,private_key'
          )
          .page(pageSize, offset)
          .find();

        const sshCategory = await db('ssh_category')
          .select('id,title')
          .where({ account })
          .find();

        list = list.map((item) => {
          const cArr = item.category.split('-').filter(Boolean);
          const categoryArr = sshCategory.filter((item) =>
            cArr.includes(item.id)
          );

          return {
            ...item,
            categoryArr,
          };
        });
      }

      _success(res, 'ok', {
        ...result,
        data: list,
        splitWord,
      });
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取分类
route.get('/category', async (req, res) => {
  try {
    const { account } = req[kHello].userinfo;

    const list = await db('ssh_category')
      .select('id,title')
      .where({ account })
      .orderBy('serial', 'DESC')
      .find();

    _success(res, 'ok', list);
  } catch (error) {
    _err(res)(req, error);
  }
});

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
      const { ids } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('ssh')
        .where({ id: { in: ids }, account, state: 1 })
        .update({ state: 0 });

      syncUpdateData(req, 'ssh');
      syncUpdateData(req, 'trash');

      _success(res, '删除SSH配置成功')(req, ids.length, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
      password: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.filename),
      passphrase: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.filename),
      host: V.string().trim().min(1).max(fieldLength.filename),
      private_key: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `ssh key不能超过: ${fieldLength.customCodeSize} 字节`
        ),
      auth_type: V.string().trim().enum(['password', 'key']),
    })
  ),
  async (req, res) => {
    try {
      const config = req[kValidate];
      const { account } = req[kHello].userinfo;
      const now = Date.now();

      await db('ssh').insert({
        ...config,
        id: nanoid(),
        account,
        create_at: now,
        update_at: now,
      });
      syncUpdateData(req, 'ssh');

      _success(res, '添加SSH配置成功')(req, config.title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
      password: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.filename),
      passphrase: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .max(fieldLength.filename),
      host: V.string().trim().min(1).max(fieldLength.filename),
      private_key: V.string()
        .trim()
        .default('')
        .allowEmpty()
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `ssh key不能超过: ${fieldLength.customCodeSize} 字节`
        ),
      auth_type: V.string().trim().enum(['password', 'key']),
    })
  ),
  async (req, res) => {
    try {
      const {
        id,
        port,
        username,
        title,
        password,
        host,
        private_key,
        passphrase,
        auth_type,
      } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const now = Date.now();

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
      syncUpdateData(req, 'ssh');

      _success(res, '更新SSH配置成功')(req, title, 1);
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
      const { id, top } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('ssh').where({ id, account }).update({ top });

      syncUpdateData(req, 'ssh');

      _success(res, '设置ssh权重成功')(req, `${id}-${top}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑分类
route.post(
  '/set-category',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      category: V.array(
        V.string().trim().min(1).max(fieldLength.id).alphanumeric()
      )
        .default([])
        .max(10),
    })
  ),
  async (req, res) => {
    try {
      const { id, category } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const categoryStr = category.join('-');
      await db('ssh').where({ id, account }).update({ category: categoryStr });

      syncUpdateData(req, 'ssh');

      _success(res, '更新分类成功')(req, `${id}: ${categoryStr}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑分类
route.post(
  '/edit-category',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { title, id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('ssh_category').where({ id, account }).update({ title });

      syncUpdateData(req, 'sshCategory');

      _success(res, '编辑分类标题成功')(req, `${title}-${id}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 添加分类
route.post(
  '/add-category',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
    })
  ),
  async (req, res) => {
    try {
      const { title } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const total = await db('ssh_category').count();

      if (total >= fieldLength.maxNoteCategory) {
        _err(res, `类型限制${fieldLength.maxNoteCategory}`)(req);
        return;
      }
      await db('ssh_category').insert({
        id: nanoid(),
        create_at: Date.now(),
        title,
        account,
      });

      syncUpdateData(req, 'sshCategory');

      _success(res, '添加分类成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除分类
route.get(
  '/delete-category',
  validate(
    'query',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      await db('ssh_category').where({ id, account }).delete();

      syncUpdateData(req, 'sshCategory');

      _success(res, '删除分类成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 连接ssh
route.post(
  '/connect',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];

      const { account } = req[kHello].userinfo;

      const config = await db('ssh')
        .select(
          'title,port,username,password,host,private_key,passphrase,auth_type'
        )
        .where({ id, account })
        .findOne();

      if (!config) {
        _err(res, '获取配置信息失败')(req, id, 1);
        return;
      }

      createTerminal(account, req[kHello].temid, config);
      _success(res, '请求连接SSH成功', {
        title: config.title,
        username: config.username,
        host: config.host,
        port: config.port,
      })(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 获取快捷命令
route.get('/quick-list', async (req, res) => {
  try {
    const { account } = req[kHello].userinfo;
    _success(res, 'ok', await readQuickCommands(account));
  } catch (error) {
    _err(res)(req, error);
  }
});

// 添加快捷命令
route.post(
  '/add-quick',
  validate(
    'body',
    V.object({
      id: V.string()
        .trim()
        .default('default')
        .min(1)
        .max(fieldLength.id)
        .alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      command: V.string()
        .notEmpty()
        .min(1)
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `command 不能超过: ${fieldLength.customCodeSize} 字节`
        ),
      enter: V.number().toInt().default(0).enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const { command, id, title, enter } = req[kValidate];
      const { account } = req[kHello].userinfo;
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
      syncUpdateData(req, 'quickCommand');
      _success(res, '添加快捷命令成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑快捷命令
route.post(
  '/edit-quick',
  validate(
    'body',
    V.object({
      groupId: V.string()
        .trim()
        .default('default')
        .min(1)
        .max(fieldLength.id)
        .alphanumeric(),
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
      command: V.string()
        .notEmpty()
        .min(1)
        .custom(
          (v) => _f.getTextSize(v) <= fieldLength.customCodeSize,
          `command 不能超过: ${fieldLength.customCodeSize} 字节`
        ),
      enter: V.number().toInt().default(0).enum([0, 1]),
    })
  ),
  async (req, res) => {
    try {
      const { command, enter, groupId, id, title } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const quickGroupList = await readQuickCommands(account);
      const quickGroup = quickGroupList.find((item) => item.id === groupId);

      if (quickGroup) {
        const quick = quickGroup.commands.find((item) => item.id === id);
        if (quick) {
          quick.title = title;
          quick.command = command;
          quick.enter = enter;
          await writeQuickCommands(account, quickGroupList);
          syncUpdateData(req, 'quickCommand');
        }
      }

      _success(res, '修改快捷命令成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除快捷命令
route.post(
  '/delete-quick',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      groupId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { id, groupId } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const quickGroupList = await readQuickCommands(account);
      const quick = quickGroupList.find((item) => item.id === groupId);
      if (quick) {
        quick.commands = quick.commands.filter((item) => item.id !== id);
        await writeQuickCommands(account, quickGroupList);
        syncUpdateData(req, 'quickCommand');
      }
      _success(res, '删除快捷命令成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { fromId, toId, groupId } = req[kValidate];
      const { account } = req[kHello].userinfo;
      await quickMoveLocation(account, groupId, fromId, toId);
      syncUpdateData(req, 'quickCommand');
      _success(res, '移动快捷命令位置成功')(
        req,
        `${groupId}: ${fromId} => ${toId}`,
        1
      );
    } catch (error) {
      _err(res)(req, error);
    }
  }
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
    })
  ),
  async (req, res) => {
    try {
      const { fromId, toId, id } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const quickGroupList = await readQuickCommands(account);
      const fIdx = quickGroupList.findIndex((item) => item.id === fromId);
      const tIdx = quickGroupList.findIndex((item) => item.id === toId);
      if (fIdx >= 0 && tIdx >= 0 && fIdx !== tIdx) {
        const fCommand = quickGroupList[fIdx].commands.find(
          (item) => item.id === id
        );
        if (fCommand) {
          quickGroupList[fIdx].commands = quickGroupList[fIdx].commands.filter(
            (item) => item.id !== id
          );
          quickGroupList[tIdx].commands.push(fCommand);
          await writeQuickCommands(account, quickGroupList);
          syncUpdateData(req, 'quickCommand');
        }
      }

      _success(res, '移动到分组成功')(req, `${fromId}:${id} => ${toId}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 添加快捷命令分组
route.post(
  '/add-quick-group',
  validate(
    'body',
    V.object({
      title: V.string().trim().min(1).max(fieldLength.title),
    })
  ),
  async (req, res) => {
    try {
      const { title } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const quickGroupList = await readQuickCommands(account);

      quickGroupList.push({ id: nanoid(), title, commands: [] });

      await writeQuickCommands(account, quickGroupList);
      syncUpdateData(req, 'quickCommand');
      _success(res, '添加快捷命令分组成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 编辑快捷命令分组
route.post(
  '/edit-quick-group',
  validate(
    'body',
    V.object({
      id: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      title: V.string().trim().min(1).max(fieldLength.title),
    })
  ),
  async (req, res) => {
    try {
      const { title, id } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const quickGroupList = await readQuickCommands(account);

      const quickGroup = quickGroupList.find((item) => item.id === id);
      if (quickGroup) {
        quickGroup.title = title;
        await writeQuickCommands(account, quickGroupList);
        syncUpdateData(req, 'quickCommand');
      }

      _success(res, '更新快捷命令分组成功')(req, title, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 移动快捷命令分组位置
route.post(
  '/move-quick-group',
  validate(
    'body',
    V.object({
      fromId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
      toId: V.string().trim().min(1).max(fieldLength.id).alphanumeric(),
    })
  ),
  async (req, res) => {
    try {
      const { fromId, toId } = req[kValidate];
      const { account } = req[kHello].userinfo;
      await quickGroupMoveLocation(account, fromId, toId);
      syncUpdateData(req, 'quickCommand');
      _success(res, '移动快捷命令分组位置成功')(req, `${fromId} => ${toId}`, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

// 删除快捷命令分组
route.post(
  '/delete-quick-group',
  validate(
    'body',
    V.object({
      id: V.string()
        .trim()
        .min(1)
        .max(fieldLength.id)
        .alphanumeric()
        .not('default'),
    })
  ),
  async (req, res) => {
    try {
      const { id } = req[kValidate];
      const { account } = req[kHello].userinfo;
      const quickGroupList = (await readQuickCommands(account)).filter(
        (item) => item.id !== id
      );
      await writeQuickCommands(account, quickGroupList);

      syncUpdateData(req, 'quickCommand');
      _success(res, '删除快捷命令成功')(req, id, 1);
    } catch (error) {
      _err(res)(req, error);
    }
  }
);

export default route;
