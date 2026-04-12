import MarkdownIt from 'markdown-it';
import * as cheerio from 'cheerio';
import appConfig from '../../data/config.js';
import _f from '../../utils/f.js';
import _path from '../../utils/path.js';

import { formatDate, writelog } from '../../utils/utils.js';

// 保存笔记历史
export async function saveNoteHistory(res, noteId, content) {
  try {
    if (!content) return;

    const { account } = res.locals.hello.userinfo;

    const noteDir = appConfig.noteHistoryDir(account, noteId);

    const notePath = _path.normalizeNoSlash(
      noteDir,
      `${formatDate({ template: '{0}_{1}_{2}-{3}_{4}_{5}' })}.md`,
    );

    await _f.writeFile(notePath, content);
  } catch (error) {
    writelog(res, `保存笔记历史版本失败(${error})`, 500);
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
