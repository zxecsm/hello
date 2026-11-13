import _f from '../utils/fs/f.js';
import { db, runSql } from '../utils/db/sqlite.js';
import appConfig from '../config/index.js';
import initDatabase from './init.js';

(async () => {
  const dataPath = appConfig.dataDir(); // 数据目录
  try {
    const exportPath = `${dataPath}/db.json`; // 导出文件路径
    const tables = JSON.parse((await _f.fsp.readFile(exportPath)).toString());

    await initDatabase(1); // 初始化数据库

    // 插入数据
    for (const { name, data } of tables) {
      runSql(`DELETE FROM sqlite_sequence WHERE name=?;`, [name]); // 从头开始自增
      db(name).insertMany(
        data.map((item) => {
          delete item.serial;
          return item;
        }),
      );
      console.log(`insert ${name} success`); // eslint-disable-line no-console
    }

    // eslint-disable-next-line no-console
    console.log(`import db success`);
  } catch (error) {
    await _f.del(`${dataPath}/db`);
    // eslint-disable-next-line no-console
    console.error(`import db error: ${error.message}`);
  } finally {
    process.exit(0);
  }
})();
