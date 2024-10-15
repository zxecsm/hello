import configObj from '../../data/config.js';
import { resolve } from 'path';
import _f from '../../utils/f.js';
import { getDirname } from '../../utils/utils.js';
import _path from '../../utils/path.js';

const __dirname = getDirname(import.meta);

export async function getSearchConfig() {
  const p = _path.normalize(`${configObj.filepath}/data/searchConfig.json`);
  const logop = _path.normalize(`${configObj.filepath}/searchlogo`);
  if (!_f.fs.existsSync(logop)) {
    await _f.cp(resolve(__dirname, `../../img/searchlogo`), logop);
  }
  if (!_f.fs.existsSync(p)) {
    await _f.cp(resolve(__dirname, `../../data/searchConfig.json`), p);
  }
  return JSON.parse(await _f.fsp.readFile(p));
}
