import MarkdownIt from 'markdown-it';
import * as cheerio from 'cheerio';
import appConfig from '../../config/index.js';
import _f from '../../utils/fs/f.js';
import _path from '../../utils/common/path.js';

import { formatDate, writelog } from '../../utils/common/utils.js';

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

// 笔记编辑草稿路径
function noteEditingPath(account, noteId) {
  return appConfig.noteHistoryDir(account, noteId, 'editing.md');
}

// 保存笔记编辑草稿
export async function saveNoteEditing(account, noteId, content) {
  await _f.writeFile(noteEditingPath(account, noteId), content);
}

// 读取笔记编辑草稿（不存在返回 null）
export async function readNoteEditing(account, noteId) {
  const notePath = noteEditingPath(account, noteId);
  if (!(await _f.exists(notePath))) return null;
  return (await _f.readFile(notePath, null, '')).toString();
}

// 清除笔记编辑草稿
export async function clearNoteEditing(account, noteId) {
  await _f.del(noteEditingPath(account, noteId));
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
