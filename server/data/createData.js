import _f from '../utils/f.js';

import {
  queryData,
  runSqlite,
  insertData,
  executeInTransaction,
} from '../utils/sqlite.js';

import { resolve } from 'path';

import { writelog, nanoid, getDirname } from '../utils/utils.js';

import { becomeFriends } from '../routes/chat/chat.js';

const __dirname = getDirname(import.meta);

// 所有表创建的 SQL 语句配置
const createTableSQLs = [
  `
CREATE TABLE IF NOT EXISTS bg (
    create_at INTEGER NOT NULL,
    id        TEXT    PRIMARY KEY
                      UNIQUE
                      NOT NULL,
    hash      TEXT    UNIQUE
                      NOT NULL,
    url       TEXT    NOT NULL,
    type      TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_bg_create_at_type ON bg (
    create_at,
    type
);
`,
  `
CREATE TABLE IF NOT EXISTS bmk (
    create_at INTEGER NOT NULL,
    id        TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    group_id  TEXT    NOT NULL,
    num       INTEGER NOT NULL,
    account   TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    link      TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) 
                      NOT NULL,
    logo      TEXT    NOT NULL
                      DEFAULT (''),
    des       TEXT    NOT NULL
                      DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_bmk_title_link_des_create_at_account_state ON bmk (
    title,
    link,
    des,
    create_at,
    account,
    state
);
`,
  `
CREATE VIEW bmk_bmk_group_view AS
    SELECT g.title AS group_title,
           g.share AS group_share,
           g.state AS group_state,
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
    create_at INTEGER NOT NULL,
    id        TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    account   TEXT    NOT NULL,
    num       INTEGER NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) 
                      NOT NULL,
    share     INTEGER NOT NULL
                      DEFAULT (0)
)
`,
  `
CREATE INDEX idx_bmk_group_title_create_at_account_state ON bmk_group (
    title,
    create_at,
    account,
    state
);
`,
  `
CREATE TABLE IF NOT EXISTS chat (
    create_at INTEGER NOT NULL,
    id        TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    type      TEXT    NOT NULL,
    _from     TEXT    NOT NULL,
    _to       TEXT    NOT NULL,
    flag      TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1),
    size      REAL    NOT NULL
                      DEFAULT (0),
    hash      TEXT    NOT NULL
                      DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_chat_content_create_at_from_to_flag ON chat (
    content,
    create_at,
    _from,
    _to,
    flag
);
`,
  `
CREATE VIEW chat_user_view AS
    SELECT u.username,
           u.logo,
           u.email,
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
           c.id,
           c.flag
      FROM chat AS c
           LEFT JOIN
           upload AS u ON c.hash = u.id;
`,
  `
CREATE TABLE IF NOT EXISTS count_down (
    create_at INTEGER NOT NULL,
    id        TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    account   TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    start     INTEGER NOT NULL,
    end       INTEGER NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1),
    link      TEXT    NOT NULL
                      DEFAULT (''),
    top       INTEGER NOT NULL
                      DEFAULT (0) 
)
`,
  `
CREATE INDEX idx_count_down_end_top_create_at_account_state ON count_down (
    create_at,
    top,
    end,
    account,
    state
);
`,
  `
CREATE TABLE IF NOT EXISTS friends (
    create_at INTEGER NOT NULL,
    update_at INTEGER NOT NULL,
    id        TEXT    PRIMARY KEY
                      UNIQUE
                      NOT NULL,
    account   TEXT    NOT NULL,
    friend    TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) 
                      NOT NULL,
    read      INTEGER DEFAULT (1) 
                      NOT NULL,
    des       TEXT    NOT NULL
                      DEFAULT ('') 
);
`,
  `
CREATE INDEX idx_friends_account_friend_read ON friends (
    account,
    friend,
    read
);
`,
  `
CREATE TABLE IF NOT EXISTS history (
    create_at INTEGER NOT NULL,
    id        TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    account   TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    state     INTEGER DEFAULT (1) 
                      NOT NULL
)
`,
  `
CREATE INDEX idx_history_create_at_content_account_state ON history (
    create_at,
    content,
    account,
    state
);
`,
  `
CREATE TABLE last_play (
    create_at         INTEGER NOT NULL,
    account           TEXT    NOT NULL
                              UNIQUE
                              PRIMARY KEY,
    song_id           TEXT    NOT NULL,
    state             INTEGER NOT NULL
                              DEFAULT (1),
    play_current_time REAL    NOT NULL
                              DEFAULT (0),
    duration          REAL    NOT NULL
                              DEFAULT (0) 
);
`,
  `
CREATE TABLE IF NOT EXISTS note (
    create_at   INTEGER NOT NULL,
    update_at   INTEGER NOT NULL,
    id          TEXT    NOT NULL
                        UNIQUE
                        PRIMARY KEY,
    account     TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    state       INTEGER DEFAULT (1) 
                        NOT NULL,
    share       INTEGER DEFAULT (0) 
                        NOT NULL,
    content     TEXT    NOT NULL
                        DEFAULT (''),
    visit_count INTEGER NOT NULL
                        DEFAULT (0),
    top         INTEGER NOT NULL
                        DEFAULT (0),
    category    TEXT    NOT NULL
                        DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_note_create_at_account_title_top_share_state_content ON note (
    create_at,
    account,
    title,
    top,
    share,
    state,
    content
);
`,
  `
CREATE VIEW note_user_view AS
    SELECT u.account,
           u.username,
           u.logo,
           u.email,
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
    create_at INTEGER NOT NULL,
    id        TEXT    PRIMARY KEY
                      UNIQUE
                      NOT NULL,
    account   TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_note_category_create_at_account ON note_category (
    create_at,
    account
);
`,
  `
CREATE TABLE IF NOT EXISTS pic (
    create_at INTEGER NOT NULL,
    id        TEXT    PRIMARY KEY
                      UNIQUE
                      NOT NULL,
    hash      TEXT    NOT NULL
                      UNIQUE,
    url       TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_pic_create_at ON pic (
    create_at
);
`,
  `
CREATE TABLE IF NOT EXISTS playing_list (
    create_at INTEGER NOT NULL,
    account   TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    data      TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1) 
);
`,
  `
CREATE TABLE IF NOT EXISTS share (
    create_at INTEGER NOT NULL,
    id        TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    type      TEXT    NOT NULL,
    account   TEXT    NOT NULL,
    data      TEXT    NOT NULL,
    title     TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1),
    exp_time  INTEGER NOT NULL
                      DEFAULT (0),
    pass      TEXT    NOT NULL
                      DEFAULT ('') 
)
`,
  `
CREATE INDEX idx_share_create_at_account_type ON share (
    create_at,
    account,
    type
);
`,
  `
CREATE VIEW share_user_view AS
    SELECT u.username,
           u.logo,
           u.email,
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
    create_at INTEGER NOT NULL,
    account   TEXT    NOT NULL
                      UNIQUE
                      PRIMARY KEY,
    data      TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1) 
);
`,
  `
CREATE TABLE IF NOT EXISTS songs (
    create_at     INTEGER NOT NULL,
    id            TEXT    UNIQUE
                          NOT NULL
                          PRIMARY KEY,
    title         TEXT    NOT NULL,
    artist        TEXT    NOT NULL,
    hash          TEXT    NOT NULL
                          UNIQUE,
    state         INTEGER NOT NULL
                          DEFAULT (1),
    duration      REAL    NOT NULL
                          DEFAULT (0),
    collect_count INTEGER DEFAULT (0) 
                          NOT NULL,
    play_count    INTEGER DEFAULT (0) 
                          NOT NULL,
    title_pinyin  TEXT    DEFAULT ('') 
                          NOT NULL,
    artist_pinyin TEXT    DEFAULT ('') 
                          NOT NULL,
    album         TEXT    NOT NULL
                          DEFAULT (''),
    year          TEXT    NOT NULL
                          DEFAULT (''),
    mv            TEXT    NOT NULL
                          DEFAULT (''),
    url           TEXT    NOT NULL
                          DEFAULT (''),
    pic           TEXT    NOT NULL
                          DEFAULT (''),
    lrc           TEXT    DEFAULT ('') 
                          NOT NULL
);
`,
  `
CREATE INDEX idx_songs_create_at_title_artist_collect_count_play_count_title_pinyin_artist_pinyin ON songs (
    create_at,
    title,
    artist,
    collect_count,
    play_count,
    title_pinyin,
    artist_pinyin
);
`,
  `
CREATE TABLE IF NOT EXISTS todo (
    create_at INTEGER NOT NULL,
    update_at INTEGER NOT NULL,
    id        TEXT    PRIMARY KEY
                      UNIQUE
                      NOT NULL,
    account   TEXT    NOT NULL,
    content   TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1) 
)
`,
  `
CREATE INDEX idx_todo_update_at_state_account ON todo (
    update_at,
    state,
    account
);
`,
  `
CREATE TABLE IF NOT EXISTS upload (
    create_at INTEGER NOT NULL,
    update_at INTEGER NOT NULL,
    id        TEXT    UNIQUE
                      NOT NULL
                      PRIMARY KEY,
    url       TEXT    NOT NULL,
    state     INTEGER NOT NULL
                      DEFAULT (1)
);
`,
  `
CREATE TABLE IF NOT EXISTS user (
    create_at          INTEGER NOT NULL,
    update_at          INTEGER NOT NULL,
    account            TEXT    NOT NULL
                               UNIQUE
                               PRIMARY KEY,
    username           TEXT    NOT NULL
                               UNIQUE,
    chat_id            TEXT    UNIQUE
                               NOT NULL,
    password           TEXT    NOT NULL
                               DEFAULT (''),
    state              INTEGER DEFAULT (1) 
                               NOT NULL,
    bg                 TEXT    NOT NULL
                               DEFAULT (''),
    bgxs               TEXT    NOT NULL
                               DEFAULT (''),
    daily_change_bg    INTEGER DEFAULT (0) 
                               NOT NULL,
    remote_login       INTEGER DEFAULT (1) 
                               NOT NULL,
    exp_token_time     INTEGER DEFAULT (0) 
                               NOT NULL,
    logo               TEXT    NOT NULL
                               DEFAULT (''),
    hide               INTEGER NOT NULL
                               DEFAULT (0),
    verify             TEXT    NOT NULL
                               DEFAULT (''),
    email              TEXT    NOT NULL
                               DEFAULT (''),
    receive_chat_state INTEGER NOT NULL
                               DEFAULT (0),
    forward_msg_state  INTEGER NOT NULL
                               DEFAULT (0),
    forward_msg_link   TEXT    NOT NULL
                               DEFAULT ('') 
);
`,
  `
CREATE INDEX idx_user_update_at_username_state_email_receive_chat_state_forward_msg_state ON user (
    update_at,
    username,
    state,
    email,
    receive_chat_state,
    forward_msg_state
);
`,
];

// 创建数据库表
async function createTables() {
  try {
    for (const sql of createTableSQLs) {
      await runSqlite(sql);
    }
  } catch (error) {
    await writelog(false, `[ createTables ] - ${error}`, 'error');
    throw error;
  }
}

// 插入初始数据
async function insertInitialData() {
  const nowTime = Date.now();

  const userData = [
    {
      update_at: nowTime,
      account: 'root',
      username: 'admin',
      chat_id: nanoid(),
    },
    {
      update_at: nowTime,
      account: 'hello',
      username: 'Hello助手',
      chat_id: nanoid(),
    },
  ];

  const noteData = [
    {
      update_at: nowTime,
      id: 'about',
      account: 'root',
      title: 'About',
      share: 1,
      content: (
        await _f.fsp.readFile(resolve(__dirname, './default_about.md'))
      ).toString(),
    },
    {
      update_at: nowTime,
      id: 'tips',
      account: 'root',
      title: 'Tips',
      share: 1,
      content: '',
    },
  ];

  try {
    await insertData('user', userData, 'account');
    await insertData('note', noteData);
    await becomeFriends('root', 'chang');
    await becomeFriends('root', 'hello');
  } catch (error) {
    await writelog(false, `[ insertInitialData ] - ${error}`, 'error');
    throw error;
  }
}

// 主函数：执行数据库初始化操作
(async () => {
  try {
    await queryData('user', 'account');
  } catch {
    await executeInTransaction(async () => {
      // 如果表不存在则创建表
      await createTables();
      // 插入初始数据
      await insertInitialData();
    });
  }
})();
