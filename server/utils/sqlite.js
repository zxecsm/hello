import Database from 'better-sqlite3';
import appConfig from '../data/config.js';
import _f from './f.js';
import _path from './path.js';

// DB 文件路径
const dbPath = appConfig.databaseDir('hello.db');
_f.fs.mkdirSync(_path.dirname(dbPath), { recursive: true });

// ===== SQLite 封装 =====
// 预编译语句缓存上限，避免动态 SQL 无限增长
const MAX_STATEMENT_CACHE = 1000;

// LIKE 通配符转义：把用户输入中的 % _ \ 当普通字符处理
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

// batchUpdate / batchDelete 的 RETURNING 字段列表
function normalizeReturnFields(autoIncField, fields) {
  const set = new Set([autoIncField]);

  for (const field of Array.isArray(fields) ? fields : String(fields || '').split(',')) {
    const name = String(field).trim();
    if (name) set.add(name);
  }

  return [...set].join(', ');
}

/*
================================================================================
DatabaseChain 使用教程
================================================================================

所有数据库操作都是同步执行的，不需要 await。

--------------------------------------------------------------------------------
一、基础查询
--------------------------------------------------------------------------------

const user = db('user').select('account,username').where({ account }).findOne();

const list = db('user')
  .select('account,username,state')
  .where({ state: 1 })
  .orderBy('serial', 'DESC')
  .page(20, 0) // limit 20, offset 0
  .find();

const total = db('user').where({ state: 1 }).count();

const row = db('user').where({ account }).getRandomOne();

--------------------------------------------------------------------------------
二、WHERE 条件
--------------------------------------------------------------------------------

db('todo').where({ account, state: 1 });

// 比较运算：= > >= < <= !=
db('todo').where({ serial: { '>': 100 } });
db('todo').where({ create_at: { '>=': start, '<': end } });

// IN / NOT IN
db('todo').where({ id: { in: ['a', 'b'] } });
db('todo').where({ id: { not: ['a', 'b'] } });

// 空 IN 会生成 1 = 0，永远不匹配，不会误伤全表
db('todo').where({ id: { in: [] } });

// LIKE：值需要自己带 %，内部已经加了 ESCAPE '\'
db('todo').where({ title: { like: '%hello%' } });

// NULL 会自动转成 IS NULL / IS NOT NULL
db('todo').where({ email: null });
db('todo').where({ email: { '!=': null } });

// IS NULL / BETWEEN
db('todo').where({ deleted_at: { isNull: true } });
db('todo').where({ start: { between: [1, 100] } });

// OR / AND（会自动加括号）
db('todo').where({ $or: [{ account }, { friend: account }] });
db('todo').where({
  $and: [{ state: 1 }, { $or: [{ top: 1 }, { create_at: { '>': t } }] }],
});

--------------------------------------------------------------------------------
三、插入
--------------------------------------------------------------------------------

db('todo').insert({
  id: 'xxx',
  create_at: Date.now(),
  update_at: Date.now(),
  account,
  content: 'hello',
});

// 批量插入：字段必须与第一行一致；超过 batchSize 时自动使用事务
db('todo').insertMany([
  { id: 'a', account, content: 'a', create_at: 1, update_at: 1 },
  { id: 'b', account, content: 'b', create_at: 2, update_at: 2 },
]);

--------------------------------------------------------------------------------
四、更新 / 删除
--------------------------------------------------------------------------------

db('todo').where({ id }).update({ content: 'new' });

// 没有 WHERE 会直接抛错；确需全表更新时显式传 all
db('todo').update({ state: 0 }, { all: true });

db('todo').where({ id }).delete();

// 自增 / 自减
db('songs').where({ id }).increment({ play_count: 1 });
db('songs').where({ id }).increment({ play_count: -1 });

// INSERT ... ON CONFLICT ... DO UPDATE
db('last_play').upsert(
  {
    create_at: Date.now(),
    account,
    song_id,
    play_current_time,
    duration,
  },
  {
    conflict: ['account'],
    update: ['song_id', 'play_current_time', 'duration'],
  },
);

// update 为空时等价于 ON CONFLICT DO NOTHING
db('user').upsert(
  { account, username, create_at: Date.now() },
  { conflict: ['account'] },
);

--------------------------------------------------------------------------------
五、批量更新 / 批量删除
--------------------------------------------------------------------------------

// callback 必须是同步函数，运行在同一个事务里
const updated = db('todo')
  .where({ account })
  .batchUpdate({ state: 1 }, { batchSize: 500 }, 'id', (rows) => {
    // rows 包含 serial + fields 指定的列
    // 这里可以执行同库的级联更新
  });

const deleted = db('todo')
  .where({ account, state: 0 })
  .batchDelete({ batchSize: 500 }, 'id', (rows) => {
    // 同库级联删除可以放这里
  });

// 没有 WHERE 同样会抛错；确需清空整表时显式传 all
db('todo').batchDelete({ all: true });

// 注意：文件、网络、异步操作不要放进 callback，事务提交后再做

--------------------------------------------------------------------------------
六、事务
--------------------------------------------------------------------------------

transaction(() => {
  db('user').where({ account }).delete();
  db('bmk').where({ account }).batchDelete();
  db('bmk_group').where({ account }).batchDelete();
});

// 事务回调必须是同步函数，中间不能 await；支持嵌套（内部使用 savepoint）

--------------------------------------------------------------------------------
七、搜索
--------------------------------------------------------------------------------

// words 一般是分词结果，例如 getSplitWord('天气')
const words = ['天气', '天气'];

db('note')
  .where({ account, state: 1 })
  .search(words, ['title', 'content'], { sort: true })
  .page(20, offset)
  .find();

// search 会自动：
// 1. 生成 field LIKE ? ESCAPE '\'；
// 2. 对 % _ \ 做转义；
// 3. 最多使用 10 个词；
// 4. sort: true 时按匹配权重排序。

--------------------------------------------------------------------------------
八、JOIN / 别名
--------------------------------------------------------------------------------

db('user AS u')
  .select('u.account,u.username,f.des,f.read')
  .join(
    'friends AS f',
    {
      'u.account': { value: 'f.friend', raw: true },
      'f.account': account,
    },
    { type: 'LEFT' },
  )
  .where({ 'u.state': 1 })
  .find();

--------------------------------------------------------------------------------
九、原始 SQL
--------------------------------------------------------------------------------

runSql('UPDATE user SET state = ? WHERE account = ?', [0, account]);
getSql('SELECT * FROM user WHERE account = ?', [account]);
allSql('SELECT * FROM user WHERE state = ?', [1]);

// 以下入口会直接拼接 SQL，只能传可信内容，禁止透传用户输入：
// - whereRaw(sql, params)
// - joinRaw(sql, params)
// - select('COUNT(*) AS c')
// - { raw: true, value: 'column_name' }

--------------------------------------------------------------------------------
十、注意事项
--------------------------------------------------------------------------------

1. 更新 / 删除 / 批量更新 / 批量删除必须有 WHERE，否则抛错。
2. 空 IN 生成 1 = 0；空 NOT IN 生成 1 = 1。
3. null 自动生成 IS NULL / IS NOT NULL。
4. 未知操作符直接抛错，避免拼写错误悄悄变成 =。
5. orderBy 方向只识别 DESC，其余一律按 ASC。
6. insertMany 会校验每行字段一致；多批次自动事务。
7. 所有 DB 操作同步执行，超大批量任务应分段处理，避免长时间阻塞事件循环。
================================================================================
*/

class DB {
  constructor(path) {
    this.db = new Database(path);
    this.statements = new Map();

    // 优化性能
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA wal_autocheckpoint = 1000;
      PRAGMA journal_size_limit = 67108864;
      PRAGMA cache_size = -32000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 67108864;
    `);
  }

  // 复用预编译语句（LRU：命中后移到末尾）
  _prepare(sql) {
    const cached = this.statements.get(sql);

    if (cached) {
      this.statements.delete(sql);
      this.statements.set(sql, cached);
      return cached;
    }

    const stmt = this.db.prepare(sql);

    if (this.statements.size >= MAX_STATEMENT_CACHE) {
      const [oldSql, oldStmt] = this.statements.entries().next().value;

      this.statements.delete(oldSql);

      try {
        oldStmt.finalize();
      } catch {}
    }

    this.statements.set(sql, stmt);

    return stmt;
  }

  run(sql, params = []) {
    return this._prepare(sql).run(params);
  }

  get(sql, params = []) {
    return this._prepare(sql).get(params);
  }

  all(sql, params = []) {
    return this._prepare(sql).all(params);
  }

  // 同步事务：回调内只能执行同步 SQL，不能有 await
  transaction(fn) {
    if (fn.constructor.name === 'AsyncFunction') {
      throw new Error('事务回调必须是同步函数');
    }
    return this.db.transaction(fn)();
  }

  close() {
    for (const stmt of this.statements.values()) {
      try {
        stmt.finalize();
      } catch {}
    }

    this.statements.clear();
    this.db.close();
  }
}

const database = new DB(dbPath);

// ===== 链式封装 =====
class DatabaseChain {
  constructor(tableName) {
    this.db = database;
    this._table = tableName.trim();
    this.reset();
  }

  // 重置状态
  reset() {
    this._fields = [];
    this._wheres = [];
    this._joins = [];
    this._limit = null;
    this._offset = null;
    this._orders = [];
    return this;
  }

  // 克隆实例
  clone() {
    const copy = new this.constructor(this._table);
    copy._fields = this._fields.slice();
    copy._joins = this._joins.slice();
    copy._wheres = this._wheres.slice();
    copy._orders = this._orders.slice();
    copy._limit = this._limit;
    copy._offset = this._offset;
    return copy;
  }

  select(fields, params = [], { flag } = {}) {
    const f = (Array.isArray(fields) ? fields : fields?.split?.(',') || [])
      .filter(Boolean)
      .join(', ');
    if (f) {
      this._fields.push({ clause: f, params, flag });
    }
    return this;
  }

  clearSelect(flag) {
    this._fields = flag ? this._fields.filter((f) => f.flag !== flag) : [];
    return this;
  }

  static searchSql(words, fields) {
    if (!Array.isArray(words) || !words.length || !Array.isArray(fields) || !fields.length) {
      return { clause: '', params: [] };
    }

    const params = [];
    const parts = [];

    for (const field of fields) {
      for (const w of words) {
        const val = w && typeof w === 'object' ? w.value : w;
        parts.push(`${field} LIKE ? ESCAPE '\\'`);
        params.push(`%${escapeLike(val)}%`);
      }
    }

    return { clause: `(${parts.join(' OR ')})`, params };
  }

  static scoreSql(words, fields) {
    if (!Array.isArray(words) || !words.length || !Array.isArray(fields) || !fields.length) {
      return { scoreSql: '', params: [] };
    }

    const params = [];
    const scoreParts = [];

    for (const field of fields) {
      for (const w of words) {
        const isObj = w && typeof w === 'object';
        const val = isObj ? w.value : w;
        const rawWeight = isObj ? (w.weight ?? 1) : 1;
        const weight = Number.isFinite(Number(rawWeight)) ? Number(rawWeight) : 1;

        scoreParts.push(`(CASE WHEN ${field} LIKE ? ESCAPE '\\' THEN ${weight} ELSE 0 END)`);
        params.push(`%${escapeLike(val)}%`);
      }
    }

    return { scoreSql: `(${scoreParts.join(' + ')})`, params };
  }

  search(words, fields, { flag, sort = false } = {}) {
    if (!Array.isArray(words) || !Array.isArray(fields)) return this;

    // 限制词数，避免 WHERE / ORDER BY 的表达式和参数无限膨胀
    const searchWords = words.slice(0, 10).filter((w) => {
      const val = w && typeof w === 'object' ? w.value : w;
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

    if (!searchWords.length || !fields.length) return this;

    const { clause: searchClause, params: searchParams } = DatabaseChain.searchSql(
      searchWords,
      fields,
    );
    if (searchClause) this.whereRaw(searchClause, searchParams, { flag });

    if (sort) {
      const { scoreSql, params: scoreParams } = DatabaseChain.scoreSql(searchWords, fields);
      if (scoreSql) {
        this.orderBy(scoreSql, 'DESC', { params: scoreParams, flag });
      }
    }

    return this;
  }

  where(conditions = {}, { process, flag } = {}) {
    let { clause, params } = this._parseWhere(conditions);
    if (process) {
      const res = process({ clause, params });
      clause = res.clause;
      params = res.params;
    }
    if (clause) this._wheres.push({ clause, params, flag });
    return this;
  }

  whereRaw(sql, params = [], { flag } = {}) {
    if (sql) this._wheres.push({ clause: `(${sql})`, params, flag });
    return this;
  }

  clearWhere(flag) {
    this._wheres = flag ? this._wheres.filter((w) => w.flag !== flag) : [];
    return this;
  }

  _parseWhere(conditions) {
    if (!conditions || typeof conditions !== 'object') return { clause: '', params: [] };

    const clauses = [];
    const params = [];

    for (const [key, value] of Object.entries(conditions)) {
      // --- OR ---
      if (key === '$or' && Array.isArray(value)) {
        const parts = value.map((v) => this._parseCondition(v)).filter((x) => x.clause);
        if (parts.length) {
          clauses.push(`(${parts.map((p) => p.clause).join(' OR ')})`);
          for (const p of parts) params.push(...p.params);
        }
        continue;
      }

      // --- AND ---
      if (key === '$and' && Array.isArray(value)) {
        const parts = value.map((v) => this._parseWhere(v)).filter((x) => x.clause);
        if (parts.length) {
          clauses.push(`(${parts.map((p) => p.clause).join(' AND ')})`);
          for (const p of parts) params.push(...p.params);
        }
        continue;
      }

      // --- 普通字段 ---
      const { clause, params: subParams } = this._parseCondition({ [key]: value });
      if (clause) {
        clauses.push(clause);
        params.push(...subParams);
      }
    }

    return { clause: clauses.join(' AND '), params };
  }

  _parseCondition(cond) {
    const clauses = [];
    const params = [];

    for (const [key, val] of Object.entries(cond)) {
      // --- 嵌套 and/or ---
      if ((key === '$and' || key === '$or') && Array.isArray(val)) {
        const { clause, params: p } = this._parseWhere({ [key]: val });
        if (clause) {
          clauses.push(clause);
          params.push(...p);
        }
        continue;
      }

      let operations;

      // 顶层 raw/value 包装
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        operations = 'raw' in val && 'value' in val ? { '=': val } : val;
      } else {
        operations = { '=': val };
      }

      for (const [op, rawVal] of Object.entries(operations)) {
        const isRawWrap =
          rawVal &&
          typeof rawVal === 'object' &&
          !Array.isArray(rawVal) &&
          'raw' in rawVal &&
          'value' in rawVal;

        const value = isRawWrap ? rawVal.value : rawVal;
        const raw = isRawWrap ? rawVal.raw : false;

        const useParam = !raw;
        const place = useParam ? '?' : value;

        switch (op) {
          case 'like':
          case 'notLike': {
            if (value === null || value === undefined) {
              throw new Error(`Operator ${op} does not accept null/undefined`);
            }
            const escapeSql = useParam ? " ESCAPE '\\'" : '';
            clauses.push(`${key} ${op === 'like' ? 'LIKE' : 'NOT LIKE'} ${place}${escapeSql}`);
            if (useParam) params.push(value);
            break;
          }

          case 'in':
          case 'not': {
            if (!Array.isArray(value)) {
              throw new Error(`Operator ${op} expects an array`);
            }
            if (!value.length) {
              // 空 IN 必须匹配 0 行；空 NOT IN 恒真
              clauses.push(op === 'in' ? '1 = 0' : '1 = 1');
              break;
            }
            clauses.push(
              `${key} ${op === 'in' ? 'IN' : 'NOT IN'} (${value.map(() => '?').join(',')})`,
            );
            params.push(...value);
            break;
          }

          case 'isNull':
          case 'isNotNull':
            clauses.push(`${key} ${op === 'isNull' ? 'IS NULL' : 'IS NOT NULL'}`);
            break;

          case 'between':
          case 'notBetween':
            if (!Array.isArray(value) || value.length !== 2) {
              throw new Error(`Operator ${op} expects [min, max]`);
            }
            clauses.push(`${key} ${op === 'between' ? 'BETWEEN' : 'NOT BETWEEN'} ? AND ?`);
            params.push(value[0], value[1]);
            break;

          default:
            if (!isRawWrap && (value === null || value === undefined)) {
              if (op === '=' || op === '!=') {
                clauses.push(`${key} IS ${op === '!=' ? 'NOT ' : ''}NULL`);
                break;
              }
              throw new Error(`Operator ${op} does not accept null/undefined`);
            }

            clauses.push(`${key} ${this._mapOp(op)} ${place}`);
            if (useParam) params.push(value);
        }
      }
    }

    return { clause: clauses.join(' AND '), params };
  }

  _mapOp(op) {
    const ops = { '=': '=', '>': '>', '>=': '>=', '<': '<', '<=': '<=', '!=': '!=' };
    const mapped = ops[op];
    if (!mapped) throw new Error(`Unsupported operator: ${op}`);
    return mapped;
  }

  orderBy(field, direction = 'ASC', { params = [], flag } = {}) {
    const dir = String(direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    this._orders.push({ field, direction: dir, flag, params });
    return this;
  }

  clearOrder(flag) {
    this._orders = flag ? this._orders.filter((o) => o.flag !== flag) : [];
    return this;
  }

  limit(n) {
    this._limit = { clause: 'LIMIT ?', params: n };
    return this;
  }

  offset(n) {
    this._offset = { clause: 'OFFSET ?', params: n };
    return this;
  }

  page(limit, offset) {
    if (limit !== undefined) this.limit(limit);
    if (offset !== undefined) this.offset(offset);
    return this;
  }

  clearLimit() {
    this._limit = null;
    return this;
  }

  clearOffset() {
    this._offset = null;
    return this;
  }

  clearPage() {
    this._limit = null;
    this._offset = null;
    return this;
  }

  // ===== JOIN =====
  join(table, onConditions, { type = 'INNER', flag } = {}) {
    if (onConditions && typeof onConditions === 'object' && !Array.isArray(onConditions)) {
      const { clause, params } = this._parseWhere(onConditions);
      this._joins.push({
        type: clause ? type.toUpperCase() : 'CROSS',
        table,
        clause: clause || '',
        params: clause ? params : [],
        flag,
      });
    } else {
      this._joins.push({ type: 'CROSS', table, clause: '', params: [], flag });
    }
    return this;
  }

  joinRaw(table, onConditions = '', params = [], { type = 'INNER', flag } = {}) {
    const hasClause = onConditions && typeof onConditions === 'string';
    this._joins.push({
      type: hasClause ? type.toUpperCase() : 'CROSS',
      table,
      clause: hasClause ? onConditions : '',
      params: hasClause ? params : [],
      flag,
    });
    return this;
  }

  clearJoin(flag) {
    this._joins = flag ? this._joins.filter((j) => j.flag !== flag) : [];
    return this;
  }

  _buildWhere() {
    const clauses = [];
    const params = [];

    for (const w of this._wheres) {
      if (w.clause) {
        clauses.push(w.clause);
        if (w.params?.length) params.push(...w.params);
      }
    }

    return { clause: clauses.join(' AND '), params };
  }

  // 更新 / 删除类操作必须有 WHERE，或显式传 all
  _requireWhere(operation, all = false) {
    if (!all && !this._wheres.length) {
      throw new Error(`Unsafe ${operation}: missing WHERE`);
    }
  }

  // 批量写入公共循环：按自增 ID 游标分批执行，整个循环一个事务
  _batchWrite({ sql, params, batchSize, autoIncField, callback }) {
    return this.db.transaction(() => {
      let total = 0;
      let lastId = 0;

      while (true) {
        const rows = this.db.all(sql, [...params, lastId, batchSize]);
        if (!rows.length) break;

        // RETURNING 不保证返回顺序，这里取最大自增 ID 作为下一批游标
        let maxId = lastId;
        for (const row of rows) {
          const id = row[autoIncField];
          if (id > maxId) maxId = id;
        }
        lastId = maxId;

        total += rows.length;
        if (callback) callback(rows);
      }

      return total;
    });
  }

  _buildSelectSQL() {
    // SELECT 字段
    const fields = this._fields.length ? this._fields.map((f) => f.clause).join(', ') : '*';

    let sql = `SELECT ${fields} FROM ${this._table}`;
    const params = [];

    // SELECT params
    for (const f of this._fields) {
      if (f.params?.length) params.push(...f.params);
    }

    // JOIN
    for (const j of this._joins) {
      sql += ` ${j.type} JOIN ${j.table}`;
      if (j.clause) {
        sql += ` ON ${j.clause}`;
        if (j.params?.length) params.push(...j.params);
      }
    }

    // WHERE
    const allWhereClauses = [];
    for (const w of this._wheres) {
      if (w.clause) {
        allWhereClauses.push(w.clause);
        if (w.params?.length) params.push(...w.params);
      }
    }
    if (allWhereClauses.length) {
      sql += ` WHERE ${allWhereClauses.join(' AND ')}`;
    }

    // ORDER
    if (this._orders.length) {
      sql += ` ORDER BY ${this._orders.map((o) => `${o.field} ${o.direction}`).join(', ')}`;
      for (const o of this._orders) {
        if (o.params?.length) params.push(...o.params);
      }
    }

    // LIMIT & OFFSET
    if (this._limit?.clause) {
      sql += ` ${this._limit.clause}`;
      if (this._limit.params !== undefined) params.push(this._limit.params);
    }
    if (this._offset?.clause) {
      sql += ` ${this._offset.clause}`;
      if (this._offset.params !== undefined) params.push(this._offset.params);
    }

    return { sql, params };
  }

  echoSql() {
    const { sql, params } = this.clone()._buildSelectSQL();
    // eslint-disable-next-line no-console
    console.log(sql, params);
    return this;
  }

  find() {
    const { sql, params } = this.clone()._buildSelectSQL();
    return this.db.all(sql, params);
  }

  findOne() {
    const { sql, params } = this.clone().clearPage().limit(1)._buildSelectSQL();
    return this.db.get(sql, params) || null;
  }

  insert(data) {
    return this.insertMany([data]);
  }

  insertMany(list, { batchSize = 500 } = {}) {
    if (!Array.isArray(list) || !list.length) return null;

    batchSize = Math.max(1, Math.floor(batchSize));

    const keys = Object.keys(list[0]);
    const keySet = new Set(keys);

    for (let i = 0; i < list.length; i++) {
      const obj = list[i];
      const objKeys = Object.keys(obj);

      if (objKeys.length !== keys.length || objKeys.some((key) => !keySet.has(key))) {
        throw new Error(`insertMany: 第 ${i + 1} 行字段与第一行不一致`);
      }
    }

    const fieldsStr = keys.join(',');
    const singlePlaceholders = `(${keys.map(() => '?').join(',')})`;

    const run = () => {
      let lastResult = null;

      for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);
        const placeholders = new Array(batch.length).fill(singlePlaceholders).join(',');
        const sql = `INSERT INTO ${this._table} (${fieldsStr}) VALUES ${placeholders}`;

        const batchParams = [];
        for (const obj of batch) {
          for (const key of keys) batchParams.push(obj[key]);
        }
        lastResult = this.db.run(sql, batchParams);
      }

      return lastResult;
    };

    // 单条 SQL 本身就是一个原子语句；多批次才需要额外事务
    return list.length > batchSize ? this.db.transaction(run) : run();
  }

  // INSERT ... ON CONFLICT ... DO UPDATE / DO NOTHING
  upsert(data, { conflict = [], update = [] } = {}) {
    if (!data || !Object.keys(data).length) {
      throw new Error('upsert: data is empty');
    }

    const keys = Object.keys(data);
    const keySet = new Set(keys);
    const conflictFields = (Array.isArray(conflict) ? conflict : [conflict]).filter(Boolean);
    const updateFields = (Array.isArray(update) ? update : [update]).filter(Boolean);

    if (!conflictFields.length) throw new Error('upsert: conflict fields are required');
    if (conflictFields.some((key) => !keySet.has(key))) {
      throw new Error('upsert: conflict fields must be present in data');
    }
    if (updateFields.some((key) => !keySet.has(key))) {
      throw new Error('upsert: update fields must be present in data');
    }

    const placeholders = keys.map(() => '?').join(',');
    let sql = `INSERT INTO ${this._table} (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT (${conflictFields.join(',')})`;

    sql += updateFields.length
      ? ` DO UPDATE SET ${updateFields.map((key) => `${key} = excluded.${key}`).join(',')}`
      : ' DO NOTHING';

    return this.db.run(
      sql,
      keys.map((key) => data[key]),
    );
  }

  update(data, { all = false } = {}) {
    if (!data || !Object.keys(data).length) return 0;

    this._requireWhere('UPDATE', all);

    const sets = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(',');
    const { clause, params } = this._buildWhere();
    const sql = `UPDATE ${this._table} SET ${sets}${clause ? ` WHERE ${clause}` : ''}`;

    return this.db.run(sql, [...Object.values(data), ...params]);
  }

  delete({ all = false } = {}) {
    this._requireWhere('DELETE', all);

    const { clause, params } = this._buildWhere();
    const sql = `DELETE FROM ${this._table}${clause ? ` WHERE ${clause}` : ''}`;

    return this.db.run(sql, params);
  }

  getRandom({ limit = 1 } = {}) {
    limit = Math.max(1, Math.floor(limit));

    return this.clone().clearPage().clearOrder().orderBy('RANDOM()', 'ASC').limit(limit).find();
  }

  getRandomOne() {
    return this.getRandom({ limit: 1 })[0] || null;
  }

  count() {
    const row = this.clone()
      .clearPage()
      .clearSelect()
      .clearOrder()
      .select('COUNT(*) AS c')
      .findOne();
    return row?.c || 0;
  }

  batchUpdate(
    data,
    { batchSize = 500, autoIncField = 'serial', all = false } = {},
    fields,
    callback,
  ) {
    if (!data || !Object.keys(data).length) return 0;

    this._requireWhere('batchUpdate', all);
    if (this._joins.length) throw new Error('batchUpdate 暂不支持 JOIN');
    if (callback && callback.constructor.name === 'AsyncFunction') {
      throw new Error('batchUpdate 的 callback 必须是同步函数');
    }

    batchSize = Math.max(1, Math.floor(batchSize));

    const setSql = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(',');
    const { clause, params } = this._buildWhere();
    const whereSql = clause ? `${clause} AND ` : '';
    const returning = normalizeReturnFields(autoIncField, fields);

    const sql = `UPDATE ${this._table} SET ${setSql}
      WHERE ${autoIncField} IN (
        SELECT ${autoIncField} FROM ${this._table}
        WHERE ${whereSql}${autoIncField} > ?
        ORDER BY ${autoIncField} ASC
        LIMIT ?
      )
      RETURNING ${returning}`;

    return this._batchWrite({
      sql,
      params: [...Object.values(data), ...params],
      batchSize,
      autoIncField,
      callback,
    });
  }

  batchDelete({ batchSize = 500, autoIncField = 'serial', all = false } = {}, fields, callback) {
    this._requireWhere('batchDelete', all);
    if (this._joins.length) throw new Error('batchDelete 暂不支持 JOIN');
    if (callback && callback.constructor.name === 'AsyncFunction') {
      throw new Error('batchDelete 的 callback 必须是同步函数');
    }

    batchSize = Math.max(1, Math.floor(batchSize));

    const { clause, params } = this._buildWhere();
    const whereSql = clause ? `${clause} AND ` : '';
    const returning = normalizeReturnFields(autoIncField, fields);

    const sql = `DELETE FROM ${this._table}
      WHERE ${autoIncField} IN (
        SELECT ${autoIncField} FROM ${this._table}
        WHERE ${whereSql}${autoIncField} > ?
        ORDER BY ${autoIncField} ASC
        LIMIT ?
      )
      RETURNING ${returning}`;

    return this._batchWrite({ sql, params, batchSize, autoIncField, callback });
  }

  /*
  UPDATE users SET score = score + ?, view_count = view_count + ?
  WHERE id = ?
  [ 1, 3, 5 ]
  */
  increment(sets, { all = false } = {}) {
    this._requireWhere('increment', all);

    const keys = Object.keys(sets);
    if (!keys.length) return null;

    const setSql = keys.map((key) => `${key} = ${key} + ?`).join(', ');
    const { clause, params } = this._buildWhere();
    const sql = `UPDATE ${this._table} SET ${setSql}${clause ? ` WHERE ${clause}` : ''}`;

    return this.db.run(sql, [...keys.map((key) => sets[key]), ...params]);
  }

  /*
  [
    {
      field: 'score',         // 要更新的字段
      match: 'id',            // 匹配条件字段
      items: [                // 更新内容
        { id: 1, score: 90 },
        { id: 2, score: 85 }
      ]
    },
    {
      field: 'level',
      match: 'id',
      items: [
        { id: 1, level: 'A' },
        { id: 2, level: 'B' }
      ]
    }
  ]
  UPDATE students
  SET 
    score = (CASE WHEN id = ? THEN ? WHEN id = ? THEN ? END),
    level = (CASE WHEN id = ? THEN ? WHEN id = ? THEN ? END)
  WHERE class_id = ?
  */
  batchDiffUpdate(updateRules, conditions = {}) {
    if (!conditions || !Object.keys(conditions).length)
      throw new Error(
        'batchDiffUpdate: missing conditions — updating entire table is not allowed.',
      );

    if (!Array.isArray(updateRules) || !updateRules.length) return 0;

    const valueParams = [];
    const setFragments = [];

    for (const { field, match, items } of updateRules) {
      if (!Array.isArray(items) || !items.length) continue;

      const caseSql = items.map(() => `WHEN ${match} = ? THEN ?`).join(' ');
      // ELSE field：未出现在 items 里的行保持原值，避免 CASE 返回 NULL
      setFragments.push(`${field} = (CASE ${caseSql} ELSE ${field} END)`);
      for (const row of items) {
        valueParams.push(row[match], row[field]);
      }
    }

    if (!setFragments.length) return 0;

    const { clause: whereClauseRaw, params: whereParams } = this._parseWhere(conditions);
    const whereClause = whereClauseRaw ? `WHERE ${whereClauseRaw}` : '';

    const sql = `UPDATE ${this._table} SET ${setFragments.join(', ')} ${whereClause}`;
    return this.db.run(sql, [...valueParams, ...whereParams]);
  }
}

// ===== 导出 =====
export const db = (table) => new DatabaseChain(table);
export const runSql = (sql, params) => database.run(sql, params);
export const getSql = (sql, params) => database.get(sql, params);
export const allSql = (sql, params) => database.all(sql, params);
export const transaction = (fn) => database.transaction(fn);
export const scoreSql = DatabaseChain.scoreSql;
export const searchSql = DatabaseChain.searchSql;
