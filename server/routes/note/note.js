import MarkdownIt from 'markdown-it';
import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';
import _path from '../../utils/path.js';

import { errLog, formatDate } from '../../utils/utils.js';

import { getRootDir } from '../file/file.js';
import cheerio from '../bmk/cheerio.js';

// 获取笔记历史版本记录文件夹
export function getNoteHistoryDir(account, noteId) {
  return _path.normalize(
    getRootDir(account),
    appConfig.noteHistoryDirName,
    noteId
  );
}

// 保存笔记历史
export async function saveNoteHistory(req, noteId, content) {
  try {
    if (!content) return;

    const { account } = req._hello.userinfo;

    const noteDir = getNoteHistoryDir(account, noteId);

    const notePath = _path.normalize(
      noteDir,
      `${formatDate({ template: '{0}_{1}_{2}-{3}_{4}_{5}' })}.md`
    );

    await _f.mkdir(noteDir);

    await _f.fsp.writeFile(notePath, content);
  } catch (error) {
    errLog(req, `保存笔记历史版本失败(${error})`);
  }
}

const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});
export function parseMarkDown(content) {
  const res = {
    text: content,
    images: [],
  };

  try {
    const $ = cheerio.load(md.render(content));
    res.text = $.text();
    let count = 0;
    $('img').each((_, el) => {
      if (count >= 6) return false;
      const $el = $(el);
      const src = $el.attr('src');
      if (src) {
        const alt = $el.attr('alt') || '';
        res.images.push({ src, alt });
        count++;
      }
    });
  } catch {}

  return res;
}
