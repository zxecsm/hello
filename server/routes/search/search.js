import appConfig from '../../data/config.js';
import { resolve } from 'path';
import _f from '../../utils/f.js';
import { getDirname } from '../../utils/utils.js';
import _path from '../../utils/path.js';

const __dirname = getDirname(import.meta);

// 获取搜索引擎和翻译接口配置
export async function getSearchConfig() {
  const p = _path.normalize(appConfig.appData, '/data/searchConfig.json');
  const logop = _path.normalize(appConfig.appData, 'searchlogo');
  if (!(await _f.exists(logop))) {
    await _f.cp(resolve(__dirname, `../../img/searchlogo`), logop);
  }
  if (!(await _f.exists(p))) {
    await _f.cp(resolve(__dirname, `../../data/searchConfig.json`), p);
  }
  return JSON.parse(await _f.fsp.readFile(p));
}
