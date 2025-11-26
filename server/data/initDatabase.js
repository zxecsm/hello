import _f from '../utils/f.js';

import { db, runSql } from '../utils/sqlite.js';

import { resolve } from 'path';

import { writelog, getDirname } from '../utils/utils.js';

import { becomeFriends } from '../routes/chat/chat.js';
import nanoid from '../utils/nanoid.js';
import appConfig from './config.js';
import _crypto from '../utils/crypto.js';

const __dirname = getDirname(import.meta);

// 所有表创建的 SQL 语句配置
const createTableSQLs = [
  `
CREATE TABLE IF NOT EXISTS bg (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    hash      TEXT    UNIQUE NOT NULL,
    url       TEXT    NOT NULL,
    type      TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_bg_type ON bg (type, serial);
`,
  `
CREATE TABLE IF NOT EXISTS bmk (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    group_id  TEXT    NOT NULL,
    num       INTEGER NOT NULL,
    account   TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    link      TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) NOT NULL,
    logo      TEXT    NOT NULL DEFAULT (''),
    des       TEXT    NOT NULL DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_bmk_account_state ON bmk (account, state);
`,
  `
CREATE VIEW bmk_bmk_group_view AS
    SELECT g.title AS group_title,
           g.share AS group_share,
           g.state AS group_state,
           b.serial,
           b.create_at,
           b.id,
           b.group_id,
           b.num,
           b.account,
           b.title,
           b.link,
           b.state,
           b.logo,
           b.des
      FROM bmk AS b
           LEFT JOIN
           bmk_group AS g ON b.group_id = g.id;
`,
  `
CREATE TABLE IF NOT EXISTS bmk_group (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    account   TEXT    NOT NULL,
    num       INTEGER NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) NOT NULL,
    share     INTEGER NOT NULL DEFAULT (0)
)
`,
  `
CREATE INDEX idx_bmk_group_account_state ON bmk_group (account, state);
`,
  `
CREATE TABLE IF NOT EXISTS chat (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    type      TEXT    NOT NULL,
    _from     TEXT    NOT NULL,
    _to       TEXT    NOT NULL,
    flag      TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1),
    size      REAL    NOT NULL DEFAULT (0),
    hash      TEXT    NOT NULL DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_chat_flag_create_at ON chat (flag, create_at);
`,
  `
CREATE VIEW chat_user_view AS
    SELECT u.username,
           u.logo,
           u.email,
           c.serial,
           c.create_at,
           c.id,
           c.type,
           c._from,
           c._to,
           c.flag,
           c.content,
           c.size,
           c.hash
      FROM chat AS c
           LEFT JOIN
           user AS u ON c._from = u.account;
`,
  `
CREATE VIEW chat_upload_view AS
    SELECT u.url,
           c.serial,
           c.id,
           c.flag
      FROM chat AS c
           LEFT JOIN
           upload AS u ON c.hash = u.id;
`,
  `
CREATE TABLE IF NOT EXISTS count_down (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    account   TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    start     INTEGER NOT NULL,
    end       INTEGER NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1),
    link      TEXT    NOT NULL DEFAULT (''),
    top       INTEGER NOT NULL DEFAULT (0) 
)
`,
  `
CREATE INDEX idx_count_down_account_state_end ON count_down (account ,state, end);
`,
  `
CREATE INDEX idx_count_down_account_top_end ON count_down (account, top ,end);
`,
  `
CREATE TABLE IF NOT EXISTS friends (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    update_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    account   TEXT    NOT NULL,
    friend    TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) NOT NULL,
    read      INTEGER DEFAULT (1) NOT NULL,
    notify    INTEGER NOT NULL DEFAULT (1),
    des       TEXT    NOT NULL DEFAULT (''),
    msg       TEXT    NOT NULL DEFAULT ('')
);
`,
  `
CREATE INDEX idx_friends_account_friend ON friends (account, friend);
`,
  `
CREATE TABLE IF NOT EXISTS history (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    account   TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) NOT NULL
)
`,
  `
CREATE INDEX idx_history_account_state ON history (account, state);
`,
  `
CREATE TABLE last_play (
    serial            INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at         INTEGER NOT NULL,
    account           TEXT    UNIQUE NOT NULL,
    song_id           TEXT    NOT NULL,
    state             INTEGER NOT NULL DEFAULT (1),
    play_current_time REAL    NOT NULL DEFAULT (0),
    duration          REAL    NOT NULL DEFAULT (0) 
);
`,
  `
CREATE TABLE IF NOT EXISTS note (
    serial      INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at   INTEGER NOT NULL,
    update_at   INTEGER NOT NULL,
    id          TEXT    UNIQUE NOT NULL,
    account     TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    state       INTEGER DEFAULT (1) NOT NULL,
    share       INTEGER DEFAULT (0) NOT NULL,
    content     TEXT    NOT NULL DEFAULT (''),
    visit_count INTEGER NOT NULL DEFAULT (0),
    top         INTEGER NOT NULL DEFAULT (0),
    category    TEXT    NOT NULL DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_note_account_state_share ON note (account, state, share);
`,
  `
CREATE VIEW note_user_view AS
    SELECT u.account,
           u.username,
           u.logo,
           u.email,
           n.serial,
           n.create_at,
           n.update_at,
           n.id,
           n.title,
           n.state,
           n.share,
           n.content,
           n.visit_count,
           n.top,
           n.category
      FROM note AS n
           LEFT JOIN
           user AS u ON n.account = u.account;
`,
  `
CREATE TABLE IF NOT EXISTS note_category (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    account   TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_note_category_account_serial ON note_category (account, serial);
`,
  `
CREATE TABLE IF NOT EXISTS pic (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    hash      TEXT    UNIQUE NOT NULL,
    url       TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1) 
)
`,
  `
CREATE TABLE IF NOT EXISTS playing_list (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    account   TEXT    UNIQUE NOT NULL,
    data      TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1) 
);
`,
  `
CREATE TABLE IF NOT EXISTS share (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    type      TEXT    NOT NULL,
    account   TEXT    NOT NULL,
    data      TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1),
    exp_time  INTEGER NOT NULL DEFAULT (0),
    pass      TEXT    NOT NULL DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_share_account_serial ON share (account, serial);
`,
  `
CREATE VIEW share_user_view AS
    SELECT u.username,
           u.logo,
           u.email,
           s.serial,
           s.id,
           s.type,
           s.account,
           s.data,
           s.title,
           s.exp_time,
           s.pass
      FROM share AS s
           LEFT JOIN
           user AS u ON u.account = s.account;
`,
  `
CREATE TABLE IF NOT EXISTS song_list (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    account   TEXT    UNIQUE NOT NULL,
    data      TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1) 
);
`,
  `
CREATE TABLE IF NOT EXISTS songs (
    serial          INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at       INTEGER NOT NULL,
    id              TEXT    UNIQUE NOT NULL,
    title           TEXT    NOT NULL,
    artist          TEXT    NOT NULL,
    hash            TEXT    UNIQUE NOT NULL,
    state           INTEGER NOT NULL DEFAULT (1),
    duration        REAL    NOT NULL DEFAULT (0),
    collect_count   INTEGER DEFAULT (0) NOT NULL,
    play_count      INTEGER DEFAULT (0) NOT NULL,
    title_pinyin    TEXT    DEFAULT ('') NOT NULL,
    artist_pinyin   TEXT    DEFAULT ('') NOT NULL,
    album           TEXT    NOT NULL DEFAULT (''),
    year            TEXT    NOT NULL DEFAULT (''),
    mv              TEXT    NOT NULL DEFAULT (''),
    url             TEXT    NOT NULL DEFAULT (''),
    pic             TEXT    NOT NULL DEFAULT (''),
    lrc             TEXT    DEFAULT ('') NOT NULL
);
`,
  `
CREATE INDEX idx_songs_mv ON songs (mv);
`,
  `
CREATE INDEX idx_songs_collect_count ON songs (collect_count);
`,
  `
CREATE INDEX idx_songs_play_count ON songs (play_count);
`,
  `
CREATE INDEX idx_songs_title_pinyin ON songs (title_pinyin);
`,
  `
CREATE INDEX idx_songs_artist_pinyin ON songs (artist_pinyin);
`,
  `
CREATE TABLE IF NOT EXISTS todo (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    update_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    account   TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_todo_account_state_update_at ON todo (account, state, update_at);
`,
  `
CREATE INDEX idx_todo_state ON todo (state);
`,
  `
CREATE TABLE IF NOT EXISTS upload (
    serial    INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at INTEGER NOT NULL,
    update_at INTEGER NOT NULL,
    id        TEXT    UNIQUE NOT NULL,
    url       TEXT    NOT NULL,
    state     INTEGER NOT NULL DEFAULT (1)
);
`,
  `
CREATE INDEX idx_upload_update_at ON upload (update_at);
`,
  `
CREATE TABLE IF NOT EXISTS user (
    serial               INTEGER PRIMARY KEY AUTOINCREMENT,
    create_at            INTEGER NOT NULL,
    update_at            INTEGER NOT NULL,
    account              TEXT    UNIQUE NOT NULL,
    username             TEXT    UNIQUE NOT NULL,
    chat_id              TEXT    UNIQUE NOT NULL,
    password             TEXT    NOT NULL DEFAULT (''),
    state                INTEGER DEFAULT (1) NOT NULL,
    bg                   TEXT    NOT NULL DEFAULT (''),
    bgxs                 TEXT    NOT NULL DEFAULT (''),
    daily_change_bg      INTEGER DEFAULT (0) NOT NULL,
    remote_login         INTEGER DEFAULT (1) NOT NULL,
    exp_token_time       INTEGER DEFAULT (0) NOT NULL,
    logo                 TEXT    NOT NULL DEFAULT (''),
    hide                 INTEGER NOT NULL DEFAULT (0),
    verify               TEXT    NOT NULL DEFAULT (''),
    email                TEXT    NOT NULL DEFAULT (''),
    note_history         INTEGER NOT NULL DEFAULT (1),
    file_history         INTEGER NOT NULL DEFAULT (1),
    receive_chat_state   INTEGER NOT NULL DEFAULT (0),
    forward_msg_state    INTEGER NOT NULL DEFAULT (0),
    forward_msg_link     TEXT    NOT NULL DEFAULT ('') 
);
`,
  `
CREATE INDEX idx_user_forward_msg_state_account_state ON user (forward_msg_state, account, state);
`,
  `
CREATE INDEX idx_user_account_update_at ON user (account, update_at);
`,
  `
CREATE INDEX idx_user_email ON user (email);
`,
];

// 创建数据库表
async function createTables() {
  try {
    for (const sql of createTableSQLs) {
      await runSql(sql);
    }
  } catch (error) {
    await writelog(false, `[ createTables ] - ${error}`, 'error');
    throw error;
  }
}

// 插入初始数据
async function insertInitialData() {
  const nowTime = Date.now();
  const initPassword = Math.random().toString(36).slice(2, 12);
  const userData = [
    {
      create_at: nowTime,
      update_at: nowTime,
      account: appConfig.adminAccount,
      username: 'admin',
      chat_id: nanoid(),
      password: await _crypto.hashPassword(_crypto.getStringHash(initPassword)),
    },
    {
      create_at: nowTime,
      update_at: nowTime,
      account: appConfig.notifyAccount,
      username: appConfig.notifyAccount,
      chat_id: nanoid(),
      password: '',
    },
  ];

  const noteData = [
    {
      create_at: nowTime,
      update_at: nowTime,
      id: appConfig.aboutid,
      account: appConfig.adminAccount,
      title: 'About',
      share: 1,
      content: (
        await _f.readFile(resolve(__dirname, './default_about.md'), null, '')
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
  ];

  try {
    await db('user').insertMany(userData);
    await db('note').insertMany(noteData);
    await becomeFriends(appConfig.adminAccount, appConfig.chatRoomAccount);
    await becomeFriends(appConfig.adminAccount, appConfig.notifyAccount);
    // eslint-disable-next-line no-console
    console.log(`\nusername: admin\npassword: ${initPassword}
      `);
  } catch (error) {
    await writelog(false, `[ insertInitialData ] - ${error}`, 'error');
    throw error;
  }
}

// 主函数：执行数据库初始化操作
export default async function initDatabase(noInitData = false) {
  try {
    await db('user').where({ account: appConfig.adminAccount }).findOne();
  } catch {
    try {
      // 如果表不存在则创建表
      await createTables();
      // 插入初始数据
      if (!noInitData) {
        await insertInitialData();
      }
    } catch (error) {
      await _f.del(appConfig.databaseDir());
      throw error;
    }
  }
}
