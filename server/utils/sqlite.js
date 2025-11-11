import sqlite3 from 'sqlite3';

import appConfig from '../data/config.js';

import _f from './f.js';

import { batchTask } from './utils.js';
import _path from './path.js';
import nanoid from './nanoid.js';

// 如果目录不存在则创建目录
_f.fs.mkdirSync(_path.normalize(appConfig.appData, '/data/db'), {
  recursive: true,
});

// 初始化数据库连接
const db = new sqlite3.Database(
  _path.normalize(appConfig.appData, '/data/db/hello.db'),
  (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err.message);
    }
  }
);

// 启用 WAL 模式
db.exec(
  `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA wal_autocheckpoint = 500;
  PRAGMA cache_size = 2000;
  `,
  (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('Error enabling WAL mode:', err.message);
    }
  }
);

// 事务
export async function executeInTransaction(callback) {
  try {
    // 开始事务
    await runSqlite('BEGIN TRANSACTION');

    // 执行回调函数中的数据库操作
    await callback();

    // 提交事务
    await runSqlite('COMMIT');
  } catch (error) {
    await runSqlite('ROLLBACK');
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

// 辅助函数：执行 SELECT 查询
export function allSqlite(sql, valArr = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, valArr, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 辅助函数：执行 INSERT/UPDATE/DELETE 查询
export function runSqlite(sql, valArr = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, valArr, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// 插入数据
export function insertData(table, datas, idField = 'id') {
  const create_at = Date.now();
  datas = datas.map((item) => {
    if (!item.hasOwnProperty('create_at')) {
      item.create_at = create_at;
    }
    if (!item.hasOwnProperty(idField)) {
      item[idField] = nanoid();
    }
    return item;
  });

  const keyArr = Object.keys(datas[0]);
  const valsArr = datas.map(() => `(${keyArr.map(() => '?').join(',')})`);
  const valArr = datas.flatMap((item) => keyArr.map((key) => item[key]));

  const sql = `INSERT INTO ${table} (${keyArr.join(',')}) VALUES ${valsArr.join(
    ','
  )}`;
  return runSqlite(sql, valArr);
}

// 分批插入数据
export async function batchInsertData(
  table,
  datas,
  idField = 'id',
  limit = 500
) {
  await batchTask(async (offset) => {
    const list = datas.slice(offset, offset + limit);

    if (list.length === 0) return false;

    await insertData(table, list, idField);

    return true;
  }, limit);
}

// 查询数据
export function queryData(table, fields, where = '', valArr = []) {
  const sql = `SELECT ${fields} FROM ${table} ${where}`;
  return allSqlite(sql, valArr);
}

// 获取表的总行数
export async function getTableRowCount(table, where = '', valArr = []) {
  const sql = `SELECT COUNT(*) AS count FROM ${table} ${where}`;
  const rows = await allSqlite(sql, valArr);
  return rows[0]?.count || 0;
}

// 获取随机一条数据
export async function getRandomRow(table, fields, where = '', valArr = []) {
  // 获取总行数
  const total = await getTableRowCount(table, where, valArr);

  if (total === 0) {
    return null; // 如果表中没有数据，返回 null
  }

  // 生成随机偏移量
  const offset = Math.floor(Math.random() * total);

  // 查询随机行
  const rows = await queryData(table, fields, `${where} LIMIT ? OFFSET ?`, [
    ...valArr,
    1,
    offset,
  ]);
  return rows[0] || null;
}

// 更新数据
export function updateData(table, sets, where = '', varr = []) {
  const keyArr = Object.keys(sets);
  const valsArr = keyArr.map((key) => `${key} = ?`);
  const valArr = keyArr.map((key) => sets[key]);

  const sql = `UPDATE ${table} SET ${valsArr.join(',')} ${where}`;

  return runSqlite(sql, [...valArr, ...varr]);
}

// 分批更新
export async function batchUpdateData(
  table,
  sets,
  where = '',
  valArr = [],
  limit = 800
) {
  let lastSerial = 0;

  while (true) {
    const condition = where ? `${where} AND serial > ?` : `WHERE serial > ?`;
    const sql = `${condition} ORDER BY serial LIMIT ?`;

    const rows = await queryData(table, 'serial', sql, [
      ...valArr,
      lastSerial,
      limit,
    ]);

    if (rows.length === 0) break;

    const serials = rows.map((row) => row.serial);

    const whereClause =
      where && !/\bIN\s*\(/i.test(where)
        ? `${where} AND serial IN (${fillString(serials.length)})`
        : where
        ? where
        : `WHERER serial IN (${fillString(serials.length)})`;

    await updateData(table, sets, whereClause, [...valArr, ...serials]);

    lastSerial = serials[serials.length - 1];
  }
}

// 字段自增
export function incrementField(table, sets, where = '', varr = []) {
  const keyArr = Object.keys(sets);
  const valsArr = keyArr.map((key) => `${key} = ${key} + ?`);
  const valArr = keyArr.map((key) => sets[key]);

  const sql = `UPDATE ${table} SET ${valsArr.join(',')} ${where}`;

  return runSqlite(sql, [...valArr, ...varr]);
}

// 删除数据
export async function deleteData(table, where = '', valArr = []) {
  const sql = `DELETE FROM ${table} ${where}`;

  return runSqlite(sql, valArr);
}

// 分批删除
export async function batchDeleteData(
  table,
  where = '',
  valArr = [],
  limit = 800
) {
  let lastSerial = 0;

  while (true) {
    const condition = where ? `${where} AND serial > ?` : `WHERE serial > ?`;
    const sql = `${condition} ORDER BY serial LIMIT ?`;

    const rows = await queryData(table, 'serial', sql, [
      ...valArr,
      lastSerial,
      limit,
    ]);

    if (rows.length === 0) break;

    const serials = rows.map((row) => row.serial);

    const whereClause =
      where && !/\bIN\s*\(/i.test(where)
        ? `${where} AND serial IN (${fillString(serials.length)})`
        : where
        ? where
        : `WHERE serial IN (${fillString(serials.length)})`;

    await deleteData(table, whereClause, [...valArr, ...serials]);

    lastSerial = serials[serials.length - 1];
  }
}

// 批量条件更新不同值
export function batchDiffUpdateData(table, data, where = '', valArr = []) {
  const setClauses = [];
  const values = [];

  // 遍历要更新的每个字段
  data.forEach(({ key, where, data }) => {
    // 为 SET 语句构建 WHEN-THEN 语句
    const caseStatements = data.map(() => `WHEN ${where} = ? THEN ?`).join(' ');

    // 添加到 SET 子句中
    setClauses.push(`${key} = (CASE ${caseStatements} END)`);

    // 将 WHERE 子句的参数和 SET 中的参数添加到 values 数组
    data.forEach((item) => {
      values.push(item[where], item[key]); // 第一个是 WHERE 条件，第二个是要更新的值
    });
  });

  // 构建完整的 SQL 语句
  const sql = `UPDATE ${table} SET ${setClauses.join(', ')} ${where}`;

  return runSqlite(sql, [...values, ...valArr]);
}
// const ob = {
//   where: 'id',
//   key: 'num',
//   data: []
// }
// arr.forEach((item, i) => {
//   ob.data.push({
//     id: item.id,
//     num: i
//   })
// })

// 计算相关性分数的函数
export function createScoreSql(splitWord, keys) {
  if (!splitWord.length || !keys.length) {
    return { sql: '', valArr: [] };
  }

  // 为模糊查询搜索词添加 %
  const likeWords = splitWord.map((word) => `%${word}%`);

  const { valArr, scoreArr } = keys.reduce(
    (acc, key) => {
      // 计算相关性分数
      splitWord.forEach((_, index) => {
        // 如果是第一个词，则优先级加10
        const scoreWeight = index === 0 ? 10 : 1;
        acc.scoreArr.push(
          `(CASE WHEN LOWER(${key}) LIKE LOWER(?) THEN ${scoreWeight} ELSE 0 END)`
        );
      });

      acc.valArr.push(...likeWords);
      return acc;
    },
    { valArr: [], scoreArr: [] }
  );

  return {
    // 返回 SQL 查询字符串
    sql: `ORDER BY (${scoreArr.join(' + ')}) DESC`,
    valArr,
  };
}

// 生成搜索sql
export function createSearchSql(splitWord, keys) {
  if (!splitWord.length || !keys.length) {
    return { sql: '1=1', valArr: [] };
  }

  // 为模糊查询搜索词添加 %
  const likeWords = splitWord.map((word) => `%${word}%`);

  const { sqlArr, valArr } = keys.reduce(
    (acc, key) => {
      // 构建 WHERE 条件，使用 LOWER 来忽略大小写
      splitWord.forEach(() => {
        acc.sqlArr.push(`LOWER(${key}) LIKE LOWER(?)`);
      });

      acc.valArr.push(...likeWords);
      return acc;
    },
    { sqlArr: [], valArr: [] }
  );

  return {
    // 返回 SQL 查询字符串
    sql: sqlArr.join(' OR '),
    valArr,
  };
}

// 填充sql?
export function fillString(len) {
  return new Array(len).fill('?').join(',');
}
