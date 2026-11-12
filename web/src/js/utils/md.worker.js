import MarkdownIt from 'markdown-it';
// 常用语言（common）+ 一些笔记里高频出现、但 common 未包含的语言，
// 兼顾体积与高亮覆盖率；未注册的语言会自动走 highlightAuto 兜底
import hljs from 'highlight.js/lib/common';
import clojure from 'highlight.js/lib/languages/clojure';
import cmake from 'highlight.js/lib/languages/cmake';
import coffeescript from 'highlight.js/lib/languages/coffeescript';
import dart from 'highlight.js/lib/languages/dart';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import groovy from 'highlight.js/lib/languages/groovy';
import haskell from 'highlight.js/lib/languages/haskell';
import http from 'highlight.js/lib/languages/http';
import julia from 'highlight.js/lib/languages/julia';
import nginx from 'highlight.js/lib/languages/nginx';
import nix from 'highlight.js/lib/languages/nix';
import powershell from 'highlight.js/lib/languages/powershell';
import properties from 'highlight.js/lib/languages/properties';
import protobuf from 'highlight.js/lib/languages/protobuf';
import scala from 'highlight.js/lib/languages/scala';
import vim from 'highlight.js/lib/languages/vim';

[
  ['clojure', clojure],
  ['cmake', cmake],
  ['coffeescript', coffeescript],
  ['dart', dart],
  ['dockerfile', dockerfile],
  ['elixir', elixir],
  ['groovy', groovy],
  ['haskell', haskell],
  ['http', http],
  ['julia', julia],
  ['nginx', nginx],
  ['nix', nix],
  ['powershell', powershell],
  ['properties', properties],
  ['protobuf', protobuf],
  ['scala', scala],
  ['vim', vim],
].forEach(([name, lang]) => hljs.registerLanguage(name, lang));
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
  //   } catch {
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
  return `<img cursor="y" data-src="${src}" src="${imgLoadImg}" alt="${alt}" title="${alt}" />`;
};

// 自定义代码块渲染规则
md.renderer.rules.fence = function (tokens, idx) {
  const token = tokens[idx];
  const startLine = token.map[0];
  const lineNum = token.content.split('\n').length;
  const maxLine = 25;
  const lang = token.info ? token.info.trim() : ''; // 获取语言
  const language = hljs.getLanguage(lang) ? lang : '';
  let html = '';
  try {
    if (language) {
      html = hljs.highlight(token.content, { language }).value;
    } else {
      html = hljs.highlightAuto(token.content).value;
    }
  } catch {}
  return `<pre data-line="${startLine}" class="hljs"><code class="${
    lineNum >= maxLine ? 'hide' : ''
  }">${html}</code><div cursor="y" class="codeCopy iconfont icon-fuzhi"></div>${
    lineNum >= maxLine
      ? `<div data-flag="y" cursor="y" class="shrink iconfont icon-xiala"></div>`
      : ''
  }</pre>`;
};
self.addEventListener('message', (event) => {
  const content = event.data;
  const tokens = md.parse(content, {}); // 获取所有的 tokens

  tokens.forEach((token) => {
    if (token.map) {
      const startLine = token.map[0]; // token.map 是 token 的行号范围，起始行

      // 为每个 token 添加自定义属性
      token.attrPush(['data-line', startLine.toString()]);
    }
  });
  const html = md.renderer.render(tokens, md.options, {});
  self.postMessage(html);
});
