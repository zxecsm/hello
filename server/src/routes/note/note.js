import MarkdownIt from 'markdown-it';
import markdownItSub from 'markdown-it-sub'; // 下标
import markdownItSup from 'markdown-it-sup'; // 上标
import markdownItMark from 'markdown-it-mark'; // 高亮
import markdownItIns from 'markdown-it-ins'; // 插入（下划线）
import markdownItTaskCheckbox from 'markdown-it-task-checkbox'; // 复选框
import markdownItFootnote from 'markdown-it-footnote'; // 脚注
import markdownItDeflist from 'markdown-it-deflist'; // 定义列表
import markdownItAbbr from 'markdown-it-abbr'; // 缩写
import { full as markdownItEmoji } from 'markdown-it-emoji'; // emoji
import markdownItContainer from 'markdown-it-container'; // ::: 容器

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

// ---------------- markdown 转纯文本 + 提取图片 ----------------
// 列表页只需要「纯文本预览 + 前 6 张图片」，不需要 HTML 和 DOM。
// 这里走 markdown-it 的 token 流：插件与前端 web/src/js/utils/md.worker.js 完全一致，
// 所以下标/上标/高亮/插入线/任务框/脚注/定义列表/缩写/emoji/::: 容器都能正确识别；
// 相比原来的 md.render + cheerio.load + $.text()，省掉一次 HTML 渲染和两次 DOM 解析。
const md = new MarkdownIt({
  // 与前端保持一致：放行原始 HTML（笔记里常用 <kbd>/<mark>），自动链接，单个换行即换行
  html: true,
  linkify: true,
  breaks: true,
});

md.use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItMark)
  .use(markdownItIns)
  .use(markdownItFootnote)
  .use(markdownItDeflist)
  .use(markdownItAbbr)
  .use(markdownItEmoji)
  .use(markdownItTaskCheckbox, { disabled: true, divWrap: false });

// ::: tip / info / warning / danger / details 自定义容器
['tip', 'info', 'warning', 'danger', 'details'].forEach((name) => {
  md.use(markdownItContainer, name, {
    validate: (params) => params.trim().split(/\s+/)[0] === name,
  });
});

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&hellip;': '…',
  '&middot;': '·',
};

// 原始 HTML 片段转纯文本：<kbd>Ctrl</kbd> 取 Ctrl，<br> 当换行，顺带收集内嵌的 <img>
function htmlToText(html, pushImg) {
  return html
    .replace(/<img\b[^<>]*>/gi, (tag) => {
      const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      const alt = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
      if (src) pushImg(src[1] ?? src[2] ?? src[3], (alt && (alt[1] ?? alt[2] ?? alt[3])) || '');
      return '';
    })
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[a-zA-Z/!][^<>]{0,2000}>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp|mdash|hellip|middot);/g, (m) => ENTITIES[m]);
}

// 列表接口每次都会把当前页的笔记重新解析一遍，内容没变时没必要重复算。
// 以 markdown 原文为键做个小 LRU：笔记改了自然换 key，不需要额外失效逻辑。
const previewCache = new Map();
const PREVIEW_CACHE_MAX = 200;
const PREVIEW_CACHE_MAX_LENGTH = 30000; // 超长笔记不进缓存，避免占内存

/**
 * markdown 转纯文本，并提取图片
 * @param {string} content markdown 原文
 * @returns {{ text: string, images: { src: string, alt: string }[] }} 纯文本 + 最多 6 张去重图片
 */
export function parseMarkDown(content) {
  const images = [];
  const text = [];

  if (!content || typeof content !== 'string') return { text: '', images };

  const cached = previewCache.get(content);
  if (cached) {
    // 命中后移到队尾，保持 LRU 顺序
    previewCache.delete(content);
    previewCache.set(content, cached);
    return cached;
  }

  // 与前端图片列表一致：按出现顺序，最多 6 张，去重
  const pushImg = (src, alt) => {
    if (!src || images.length >= 6 || images.some((item) => item.src === src)) return;
    images.push({ src, alt: alt || '' });
  };

  // 只取有文字的 token；成对的 _open/_close 标记不产生内容
  const walk = (tokens) => {
    for (const token of tokens) {
      switch (token.type) {
        case 'text':
        case 'code_inline':
        case 'code_block':
        case 'fence':
          text.push(token.content);
          break;
        case 'softbreak':
        case 'hardbreak':
          text.push('\n');
          break;
        case 'image':
          pushImg(token.attrGet('src'), token.content);
          break;
        case 'html_inline':
        case 'html_block':
          text.push(htmlToText(token.content, pushImg));
          break;
        case 'inline':
          // 图片、链接、强调、行内代码等都在 inline 的子 token 里
          walk(token.children || []);
          break;
        default:
          // ::: tip 标题 这类容器标题只存在 token.info 里，补回预览
          if (/^container_.+_open$/.test(token.type)) {
            text.push(token.info.trim().split(/\s+/).slice(1).join(' '));
          }
          break;
      }
    }
  };

  try {
    walk(md.parse(content, {}));
  } catch {
    // 解析失败时退化成原文，至少不影响列表和搜索
    return { text: content, images };
  }

  const result = { text: text.join('').trim(), images };

  if (content.length <= PREVIEW_CACHE_MAX_LENGTH) {
    previewCache.set(content, result);
    if (previewCache.size > PREVIEW_CACHE_MAX) {
      previewCache.delete(previewCache.keys().next().value);
    }
  }

  return result;
}
