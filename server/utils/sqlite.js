import Database from 'better-sqlite3';
import appConfig from '../data/config.js';
import _f from './f.js';
import _path from './path.js';

// DB 文件路径
const dbPath = appConfig.databaseDir('hello.db');
_f.fs.mkdirSync(_path.dirname(dbPath), { recursive: true });

// ===== SQLite 封装 =====
class DB {
  constructor(path) {
    this.db = new Database(path);

    // 优化性能
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA wal_autocheckpoint = 500;
      PRAGMA cache_size = 2000;
      PRAGMA temp_store = MEMORY;
    `);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(params);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.get(params);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.all(params);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      try {
        this.db.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
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
    if (!words?.length || !fields?.length) return { clause: '', params: [] };

    const clauseWords = words.map((w) => {
      const val = w && typeof w === 'object' ? w.value : w;
      return `%${val}%`;
    });

    const scoreParts = [];
    const params = [];

    for (const field of fields) {
      // eslint-disable-next-line no-unused-vars
      for (const _ of words) {
        scoreParts.push(`LOWER(${field}) LIKE LOWER(?)`);
      }
      params.push(...clauseWords);
    }

    return { clause: `(${scoreParts.join(' OR ')})`, params };
  }

  static scoreSql(words, fields) {
    if (!words?.length || !fields?.length) return { scoreSql: '', params: [] };

    const params = [];
    const scoreParts = [];

    for (const field of fields) {
      for (const w of words) {
        const isObj = w && typeof w === 'object';
        const val = isObj ? w.value : w;
        const weight = isObj ? w.weight || 1 : 1;

        scoreParts.push(`(CASE WHEN LOWER(${field}) LIKE LOWER(?) THEN ${weight} ELSE 0 END)`);
        params.push(`%${val}%`);
      }
    }

    return { scoreSql: `(${scoreParts.join(' + ')})`, params };
  }

  search(words, fields, { flag, sort = false } = {}) {
    const { clause: searchClause, params: searchParams } = DatabaseChain.searchSql(words, fields);
    if (searchClause) this.whereRaw(searchClause, searchParams, { flag });

    if (sort) {
      const { scoreSql, params: scoreParams } = DatabaseChain.scoreSql(words, fields);
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
          case 'notLike':
            clauses.push(`${key} ${op === 'like' ? 'LIKE' : 'NOT LIKE'} ${place}`);
            if (useParam) params.push(value);
            break;

          case 'in':
          case 'not':
            if (!Array.isArray(value) || !value.length) break;
            clauses.push(
              `${key} ${op === 'in' ? 'IN' : 'NOT IN'} (${value.map(() => '?').join(',')})`,
            );
            params.push(...value);
            break;

          case 'isNull':
          case 'isNotNull':
            clauses.push(`${key} ${op === 'isNull' ? 'IS NULL' : 'IS NOT NULL'}`);
            break;

          case 'between':
          case 'notBetween':
            if (Array.isArray(value) && value.length === 2) {
              clauses.push(`${key} ${op === 'between' ? 'BETWEEN' : 'NOT BETWEEN'} ? AND ?`);
              params.push(value[0], value[1]);
            }
            break;

          default:
            clauses.push(`${key} ${this._mapOp(op)} ${place}`);
            if (useParam) params.push(value);
        }
      }
    }

    return { clause: clauses.join(' AND '), params };
  }

  _mapOp(op) {
    const ops = { '>': '>', '>=': '>=', '<': '<', '<=': '<=', '!=': '!=' };
    return ops[op] || '=';
  }

  orderBy(field, direction = 'ASC', { params = [], flag } = {}) {
    this._orders.push({ field, direction: direction.toUpperCase(), flag, params });
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

  async find() {
    const { sql, params } = this.clone()._buildSelectSQL();
    return await this.db.all(sql, params);
  }

  async findOne() {
    const rows = await this.clone().clearPage().limit(1).find();
    return rows[0] || null;
  }

  async insert(data) {
    return this.insertMany([data]);
  }

  async insertMany(list, { batchSize = 500 } = {}) {
    if (!Array.isArray(list) || !list.length) return null;
    const keys = Object.keys(list[0]);
    const fieldsStr = keys.join(',');
    const singlePlaceholders = `(${keys.map(() => '?').join(',')})`;

    let lastResult = null;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const placeholders = new Array(batch.length).fill(singlePlaceholders).join(',');
      const sql = `INSERT INTO ${this._table} (${fieldsStr}) VALUES ${placeholders}`;

      const batchParams = [];
      for (const obj of batch) {
        for (const key of keys) batchParams.push(obj[key]);
      }
      lastResult = await this.db.run(sql, batchParams);
    }
    return lastResult;
  }

  async update(data, { all = false } = {}) {
    if (!data || !Object.keys(data).length) return 0;

    if (!all && !this._wheres.length) throw new Error('Unsafe UPDATE: missing WHERE');

    const copy = this.clone();
    const sets = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(',');
    const setParams = Object.values(data);

    let sql = `UPDATE ${copy._table} SET ${sets}`;

    const whereClauses = [];
    const whereParams = [];
    for (const w of copy._wheres) {
      if (w.clause) {
        whereClauses.push(w.clause);
        if (w.params) whereParams.push(...w.params);
      }
    }

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    return await this.db.run(sql, [...setParams, ...whereParams]);
  }

  async delete({ all = false } = {}) {
    if (!all && !this._wheres.length) throw new Error('Unsafe DELETE: missing WHERE');

    const copy = this.clone();
    let sql = `DELETE FROM ${copy._table}`;
    const whereParams = [];

    const whereClauses = [];
    for (const w of copy._wheres) {
      if (w.clause) {
        whereClauses.push(w.clause);
        if (w.params) whereParams.push(...w.params);
      }
    }

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    return await this.db.run(sql, whereParams);
  }

  async getRandom({ limit = 1 } = {}) {
    const total = await this.clone().count();

    if (!total) return [];
    if (total <= limit) return await this.clone().find();

    return await this.clone()
      .page(limit, Math.floor(Math.random() * (total - limit) + 1))
      .find();
  }

  async getRandomOne() {
    return (await this.getRandom({ limit: 1 }))[0] || null;
  }

  async count() {
    const row = await this.clone().clearPage().clearSelect().select('COUNT(*) AS c').findOne();
    return row?.c || 0;
  }

  async batchUpdate(data, { batchSize = 500, autoIncField = 'serial' } = {}, fields, callback) {
    let totalUpdated = 0;
    let lastId = 0;

    while (true) {
      const rows = await this.clone()
        .clearSelect()
        .clearOrder()
        .clearPage()
        .select(autoIncField)
        .select(fields)
        .where({ [autoIncField]: { '>': lastId } })
        .orderBy(autoIncField, 'ASC')
        .limit(batchSize)
        .find();

      if (!rows.length) break;
      const ids = rows.map((r) => r[autoIncField]);
      lastId = ids[ids.length - 1];

      await this.clone()
        .clearWhere()
        .clearSelect()
        .clearOrder()
        .clearPage()
        .where({ [autoIncField]: { in: ids } })
        .update(data, { all: true });

      totalUpdated += rows.length;
      if (callback) await callback(rows);
    }

    return totalUpdated;
  }

  async batchDelete({ batchSize = 500, autoIncField = 'serial' } = {}, fields, callback) {
    let totalDeleted = 0;
    let lastId = 0;

    while (true) {
      const rows = await this.clone()
        .clearSelect()
        .clearOrder()
        .clearPage()
        .select(autoIncField)
        .select(fields)
        .where({ [autoIncField]: { '>': lastId } })
        .orderBy(autoIncField, 'ASC')
        .limit(batchSize)
        .find();

      if (!rows.length) break;
      const ids = rows.map((r) => r[autoIncField]);
      lastId = ids[ids.length - 1];

      await this.clone()
        .clearWhere()
        .clearSelect()
        .clearOrder()
        .clearPage()
        .where({ [autoIncField]: { in: ids } })
        .delete({ all: true });

      totalDeleted += rows.length;
      if (callback) await callback(rows);
    }

    return totalDeleted;
  }

  /*
  UPDATE users SET score = score + ?, view_count = view_count + ?
  WHERE id = ?
  [ 1, 3, 5 ]
  */
  async increment(sets, { all = false } = {}) {
    if (!all && !this._wheres.length) throw new Error('Unsafe increment: missing WHERE');

    const keys = Object.keys(sets);
    if (!keys.length) return null;

    const setSql = keys.map((k) => `${k} = ${k} + ?`).join(', ');
    const params = keys.map((k) => sets[k]);

    let sql = `UPDATE ${this._table} SET ${setSql}`;

    const whereClauses = [];
    for (const w of this._wheres) {
      if (w.clause) {
        whereClauses.push(w.clause);
        if (w.params) params.push(...w.params);
      }
    }

    if (whereClauses.length) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    return await this.db.run(sql, params);
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
  async batchDiffUpdate(updateRules, conditions = {}) {
    if (!conditions || !Object.keys(conditions).length)
      throw new Error(
        'batchDiffUpdate: missing conditions — updating entire table is not allowed.',
      );

    const valueParams = [];
    const setFragments = [];

    for (const { field, match, items } of updateRules) {
      const caseSql = items.map(() => `WHEN ${match} = ? THEN ?`).join(' ');
      setFragments.push(`${field} = (CASE ${caseSql} END)`);
      for (const row of items) {
        valueParams.push(row[match], row[field]);
      }
    }

    const { clause: whereClauseRaw, params: whereParams } = this._parseWhere(conditions);
    const whereClause = whereClauseRaw ? `WHERE ${whereClauseRaw}` : '';

    const sql = `UPDATE ${this._table} SET ${setFragments.join(', ')} ${whereClause}`;
    return await this.db.run(sql, [...valueParams, ...whereParams]);
  }
}

// ===== 导出 =====
export const db = (table) => new DatabaseChain(table);
export const runSql = (sql, params) => database.run(sql, params);
export const getSql = (sql, params) => database.get(sql, params);
export const allSql = (sql, params) => database.all(sql, params);
export const scoreSql = DatabaseChain.scoreSql;
export const searchSql = DatabaseChain.searchSql;
