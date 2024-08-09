const _f = require('../utils/f');
const { queryData, runSqlite, insertData } = require('../utils/sqlite');
const { resolve } = require('path');
const { writelog } = require('../utils/utils');
queryData('user', 'account')
  .then(() => {})
  .catch(async () => {
    try {
      await runSqlite(`CREATE TABLE booklist (
        state   TEXT DEFAULT (0) 
                     NOT NULL,
        id      TEXT NOT NULL
                     UNIQUE
                     PRIMARY KEY,
        account TEXT NOT NULL,
        num     INT  NOT NULL,
        name    TEXT NOT NULL,
        share   TEXT NOT NULL
                     DEFAULT n
    );
    
`);
      await runSqlite(`CREATE TABLE bookmk (
        state   TEXT DEFAULT (0) 
                     NOT NULL,
        num     INT  NOT NULL,
        id      TEXT NOT NULL
                     UNIQUE
                     PRIMARY KEY,
        listid  TEXT NOT NULL,
        account TEXT NOT NULL,
        name    TEXT NOT NULL,
        link    TEXT NOT NULL,
        logo    TEXT NOT NULL
                     DEFAULT (''),
        des     TEXT NOT NULL
                     DEFAULT ('') 
    );`);
      await runSqlite(`CREATE TABLE chat (
        id    TEXT NOT NULL
                   UNIQUE
                   PRIMARY KEY,
        _from TEXT NOT NULL,
        _to   TEXT NOT NULL,
        flag  TEXT NOT NULL,
        time  TEXT NOT NULL,
        date  TEXT NOT NULL,
        data  TEXT NOT NULL,
        size  TEXT NOT NULL
                   DEFAULT (''),
        hash  TEXT NOT NULL
                   DEFAULT (''),
        type  TEXT NOT NULL
                   DEFAULT text
    );      
`);
      await runSqlite(`CREATE TABLE count_down (
        id      TEXT NOT NULL
                     UNIQUE
                     PRIMARY KEY,
        account TEXT NOT NULL,
        title   TEXT NOT NULL,
        start   TEXT NOT NULL,
        end     TEXT NOT NULL,
        link    TEXT NOT NULL
                     DEFAULT (''),
        top     TEXT NOT NULL
                     DEFAULT (0),
        state   TEXT NOT NULL
                     DEFAULT (0) 
    );
`);
      await runSqlite(`CREATE TABLE friends (
        account TEXT NOT NULL,
        friend  TEXT NOT NULL,
        islook  TEXT DEFAULT y
                     NOT NULL,
        time    TEXT NOT NULL,
        des     TEXT NOT NULL
                     DEFAULT ('') 
    );    
`);
      await runSqlite(`CREATE TABLE history (
    state   TEXT DEFAULT (0) 
                 NOT NULL,
    id      TEXT NOT NULL
                 UNIQUE
                 PRIMARY KEY,
    account TEXT NOT NULL,
    data    TEXT NOT NULL
);
`);
      await runSqlite(`CREATE TABLE last_play (
    account  TEXT NOT NULL
                  UNIQUE
                  PRIMARY KEY,
    song_id  TEXT NOT NULL,
    c_time   TEXT NOT NULL
                  DEFAULT (0),
    duration TEXT NOT NULL
                  DEFAULT (0) 
);
`);
      await runSqlite(`CREATE TABLE musicinfo (
    account TEXT NOT NULL
                 UNIQUE
                 PRIMARY KEY,
    data    TEXT NOT NULL
);
`);
      await runSqlite(`CREATE TABLE upload (
        id   TEXT UNIQUE
                  NOT NULL
                  PRIMARY KEY,
        url  TEXT NOT NULL,
        time TEXT NOT NULL
                  DEFAULT (0) 
    );
    `);
      await runSqlite(`CREATE TABLE bg (
        id    TEXT PRIMARY KEY
                   UNIQUE
                   NOT NULL,
        hash  TEXT UNIQUE
                   NOT NULL,
        url   TEXT NOT NULL
                   DEFAULT (''),
        time  TEXT NOT NULL
                   DEFAULT (0),
        type  TEXT NOT NULL,
        title TEXT NOT NULL
                   DEFAULT ('') 
    );`);
      await runSqlite(`CREATE TABLE pic (
      id    TEXT PRIMARY KEY
                 UNIQUE
                 NOT NULL,
      url   TEXT NOT NULL
                 DEFAULT (''),
      hash  TEXT NOT NULL
                 UNIQUE,
      time  TEXT NOT NULL
                 DEFAULT (0),
      title TEXT NOT NULL
                 DEFAULT ('') 
  );
  `);
      await runSqlite(`CREATE TABLE musics (
    id            TEXT UNIQUE
                       NOT NULL
                       PRIMARY KEY,
    title         TEXT NOT NULL,
    artist        TEXT NOT NULL,
    duration      TEXT NOT NULL
                       DEFAULT (0),
    mv            TEXT DEFAULT ('') 
                       NOT NULL,
    collect_count TEXT DEFAULT (0) 
                       NOT NULL,
    play_count    TEXT DEFAULT (0) 
                       NOT NULL,
    album         TEXT NOT NULL
                       DEFAULT (''),
    year          TEXT NOT NULL
                       DEFAULT (''),
    creat_time    TEXT NOT NULL
                       DEFAULT (''),
    hash          TEXT NOT NULL
                       DEFAULT ('') 
                       UNIQUE,
    url           TEXT NOT NULL
                       DEFAULT (''),
    pic           TEXT NOT NULL
                       DEFAULT (''),
    lrc           TEXT DEFAULT ('') 
                       NOT NULL
);`);
      await runSqlite(`CREATE TABLE note (
        state       TEXT DEFAULT (0) 
                         NOT NULL,
        id          TEXT NOT NULL
                         UNIQUE
                         PRIMARY KEY,
        account     TEXT NOT NULL,
        name        TEXT NOT NULL,
        share       TEXT DEFAULT n
                         NOT NULL,
        data        TEXT NOT NULL,
        time        TEXT NOT NULL,
        visit_count TEXT NOT NULL
                         DEFAULT (0),
        utime       TEXT NOT NULL
                         DEFAULT (''),
        weight      TEXT NOT NULL
                         DEFAULT (0),
        category    TEXT NOT NULL
                         DEFAULT ('') 
    );    
`);
      await runSqlite(`CREATE TABLE note_category (
  id      TEXT PRIMARY KEY
               UNIQUE
               NOT NULL,
  account TEXT NOT NULL,
  title   TEXT NOT NULL
);
`);
      await runSqlite(`CREATE TABLE playing (
    account TEXT NOT NULL
                 UNIQUE
                 PRIMARY KEY,
    data    TEXT NOT NULL
);
`);
      await runSqlite(`CREATE TABLE share (
        type    TEXT DEFAULT (0) 
                     NOT NULL,
        id      TEXT NOT NULL
                     UNIQUE
                     PRIMARY KEY,
        account TEXT NOT NULL,
        data    TEXT NOT NULL,
        title   TEXT NOT NULL,
        valid   TEXT NOT NULL
                     DEFAULT (0),
        pass    TEXT NOT NULL
                     DEFAULT ('') 
    );
    `);
      await runSqlite(`CREATE TABLE todo (
    id      TEXT PRIMARY KEY
                 UNIQUE
                 NOT NULL,
    account TEXT NOT NULL,
    data    TEXT NOT NULL,
    time    TEXT NOT NULL,
    state   TEXT NOT NULL
                 DEFAULT (0) 
);
`);
      await runSqlite(`CREATE TABLE user (
        state    TEXT DEFAULT (0) 
                      NOT NULL,
        account  TEXT NOT NULL
                      UNIQUE
                      PRIMARY KEY,
        username TEXT NOT NULL
                      UNIQUE,
        password TEXT NOT NULL,
        time     TEXT NOT NULL,
        bg       TEXT NOT NULL,
        bgxs     TEXT NOT NULL,
        dailybg  TEXT DEFAULT n
                      NOT NULL,
        flag     TEXT DEFAULT (0) 
                      NOT NULL,
        logo     TEXT NOT NULL
                      DEFAULT (''),
        hide     TEXT NOT NULL
                      DEFAULT n,
        verify   TEXT NOT NULL
                      DEFAULT (''),
        email    TEXT NOT NULL
                      DEFAULT ('') 
    );
`);
      await runSqlite(`CREATE VIEW getchat AS
      SELECT u.username name,
             u.logo,
             u.email,
             c._from,
             c.id,
             c._to,
             c.flag,
             c.time,
             c.date,
             c.data,
             c.hash,
             c.type,
             c.size
        FROM chat AS c
             LEFT JOIN
             user AS u ON u.account = c._from;`);
      await runSqlite(`CREATE VIEW getchatfile AS
      SELECT u.url,
             c._from,
             c.id,
             c._to,
             c.flag,
             c.time,
             c.date,
             c.data,
             c.hash,
             c.type,
             c.size
        FROM chat AS c
             LEFT JOIN
             upload AS u ON u.id = c.hash;`);
      await runSqlite(`CREATE VIEW getnote AS
      SELECT u.username,
             u.logo,
             u.email,
             n.visit_count,
             n.state,
             n.id,
             n.account,
             n.name,
             n.time,
             n.data,
             n.share,
             n.utime,
             n.weight,
             n.category
        FROM note AS n
             LEFT JOIN
             user AS u ON u.account = n.account;
`);
      await runSqlite(`CREATE VIEW getshare AS
      SELECT u.username,
             u.logo,
             u.email,
             s.id,
             s.title,
             s.valid,
             s.pass,
             s.account,
             s.type,
             s.data
        FROM share AS s
             LEFT JOIN
             user AS u ON u.account = s.account;
  `);
      await runSqlite(`CREATE TRIGGER deluser
         AFTER DELETE
            ON user
BEGIN
    DELETE FROM friends
          WHERE account = old.account OR 
                friend = old.account;
    DELETE FROM share
          WHERE account = old.account;
    DELETE FROM playing
          WHERE account = old.account;
    DELETE FROM musicinfo
          WHERE account = old.account;
    DELETE FROM last_play
          WHERE account = old.account;
    DELETE FROM bookmk
          WHERE account = old.account;
    DELETE FROM booklist
          WHERE account = old.account;
    DELETE FROM history
          WHERE account = old.account;
    DELETE FROM note
          WHERE account = old.account;
    DELETE FROM todo
          WHERE account = old.account;
    DELETE FROM count_down
          WHERE account = old.account;
    DELETE FROM note_category
          WHERE account = old.account;
    DELETE FROM chat
          WHERE _from = old.account OR 
                _to = old.account;
END;
`);
      const nowTime = Date.now();
      await insertData('user', [
        {
          username: 'admin',
          account: 'root',
          time: nowTime,
          bg: '',
          bgxs: '',
          dailybg: 'n',
          flag: '0',
          password: '',
          state: '0',
          logo: '',
          hide: 'n',
          verify: '',
          email: '',
        },
      ]);

      await insertData('note', [
        {
          id: 'about',
          name: 'About',
          data: (
            await _f.p.readFile(resolve(__dirname, './default_about.md'))
          ).toString(),
          time: nowTime,
          share: 'y',
          account: 'root',
          state: '0',
          utime: '',
          visit_count: '0',
        },
        {
          id: 'tips',
          name: 'Tips',
          data: '',
          time: nowTime,
          share: 'y',
          account: 'root',
          state: '0',
          utime: '',
          visit_count: '0',
        },
      ]);
    } catch (error) {
      await writelog(false, `[ ${error} ]`, 'error');
    }
  });
