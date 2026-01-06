import _f from '../utils/f.js';

import { allSql, db, runSql } from '../utils/sqlite.js';

import { resolve } from 'path';

import { writelog, getDirname, devLog } from '../utils/utils.js';

import { becomeFriends } from '../routes/chat/chat.js';
import nanoid from '../utils/nanoid.js';
import appConfig from './config.js';
import _crypto from '../utils/crypto.js';

const __dirname = getDirname(import.meta);

const dbSchema = {
  tables: {
    bg: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'hash', type: 'TEXT', unique: true, notNull: true },
        { name: 'url', type: 'TEXT', notNull: true },
        { name: 'type', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [
        { name: 'idx_bg_type', columns: ['type', 'serial'], unique: false },
      ],
    },
    bmk: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'group_id', type: 'TEXT', notNull: true },
        { name: 'num', type: 'INTEGER', notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'link', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'logo', type: 'TEXT', notNull: true, default: '' },
        { name: 'des', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        {
          name: 'idx_bmk_account_state',
          columns: ['account', 'state'],
          unique: false,
        },
      ],
    },
    bmk_group: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'num', type: 'INTEGER', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'share', type: 'INTEGER', notNull: true, default: 0 },
      ],
      indexes: [
        {
          name: 'idx_bmk_group_account_state',
          columns: ['account', 'state'],
          unique: false,
        },
      ],
    },
    chat: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'type', type: 'TEXT', notNull: true },
        { name: '_from', type: 'TEXT', notNull: true },
        { name: '_to', type: 'TEXT', notNull: true },
        { name: 'flag', type: 'TEXT', notNull: true },
        { name: 'content', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'size', type: 'REAL', notNull: true, default: 0 },
        { name: 'hash', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        {
          name: 'idx_chat_flag_create_at',
          columns: ['flag', 'create_at'],
          unique: false,
        },
      ],
    },
    count_down: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'start', type: 'INTEGER', notNull: true },
        { name: 'end', type: 'INTEGER', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'link', type: 'TEXT', notNull: true, default: '' },
        { name: 'top', type: 'INTEGER', notNull: true, default: 0 },
      ],
      indexes: [
        {
          name: 'idx_count_down_account_state_end',
          columns: ['account', 'state', 'end'],
          unique: false,
        },
        {
          name: 'idx_count_down_account_top_end',
          columns: ['account', 'top', 'end'],
          unique: false,
        },
      ],
    },
    friends: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'update_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'friend', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'read', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'notify', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'des', type: 'TEXT', notNull: true, default: '' },
        { name: 'msg', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        {
          name: 'idx_friends_account_friend',
          columns: ['account', 'friend'],
          unique: false,
        },
      ],
    },
    history: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'content', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [
        {
          name: 'idx_history_account_state',
          columns: ['account', 'state'],
          unique: false,
        },
      ],
    },
    last_play: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'account', type: 'TEXT', unique: true, notNull: true },
        { name: 'song_id', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'play_current_time', type: 'REAL', notNull: true, default: 0 },
        { name: 'duration', type: 'REAL', notNull: true, default: 0 },
      ],
      indexes: [],
    },
    note: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'update_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'share', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'content', type: 'TEXT', notNull: true, default: '' },
        { name: 'visit_count', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'top', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'category', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        {
          name: 'idx_note_account_state_share',
          columns: ['account', 'state', 'share'],
          unique: false,
        },
      ],
    },
    note_category: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [
        {
          name: 'idx_note_category_account_serial',
          columns: ['account', 'serial'],
          unique: false,
        },
      ],
    },
    pic: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'hash', type: 'TEXT', unique: true, notNull: true },
        { name: 'url', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [],
    },
    playing_list: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'account', type: 'TEXT', unique: true, notNull: true },
        { name: 'data', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [],
    },
    share: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'type', type: 'TEXT', notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'data', type: 'TEXT', notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'exp_time', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'pass', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        {
          name: 'idx_share_account_serial',
          columns: ['account', 'serial'],
          unique: false,
        },
      ],
    },
    song_list: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'account', type: 'TEXT', unique: true, notNull: true },
        { name: 'data', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [],
    },
    songs: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'title', type: 'TEXT', notNull: true },
        { name: 'artist', type: 'TEXT', notNull: true },
        { name: 'hash', type: 'TEXT', unique: true, notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'duration', type: 'REAL', notNull: true, default: 0 },
        { name: 'collect_count', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'play_count', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'title_pinyin', type: 'TEXT', notNull: true, default: '' },
        { name: 'artist_pinyin', type: 'TEXT', notNull: true, default: '' },
        { name: 'album', type: 'TEXT', notNull: true, default: '' },
        { name: 'year', type: 'TEXT', notNull: true, default: '' },
        { name: 'mv', type: 'TEXT', notNull: true, default: '' },
        { name: 'url', type: 'TEXT', notNull: true, default: '' },
        { name: 'pic', type: 'TEXT', notNull: true, default: '' },
        { name: 'lrc', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        { name: 'idx_songs_mv', columns: ['mv'], unique: false },
        {
          name: 'idx_songs_collect_count',
          columns: ['collect_count'],
          unique: false,
        },
        {
          name: 'idx_songs_play_count',
          columns: ['play_count'],
          unique: false,
        },
        {
          name: 'idx_songs_title_pinyin',
          columns: ['title_pinyin'],
          unique: false,
        },
        {
          name: 'idx_songs_artist_pinyin',
          columns: ['artist_pinyin'],
          unique: false,
        },
      ],
    },
    todo: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'update_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'account', type: 'TEXT', notNull: true },
        { name: 'content', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [
        {
          name: 'idx_todo_account_state_update_at',
          columns: ['account', 'state', 'update_at'],
          unique: false,
        },
        { name: 'idx_todo_state', columns: ['state'], unique: false },
      ],
    },
    upload: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'update_at', type: 'INTEGER', notNull: true },
        { name: 'id', type: 'TEXT', unique: true, notNull: true },
        { name: 'url', type: 'TEXT', notNull: true },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
      ],
      indexes: [
        { name: 'idx_upload_update_at', columns: ['update_at'], unique: false },
      ],
    },
    user: {
      columns: [
        { name: 'serial', type: 'INTEGER', primary: true, autoincrement: true },
        { name: 'create_at', type: 'INTEGER', notNull: true },
        { name: 'update_at', type: 'INTEGER', notNull: true },
        { name: 'account', type: 'TEXT', unique: true, notNull: true },
        { name: 'username', type: 'TEXT', unique: true, notNull: true },
        { name: 'chat_id', type: 'TEXT', unique: true, notNull: true },
        { name: 'password', type: 'TEXT', notNull: true, default: '' },
        { name: 'state', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'bg', type: 'TEXT', notNull: true, default: '' },
        { name: 'bgxs', type: 'TEXT', notNull: true, default: '' },
        { name: 'daily_change_bg', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'remote_login', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'exp_token_time', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'logo', type: 'TEXT', notNull: true, default: '' },
        { name: 'hide', type: 'INTEGER', notNull: true, default: 0 },
        { name: 'verify', type: 'TEXT', notNull: true, default: '' },
        { name: 'email', type: 'TEXT', notNull: true, default: '' },
        { name: 'note_history', type: 'INTEGER', notNull: true, default: 1 },
        { name: 'file_history', type: 'INTEGER', notNull: true, default: 1 },
        {
          name: 'receive_chat_state',
          type: 'INTEGER',
          notNull: true,
          default: 0,
        },
        {
          name: 'forward_msg_state',
          type: 'INTEGER',
          notNull: true,
          default: 0,
        },
        { name: 'forward_msg_link', type: 'TEXT', notNull: true, default: '' },
      ],
      indexes: [
        {
          name: 'idx_user_forward_msg_state_account_state',
          columns: ['forward_msg_state', 'account', 'state'],
          unique: false,
        },
        {
          name: 'idx_user_account_update_at',
          columns: ['account', 'update_at'],
          unique: false,
        },
        { name: 'idx_user_email', columns: ['email'], unique: false },
      ],
    },
  },
};

// === 工具函数 ===
function normalizeDefault(val) {
  if (val === null || val === undefined) return null;
  return String(val)
    .replace(/^\(|\)$/g, '')
    .replace(/^'|'$/g, '');
}

// 根据 JSON 配置对比现有表字段
function diffColumns(existingColumns, configColumns, tableSql) {
  const existingMap = Object.fromEntries(
    existingColumns.map((c) => [c.name, c])
  );
  const configMap = Object.fromEntries(configColumns.map((c) => [c.name, c]));

  const toAdd = [];
  const toChange = []; // 类型、默认值、NOT NULL、PK/AUTOINCREMENT 不同
  const toRemove = [];

  // 新增或修改
  for (const col of configColumns) {
    const exist = existingMap[col.name];
    const defaultVal = col.default !== undefined ? String(col.default) : null;
    if (!exist) {
      toAdd.push(col); // 新增字段
    } else {
      const existDefault = normalizeDefault(exist.dflt_value);

      const typeDiff = exist.type.toUpperCase() !== col.type.toUpperCase();
      const notNullDiff = exist.notnull !== (col.notNull ? 1 : 0);
      const defaultDiff = existDefault !== normalizeDefault(defaultVal);
      const pkDiff = exist.pk !== (col.primary ? 1 : 0);

      // AUTOINCREMENT 只能通过解析建表语句判断
      const autoIncDiff = col.autoincrement && !/AUTOINCREMENT/i.test(tableSql); // tableSql 为 sqlite_master.sql

      if (typeDiff || notNullDiff || defaultDiff || pkDiff || autoIncDiff) {
        toChange.push(col);
      }
    }
  }

  // 删除字段
  for (const exist of existingColumns) {
    if (!configMap[exist.name]) {
      toRemove.push(exist);
    }
  }

  return { toAdd, toChange, toRemove };
}

// 根据配置生成 CREATE TABLE 语句
function getTableSql(tableName, columns) {
  const colsSQL = columns.map((col) => {
    const {
      name,
      type,
      primary,
      autoincrement,
      notNull,
      unique,
      default: defaultVal,
    } = col;

    let sql = `"${name}" ${type}`;

    if (primary) sql += ' PRIMARY KEY'; // 主键
    if (autoincrement) sql += ' AUTOINCREMENT'; // 自增
    if (notNull) sql += ' NOT NULL'; // 非空
    if (unique) sql += ' UNIQUE'; // 唯一

    if (defaultVal !== undefined) {
      // 默认值
      const val =
        typeof defaultVal === 'string' ? `'${defaultVal}'` : defaultVal;
      sql += ` DEFAULT ${val}`;
    }

    return sql;
  });

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${colsSQL.join(', ')});`;
}

// 同步索引
async function syncIndexes(tableName, configIndexes) {
  const dbIndexes = await allSql(`PRAGMA index_list('${tableName}')`);
  const dbIndexMap = Object.fromEntries(dbIndexes.map((i) => [i.name, i]));

  for (const idx of configIndexes) {
    const dbIdx = dbIndexMap[idx.name];
    let needCreate = false;

    if (!dbIdx) {
      needCreate = true;
    } else {
      const dbCols = (await allSql(`PRAGMA index_info('${idx.name}')`)).map(
        (c) => c.name
      );
      if (dbCols.join(',') !== idx.columns.join(',')) {
        await runSql(`DROP INDEX IF EXISTS "${idx.name}"`);
        devLog(`索引 ${idx.name} 删除`);
        needCreate = true;
      }
    }

    if (needCreate) {
      const unique = idx.unique ? 'UNIQUE' : '';
      await runSql(
        `CREATE ${unique} INDEX IF NOT EXISTS "${
          idx.name
        }" ON "${tableName}" (${idx.columns.join(',')});`
      );
      devLog(`索引 ${idx.name} 创建成功`);
    }
  }

  // 删除多余索引
  for (const dbIdx of dbIndexes) {
    if (
      !configIndexes.find((i) => i.name === dbIdx.name) &&
      dbIdx.origin === 'c' // c: 手动创建的索引
    ) {
      await runSql(`DROP INDEX IF EXISTS "${dbIdx.name}"`);
      devLog(`索引 ${dbIdx.name} 删除`);
    }
  }
}

// === 主函数：创建/迁移表 ===
async function createTables() {
  try {
    const tableNames = Object.keys(dbSchema.tables);
    for (const tableName of tableNames) {
      const { columns, indexes } = dbSchema.tables[tableName];

      // 查询现有字段
      const existingColumns = await allSql(`PRAGMA table_info(${tableName})`);

      if (existingColumns.length === 0) {
        // 表不存在 → 直接创建
        const createSQL = getTableSql(tableName, columns);
        await runSql(createSQL);
        devLog(`表 ${tableName} 创建成功`);
      } else {
        // 表已存在 → 获取原始建表语句（判断 AUTOINCREMENT）
        const tableSqlRes = await allSql(
          `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`
        );
        const tableSql = tableSqlRes[0]?.sql || '';

        // 对比字段
        const { toAdd, toChange, toRemove } = diffColumns(
          existingColumns,
          columns,
          tableSql
        );

        // 需要修改或删除字段 → 临时表迁移
        if (toRemove.length > 0 || toChange.length > 0) {
          const tmpTable = tableName + '_tmp';
          const createTmpSQL = getTableSql(tmpTable, columns);
          await runSql(createTmpSQL);

          // 保留共同字段，迁移数据
          const commonCols = existingColumns
            .map((c) => c.name)
            .filter(
              (n) => columns.some((col) => col.name === n) && n !== 'serial' // 过滤自增主键
            );
          if (commonCols.length > 0) {
            await runSql(
              `INSERT INTO "${tmpTable}" (${commonCols.join(
                ','
              )}) SELECT ${commonCols.join(',')} FROM "${tableName}";`
            );
          }

          await runSql(`DROP TABLE "${tableName}";`);
          await runSql(`ALTER TABLE "${tmpTable}" RENAME TO "${tableName}";`);
          devLog(`表 ${tableName} 字段迁移完成（修改/删除字段）`);
        } else if (toAdd.length > 0) {
          // 只新增字段 → ALTER TABLE
          for (const col of toAdd) {
            const { name, type, notNull, default: defaultVal } = col;

            let sql = `ALTER TABLE "${tableName}" ADD COLUMN "${name}" ${type}`;

            let finalDefault = defaultVal;

            // 如果字段不允许为空 → 自动兜底一个默认值
            if (notNull && finalDefault === undefined) {
              if (/INT/i.test(type)) finalDefault = 0;
              else if (/CHAR|TEXT|CLOB/i.test(type)) finalDefault = '';
              else if (/REAL|FLOA|DOUB/i.test(type)) finalDefault = 0.0;
              else finalDefault = null; // 兜不住你就会重建表
            }

            if (finalDefault !== undefined && finalDefault !== null) {
              sql += ` DEFAULT ${JSON.stringify(finalDefault)}`;
            }

            if (notNull) sql += ' NOT NULL';

            await runSql(sql);
          }
          devLog(`表 ${tableName} 字段迁移完成（新增字段）`);
        } else {
          devLog(`表 ${tableName} 字段一致，无需迁移`);
        }
      }

      // 同步索引
      await syncIndexes(tableName, indexes);
    }
  } catch (error) {
    await writelog(false, `[ createTables ] - ${error}`, 'error');
    throw error;
  }
}

// 插入初始数据
async function insertInitialData() {
  const nowTime = Date.now();
  let initPassword = '';

  try {
    const userList = await db('user')
      .select('account')
      .where({
        account: { in: [appConfig.adminAccount, appConfig.notifyAccount] },
      })
      .find();
    if (userList.length === 0) {
      initPassword = Math.random().toString(36).slice(2, 12);
      await db('user').insertMany([
        {
          create_at: nowTime,
          update_at: nowTime,
          account: appConfig.adminAccount,
          username: appConfig.adminUsername,
          chat_id: nanoid(),
          password: await _crypto.hashPassword(
            _crypto.getStringHash(initPassword)
          ),
        },
        {
          create_at: nowTime,
          update_at: nowTime,
          account: appConfig.notifyAccount,
          username: appConfig.notifyAccount,
          chat_id: nanoid(),
          password: '',
        },
      ]);
      await becomeFriends(appConfig.adminAccount, appConfig.chatRoomAccount);
      await becomeFriends(appConfig.adminAccount, appConfig.notifyAccount);
    }

    const noteList = await db('note')
      .select('id')
      .where({ id: { in: [appConfig.aboutid, appConfig.tipsid] } })
      .find();
    if (noteList.length === 0) {
      await db('note').insertMany([
        {
          create_at: nowTime,
          update_at: nowTime,
          id: appConfig.aboutid,
          account: appConfig.adminAccount,
          title: 'About',
          share: 1,
          content: (
            await _f.readFile(
              resolve(__dirname, './default_about.md'),
              null,
              ''
            )
          ).toString(),
        },
        {
          create_at: nowTime,
          update_at: nowTime,
          id: appConfig.tipsid,
          account: appConfig.adminAccount,
          title: 'Tips',
          share: 1,
          content: '',
        },
      ]);
    }

    return initPassword;
  } catch (error) {
    await writelog(false, `[ insertInitialData ] - ${error}`, 'error');
    throw error;
  }
}

// 删除视图
async function dropViews() {
  const views = await allSql(
    `SELECT name FROM sqlite_master WHERE type='view'`
  );

  for (const row of views) {
    await runSql(`DROP VIEW IF EXISTS "${row.name}"`);
    devLog(`视图 ${row.name} 删除成功`);
  }
}

// 主函数：执行数据库初始化操作
export default async function initDatabase(noInitData = false) {
  try {
    await dropViews();
    await createTables();
    if (!noInitData) {
      return await insertInitialData();
    }
  } catch (error) {
    throw error;
  }
}
