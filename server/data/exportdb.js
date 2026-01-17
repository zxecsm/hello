import _f from '../utils/f.js';
import { allSql } from '../utils/sqlite.js';
import appConfig from './config.js';

(async () => {
  try {
    const dataPath = appConfig.dataDir(); // 数据目录
    const exportPath = `${dataPath}/db.json`; // 导出文件路径

    // 导出数据库到JSON文件
    const tables = [];
    const tableList = await allSql(`SELECT name FROM sqlite_master WHERE type='table';`);
    for (const table of tableList) {
      const list = await allSql(`SELECT * FROM ${table.name}`);
      table.data = list;
      tables.push(table);
      // eslint-disable-next-line no-console
      console.log(`export table ${table.name} success`);
    }
    await _f.writeFile(exportPath, JSON.stringify(tables));

    // 备份原数据库
    const bak_path = `${dataPath}/db_bak`;
    await _f.del(bak_path);
    await _f.rename(`${dataPath}/db`, bak_path);

    // eslint-disable-next-line no-console
    console.log('export db success => ' + exportPath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('export db error => ' + error.message);
  } finally {
    process.exit(0);
  }
})();
