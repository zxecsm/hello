import _f from '../../utils/f.js';
import _path from '../../utils/path.js';

import { errLog, formatDate } from '../../utils/utils.js';

import { getRootDir } from '../file/file.js';

// 获取笔记历史版本记录文件夹
export function getNoteHistoryDir(account, noteId) {
  return _path.normalize(`${getRootDir(account)}/.noteHistory/${noteId}`);
}

// 保存笔记历史
export async function saveNoteHistory(req, noteId, content) {
  try {
    if (!content) return;

    const { account } = req._hello.userinfo;

    const noteDir = getNoteHistoryDir(account, noteId);

    const notePath = _path.normalize(
      `${noteDir}/${formatDate({ template: '{0}_{1}_{2}-{3}_{4}_{5}' })}.md`
    );

    await _f.mkdir(noteDir);

    await _f.fsp.writeFile(notePath, content);
  } catch (error) {
    errLog(req, `保存笔记历史版本失败(${error})`);
  }
}
