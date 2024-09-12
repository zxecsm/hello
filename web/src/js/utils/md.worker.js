import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import markdownItSub from 'markdown-it-sub'; // 下标
import markdownItSup from 'markdown-it-sup'; // 上标
import markdownItMark from 'markdown-it-mark'; // 高亮
import markdownItCheckbox from 'markdown-it-task-checkbox'; // 复选框
import imgLoadImg from '../../images/img/loadImg.png';
const md = new MarkdownIt({
  linkify: true,
  html: false,
  breaks: true,
  // highlight: function (str, lang) {
  //   const language = hljs.getLanguage(lang) ? lang : '';
  //   try {
  //     if (language) {
  //       return hljs.highlight(str, { language }).value;
  //     } else {
  //       return hljs.highlightAuto(str).value;
  //     }
  //     // eslint-disable-next-line no-unused-vars
  //   } catch (error) {
  //     return '';
  //   }
  // },
});
md.use(markdownItSub);
md.use(markdownItSup);
md.use(markdownItMark);
md.use(markdownItCheckbox, {
  disabled: true,
  divWrap: false,
  divClass: 'checkbox',
  idPrefix: 'cbx_',
  ulClass: 'task-list',
  liClass: 'task-list-item',
});
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('cursor', 'y');
  tokens[idx].attrSet('target', '_blank');
  return md.renderer.renderToken(tokens, idx, options, env, self);
};
md.renderer.rules.image = (tokens, idx) => {
  const srcItem = tokens[idx].attrs.find((item) => {
    return item[0] === 'src';
  });
  const src = srcItem[1];
  const alt = tokens[idx].content;
  return `<img cursor="" data-src="${src}" src="${imgLoadImg}" alt="${alt}" />`;
};

let currentLine = 0,
  blocks = [];
// 创建自定义 MarkdownIt 渲染规则来处理块元素
const defaultRender =
  md.renderer.rules.paragraph_open ||
  function (tokens, idx, options, _, self) {
    return self.renderToken(tokens, idx, options);
  };

// 添加行号
md.renderer.rules.paragraph_open = md.renderer.rules.heading_open = function (
  tokens,
  idx,
  options,
  env,
  self
) {
  const startLine = currentLine;
  const { i = '' } = blocks[startLine] || {};
  currentLine += tokens[idx + 1].content
    .split('\n')
    .filter((item) => item.trim()).length;
  tokens[idx].attrPush(['data-line', i]);
  return defaultRender(tokens, idx, options, env, self);
};
md.renderer.rules.tr_open = function (tokens, idx, options, env, self) {
  const startLine = currentLine;
  const { i = '' } = blocks[startLine] || {};
  currentLine++;
  const lastToken = tokens[idx - 1];
  if (lastToken && lastToken.type === 'thead_open') {
    currentLine++;
  }
  tokens[idx].attrPush(['data-line', i]);
  return defaultRender(tokens, idx, options, env, self);
};
md.renderer.rules.list_item_open = function (tokens, idx, options, _, self) {
  const startLine = currentLine;
  const { i = '' } = blocks[startLine] || {};
  tokens[idx].attrPush(['data-line', i]);
  return self.renderToken(tokens, idx, options);
};
md.renderer.rules.hr = function (tokens, idx, options, env, self) {
  const startLine = currentLine;
  currentLine++;
  const { i = '' } = blocks[startLine] || {};
  tokens[idx].attrPush(['data-line', i]);
  return self.renderToken(tokens, idx, options, env, self);
};
// 自定义代码块渲染规则
md.renderer.rules.fence = function (tokens, idx) {
  const startLine = currentLine;
  const { i = '' } = blocks[startLine] || {};
  const token = tokens[idx];
  const contents = token.content.split('\n');
  const lineNum = contents.length;
  const maxLine = 25;
  const codeBlock = contents.filter((item) => item.trim()).length + 2;
  currentLine += codeBlock; // 代码块可能占多行
  const lang = token.info ? token.info.trim() : ''; // 获取语言
  const language = hljs.getLanguage(lang) ? lang : '';
  let html = '';
  try {
    if (language) {
      html = hljs.highlight(token.content, { language }).value;
    } else {
      html = hljs.highlightAuto(token.content).value;
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {}
  return `<pre data-line="${i}" class="hljs"><code class="${lineNum >= maxLine ? 'hide' : ''}">${html}</code><div cursor="y" class="codeCopy iconfont icon-fuzhi"></div>${lineNum >= maxLine ? `<div data-flag="y" cursor="y" class="shrink iconfont icon-Down"></div>` : ''}</pre>`;
};
self.addEventListener('message', (event) => {
  const str = event.data;
  currentLine = 0;
  blocks = str
    .split('\n')
    .map((item, i) => ({ i: i + 1, text: item }))
    .filter((item) => item.text.trim());
  const html = md.render(str);
  self.postMessage(html);
});
