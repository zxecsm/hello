import sqlite3 from 'sqlite3';
import appConfig from '../data/config.js';
import _f from './f.js';
import _path from './path.js';

// DB 文件路径
const dbPath = appConfig.databaseDir('hello.db');
_f.fs.mkdirSync(_path.dirname(dbPath), { recursive: true });

// ===== SQLite 封装 =====
class DB {
  constructor(path) {
    this.db = new sqlite3.Database(path, (err) => {
      // eslint-disable-next-line no-console
      if (err) console.error('Open DB Error:', err.message);
    });

    // 优化性能
    this.db.exec(
      `
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA wal_autocheckpoint = 500;
      PRAGMA cache_size = 2000;
      PRAGMA temp_store = MEMORY;
      `,
      (err) => {
        // eslint-disable-next-line no-console
        if (err) console.error('PRAGMA Error:', err.message);
      }
    );
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

const database = new DB(dbPath);

// ===== 链式封装 =====
class Database {
  constructor(tableName) {
    this.db = database;
    this.reset();
    this._table = tableName.trim();
  }

  // 重置状态
  reset() {
    this._fields = [];
    this._wheres = [];
    this._joins = [];
    this._limit = {};
    this._offset = {};
    this._orders = [];
    return this;
  }

  // 克隆实例
  clone() {
    const copy = new this.constructor(this._table);
    copy._fields = this._fields.map((f) => ({ ...f }));
    copy._joins = this._joins.map((j) => ({ ...j }));
    copy._wheres = this._wheres.map((w) => ({ ...w }));
    copy._orders = this._orders.map((o) => ({ ...o }));
    copy._limit = { ...this._limit };
    copy._offset = { ...this._offset };
    return copy;
  }

  select(fields, params = [], { flag } = {}) {
    const f = Array.isArray(fields) ? fields.join(', ') : fields;
    this._fields.push({ clause: f, params, flag });
    return this;
  }

  clearSelect(flag) {
    if (flag) {
      this._fields = this._fields.filter((f) => f.flag !== flag);
    } else {
      this._fields = [];
    }

    return this;
  }

  static searchSql(words, fields) {
    if (!words?.length || !fields?.length) return { clause: '', params: [] };

    const clauseWords = words.map((w) => {
      const val = w && typeof w === 'object' ? w.value : w;
      return `%${val}%`;
    });

    const { scoreParts, params } = fields.reduce(
      (acc, field) => {
        words.forEach(() => {
          acc.scoreParts.push(`LOWER(${field}) LIKE LOWER(?)`);
        });

        acc.params.push(...clauseWords);
        return acc;
      },
      { scoreParts: [], params: [] }
    );

    return { clause: '(' + scoreParts.join(' OR ') + ')', params };
  }

  static scoreSql(words, fields) {
    if (!words?.length || !fields?.length) return { scoreSql: '', params: [] };

    const params = [];
    const scoreParts = [];

    fields.forEach((field) => {
      words.forEach((w) => {
        const val = w && typeof w === 'object' ? w.value : w;
        const weight = w && typeof w === 'object' ? w.weight || 1 : 1;

        scoreParts.push(
          `(CASE WHEN LOWER(${field}) LIKE LOWER(?) THEN ${weight} ELSE 0 END)`
        );
        params.push(`%${val}%`);
      });
    });

    return { scoreSql: `(${scoreParts.join(' + ')})`, params };
  }

  search(words, fields, { flag, sort = false } = {}) {
    const { clause: searchClause, params: searchParams } = Database.searchSql(
      words,
      fields
    );
    if (searchClause) this.whereRaw(searchClause, searchParams, { flag });

    if (sort) {
      const { scoreSql, params: scoreParams } = Database.scoreSql(
        words,
        fields
      );
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
    if (flag) {
      this._wheres = this._wheres.filter((w) => w.flag !== flag);
    } else {
      this._wheres = [];
    }

    return this;
  }

  _parseWhere(conditions) {
    const clauses = [];
    const params = [];

    for (const [key, value] of Object.entries(conditions)) {
      // --- OR ---
      if (key === '$or' && Array.isArray(value)) {
        const parts = value
          .map((v) => this._parseCondition(v))
          .filter((x) => x.clause);
        if (parts.length) {
          clauses.push(`(${parts.map((p) => p.clause).join(' OR ')})`);
          parts.forEach((p) => params.push(...p.params));
        }
        continue;
      }

      // --- AND ---
      if (key === '$and' && Array.isArray(value)) {
        const parts = value
          .map((v) => this._parseWhere(v))
          .filter((x) => x.clause);
        if (parts.length) {
          clauses.push(`(${parts.map((p) => p.clause).join(' AND ')})`);
          parts.forEach((p) => params.push(...p.params));
        }
        continue;
      }

      // --- 普通字段 ---
      const { clause, params: subParams } = this._parseCondition({
        [key]: value,
      });
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
        if ('raw' in val && 'value' in val) {
          operations = { '=': val };
        } else {
          operations = val;
        }
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
            clauses.push(
              `${key} ${op === 'like' ? 'LIKE' : 'NOT LIKE'} ${place}`
            );
            if (useParam) params.push(value);
            break;

          case 'in':
          case 'not':
            if (!Array.isArray(value) || !value.length) break;
            const ph = value.map(() => '?').join(',');
            clauses.push(`${key} ${op === 'in' ? 'IN' : 'NOT IN'} (${ph})`);
            params.push(...value);
            break;

          case 'isNull':
          case 'isNotNull':
            clauses.push(
              `${key} ${op === 'isNull' ? 'IS NULL' : 'IS NOT NULL'}`
            );
            break;

          case 'between':
          case 'notBetween':
            if (Array.isArray(value) && value.length === 2) {
              clauses.push(
                `${key} ${op === 'between' ? 'BETWEEN' : 'NOT BETWEEN'} ? AND ?`
              );
              params.push(value[0], value[1]);
            }
            break;

          default:
            const operator = this._mapOp(op);
            clauses.push(`${key} ${operator} ${place}`);
            if (useParam) params.push(value);
        }
      }
    }

    return { clause: clauses.join(' AND '), params };
  }

  _mapOp(op) {
    const ops = {
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
      '!=': '!=',
    };
    return ops[op] || '=';
  }

  orderBy(field, direction = 'ASC', { params = [], flag } = {}) {
    this._orders.push({
      field,
      direction: direction.toUpperCase(),
      flag,
      params,
    });
    return this;
  }

  clearOrder(flag) {
    if (flag) {
      this._orders = this._orders.filter((o) => o.flag !== flag);
    } else {
      this._orders = [];
    }
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
    this._limit = {};
    return this;
  }
  clearOffset() {
    this._offset = {};
    return this;
  }
  clearPage() {
    this.clearLimit();
    this.clearOffset();
    return this;
  }

  // ===== JOIN =====
  join(table, onConditions, { type = 'INNER', flag } = {}) {
    if (
      onConditions &&
      typeof onConditions === 'object' &&
      !Array.isArray(onConditions)
    ) {
      const { clause, params } = this._parseWhere(onConditions);
      if (clause) {
        this._joins.push({
          type: type.toUpperCase(),
          table,
          clause,
          params,
          flag,
        });
      } else {
        this._joins.push({
          type: 'CROSS',
          table,
          clause: '',
          params: [],
          flag,
        });
      }
    } else if (!onConditions) {
      this._joins.push({ type: 'CROSS', table, clause: '', params: [], flag });
    }

    return this;
  }

  joinRaw(
    table,
    onConditions = '',
    params = [],
    { type = 'INNER', flag } = {}
  ) {
    if (onConditions && typeof onConditions === 'string') {
      this._joins.push({
        type: type.toUpperCase(),
        table,
        clause: onConditions,
        params,
        flag,
      });
    } else {
      this._joins.push({ type: 'CROSS', table, clause: '', params: [], flag });
    }
    return this;
  }

  clearJoin(flag) {
    if (flag) {
      this._joins = this._joins.filter((j) => j.flag !== flag);
    } else {
      this._joins = [];
    }
    return this;
  }

  _buildSelectSQL() {
    // SELECT 字段
    const fields = this._fields.length
      ? this._fields.map((f) => f.clause).join(', ')
      : '*';

    let sql = `SELECT ${fields} FROM ${this._table}`;
    const params = [];

    // SELECT params
    for (const f of this._fields) {
      if (f.params && f.params.length) {
        params.push(...f.params);
      }
    }

    // JOIN
    if (this._joins.length) {
      for (const j of this._joins) {
        sql += ` ${j.type} JOIN ${j.table}`;
        if (j.clause) {
          sql += ` ON ${j.clause}`;
          if (j.params && j.params.length) params.push(...j.params);
        }
      }
    }

    // WHERE
    const allWhereClauses = this._wheres.map((w) => w.clause).filter(Boolean);
    if (allWhereClauses.length) {
      sql += ` WHERE ${allWhereClauses.join(' AND ')}`;
      for (const w of this._wheres) {
        if (w.params && w.params.length) params.push(...w.params);
      }
    }

    // ORDER
    if (this._orders.length) {
      const orderClause = this._orders
        .map((o) => `${o.field} ${o.direction}`)
        .join(', ');
      sql += ` ORDER BY ${orderClause}`;

      for (const o of this._orders) {
        if (o.params && o.params.length) {
          params.push(...o.params);
        }
      }
    }

    // LIMIT & OFFSET
    if (this._limit.clause) {
      sql += ` ${this._limit.clause}`;
      if (this._limit.params !== undefined) params.push(this._limit.params);
    }
    if (this._offset.clause) {
      sql += ` ${this._offset.clause}`;
      if (this._offset.params !== undefined) params.push(this._offset.params);
    }

    return { sql, params };
  }

  echoSql() {
    const copy = this.clone();
    const { sql, params } = copy._buildSelectSQL();
    // eslint-disable-next-line no-console
    console.log(sql, params);
    return this;
  }

  async find() {
    const copy = this.clone();
    const { sql, params } = copy._buildSelectSQL();
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
    let lastResult = null;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const placeholders = batch
        .map(() => `(${keys.map(() => '?').join(',')})`)
        .join(',');
      const sql = `INSERT INTO ${this._table} (${keys.join(
        ','
      )}) VALUES ${placeholders}`;
      lastResult = await this.db.run(sql, batch.flatMap(Object.values));
    }
    return lastResult;
  }

  async update(data, { all = false } = {}) {
    if (!data || !Object.keys(data).length) return 0;

    if (!all && !this._wheres.length)
      throw new Error('Unsafe UPDATE: missing WHERE');

    const copy = this.clone();
    const sets = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(',');
    const setParams = Object.values(data);

    let sql = `UPDATE ${copy._table} SET ${sets}`;

    const whereClauses = copy._wheres.map((w) => w.clause).filter(Boolean);
    const whereParams = copy._wheres.flatMap((w) => w.params);

    if (whereClauses.length) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    return this.db.run(sql, [...setParams, ...whereParams]);
  }

  async delete({ all = false } = {}) {
    if (!all && !this._wheres.length)
      throw new Error('Unsafe DELETE: missing WHERE');

    const copy = this.clone();
    let sql = `DELETE FROM ${copy._table}`;
    const params = [];

    const whereClauses = copy._wheres.map((w) => w.clause).filter(Boolean);
    const whereParams = copy._wheres.flatMap((w) => w.params);

    if (whereClauses.length) {
      sql += ' WHERE ' + whereClauses.join(' AND ');
      params.push(...whereParams);
    }

    return this.db.run(sql, params);
  }

  async getRandom({ limit = 1 } = {}) {
    const total = await this.clone().count();

    if (!total) return [];
    if (total <= limit) return this.clone().find();

    return this.clone()
      .page(limit, Math.floor(Math.random() * (total - limit) + 1))
      .find();
  }

  async getRandomOne() {
    return (await this.getRandom({ limit: 1 }))[0] || null;
  }

  async count() {
    const row = await this.clone()
      .clearPage()
      .clearSelect()
      .select(`COUNT(*) AS c`)
      .findOne();
    return row?.c || 0;
  }

  async batchUpdate(data, { batchSize = 500, autoIncField = 'serial' } = {}) {
    let totalUpdated = 0;
    let lastId = 0;

    while (true) {
      const rows = await this.clone()
        .clearSelect()
        .clearOrder()
        .clearPage()
        .select(autoIncField)
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
    }

    return totalUpdated;
  }

  async batchDelete({ batchSize = 500, autoIncField = 'serial' } = {}) {
    let totalDeleted = 0;
    let lastId = 0;

    while (true) {
      const rows = await this.clone()
        .clearSelect()
        .clearOrder()
        .clearPage()
        .select(autoIncField)
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
    }

    return totalDeleted;
  }

  /*
  UPDATE users SET score = score + ?, view_count = view_count + ?
  WHERE id = ?
  [ 1, 3, 5 ]
  */
  async increment(sets, { all = false } = {}) {
    if (!all && !this._wheres.length)
      throw new Error('Unsafe increment: missing WHERE');

    const keys = Object.keys(sets);
    if (!keys.length) return null;

    const setSql = keys.map((k) => `${k} = ${k} + ?`).join(', ');
    const params = keys.map((k) => sets[k]);

    let sql = `UPDATE ${this._table} SET ${setSql}`;

    if (this._wheres.length) {
      sql += ' WHERE ' + this._wheres.map((w) => w.clause).join(' AND ');
      this._wheres.forEach((w) => params.push(...w.params));
    }

    return this.db.run(sql, params);
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
    if (!Object.keys(conditions || {}).length)
      throw new Error(
        'batchDiffUpdate: missing conditions — updating entire table is not allowed.'
      );

    const valueParams = [];
    const setFragments = [];

    for (const { field, match, items } of updateRules) {
      const caseSql = items.map(() => `WHEN ${match} = ? THEN ?`).join(' ');
      setFragments.push(`${field} = (CASE ${caseSql} END)`);

      items.forEach((row) => valueParams.push(row[match], row[field]));
    }

    const { clause: whereClauseRaw, params: whereParams } =
      this._parseWhere(conditions);
    const whereClause = whereClauseRaw ? `WHERE ${whereClauseRaw}` : '';

    const sql = `UPDATE ${this._table} SET ${setFragments.join(
      ', '
    )} ${whereClause}`;
    return this.db.run(sql, [...valueParams, ...whereParams]);
  }
}

// ===== 导出 =====
export const db = (table) => new Database(table);
export const runSql = (sql, params) => database.run(sql, params);
export const getSql = (sql, params) => database.get(sql, params);
export const allSql = (sql, params) => database.all(sql, params);
export const scoreSql = Database.scoreSql;
export const searchSql = Database.searchSql;
