import _f from '../utils/f.js';
import _path from '../utils/path.js';
import { batchInsertData } from '../utils/sqlite.js';
import appConfig from './config.js';
import initDatabase from './initDatabase.js';

(async () => {
  const dataPath = _path.normalize(appConfig.appData, '/data'); // 数据目录
  try {
    const exportPath = `${dataPath}/db.json`; // 导出文件路径
    const tables = JSON.parse((await _f.fsp.readFile(exportPath)).toString());

    await initDatabase(1); // 初始化数据库

    // 插入数据
    for (const { name, data } of tables) {
      await batchInsertData(
        name,
        data,
        ['last_play', 'playing_list', 'song_list', 'user'].includes(name)
          ? 'account'
          : 'id'
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
