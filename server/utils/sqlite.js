// const sqlite3 = require('sqlite3').verbose();
const sqlite3 = require('sqlite3');
const configObj = require('../data/config');
const _f = require('./f');
_f.c.mkdirSync(`${configObj.filepath}/data`, { recursive: true });
const db = new sqlite3.Database(`${configObj.filepath}/data/hello.db`);
function allSqlite(sql, valArr) {
  return new Promise(async (resolve, reject) => {
    db.all(sql, valArr, function (err, rows) {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}
function runSqlite(sql, valArr) {
  return new Promise(async (resolve, reject) => {
    db.run(sql, valArr, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}
// 插入
function insertData(table, datas) {
  //INSERT INTO test (name,data) VALUES (?,?),(?,?) [ '25331a1e05ccec0', 'xxxxx', '25331a1e05def40', 'xxxxx' ]
  const keyArr = Object.keys(datas[0]),
    valsArr = new Array(datas.length).fill(
      `(${new Array(keyArr.length).fill('?').join(',')})`
    ),
    valArr = [];
  datas.forEach((item) => {
    keyArr.forEach((y) => {
      valArr.push(item[y]);
    });
  });
  const sql = `INSERT INTO ${table} (${keyArr.join(',')}) VALUES ${valsArr.join(
    ','
  )}`;
  return runSqlite(sql, valArr);
}
//查询
function queryData(table, strItem, where = '', valArr = []) {
  //SELECT * FROM test WHERE name LIKE ? [ '%%' ]
  const sql = `SELECT ${strItem} FROM ${table} ${where}`;
  return allSqlite(sql, valArr);
}
// 更新一条数据
function updateData(table, sets, where = '', varr = []) {
  //UPDATE test SET data = ? WHERE name LIKE ? [ 'xx', '%%' ]
  const keyArr = Object.keys(sets),
    valsArr = keyArr.map((item) => `${item} = ?`),
    valArr = keyArr.map((item) => sets[item]),
    sql = `UPDATE ${table} SET ${valsArr.join(',')} ${where}`;
  return runSqlite(sql, [...valArr, ...varr]);
}
// 删除一条数据
function deleteData(table, where = '', valArr = []) {
  //DELETE FROM test WHERE name LIKE ? [ '%%' ]
  const sql = `DELETE FROM ${table} ${where}`;
  return runSqlite(sql, valArr);
}
//批量条件更新不同值
function batchUpdateData(table, arr, whe) {
  //UPDATE bookmk SET num = (CASE WHEN id="24f341b42971f40" THEN "0" WHEN id="252d48475294000" THEN "1" END) WHERE id="24f341b42971f40" OR id="252d48475294000"
  const vt = [];
  const wa = [];
  arr.forEach((item, ids) => {
    const { key, where, data } = item;
    const wt = [];
    data.forEach((y) => {
      wt.push(`WHEN ${where}="${y[where]}" THEN "${y[key]}"`);
      if (ids === 0) {
        if (whe) {
          wa.push(`(${whe} AND ${where}="${y[where]}")`);
        } else {
          wa.push(`${where}="${y[where]}"`);
        }
      }
    });
    vt.push(`${key} = (CASE ${wt.join(' ')} END)`);
  });
  const sql = `UPDATE ${table} SET ${vt.join(',')} WHERE ${wa.join(' OR ')}`;
  return runSqlite(sql);
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
// await batchUpdateData('bookmk', [ob])
module.exports = {
  runSqlite,
  allSqlite,
  batchUpdateData,
  insertData,
  updateData,
  deleteData,
  queryData,
};
