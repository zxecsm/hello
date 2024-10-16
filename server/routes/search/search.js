import configObj from '../../data/config.js';
import { resolve } from 'path';
import _f from '../../utils/f.js';
import { getDirname } from '../../utils/utils.js';
import _path from '../../utils/path.js';

const __dirname = getDirname(import.meta);

export async function getSearchConfig() {
  const p = _path.normalize(`${configObj.filepath}/data/searchConfig.json`);
  const logop = _path.normalize(`${configObj.filepath}/searchlogo`);
  if (!(await _f.exists(logop))) {
    await _f.cp(resolve(__dirname, `../../img/searchlogo`), logop);
  }
  if (!(await _f.exists(p))) {
    await _f.cp(resolve(__dirname, `../../data/searchConfig.json`), p);
  }
  return JSON.parse(await _f.fsp.readFile(p));
}
