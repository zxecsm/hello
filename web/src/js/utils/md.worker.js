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
import markdownItIns from 'markdown-it-ins'; // 插入（下划线）
import markdownItCheckbox from 'markdown-it-task-checkbox'; // 复选框
import markdownItFootnote from 'markdown-it-footnote'; // 脚注
import markdownItDeflist from 'markdown-it-deflist'; // 定义列表
import markdownItAbbr from 'markdown-it-abbr'; // 缩写
import { full as markdownItEmoji } from 'markdown-it-emoji'; // emoji 表情
import markdownItContainer from 'markdown-it-container'; // 自定义容器
import markdownItAnchor from 'markdown-it-anchor'; // 标题锚点 id
import { slugifyHeading } from './mdSlug.js';
import imgLoadImg from '../../assets/images/loadImg.png';
const md = new MarkdownIt({
  linkify: true,
  // 放行原始 HTML，渲染结果会在主线程经过 safeHtml 白名单净化
  html: true,
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
md.use(markdownItIns);
md.use(markdownItFootnote);
md.use(markdownItDeflist);
md.use(markdownItAbbr);
md.use(markdownItEmoji);
// 标题 id 使用标题文字生成，md 内容里的 [跳转](#标题) 可以直接定位
md.use(markdownItAnchor, {
  slugify: slugifyHeading,
  tabIndex: false,
});
md.use(markdownItCheckbox, {
  disabled: true,
  divWrap: false,
  divClass: 'checkbox',
  idPrefix: 'cbx_',
  ulClass: 'task-list',
  liClass: 'task-list-item',
});

// 自定义容器：::: tip / warning / danger / info / details
// 用法：
//   ::: tip 可选标题
//   内容
//   :::
function useContainer(name, defaultTitle) {
  md.use(markdownItContainer, name, {
    validate(params) {
      return params.trim().split(/\s+/)[0] === name;
    },
    render(tokens, idx) {
      const token = tokens[idx];
      // 只有开标签带 map，闭合 token 没有
      if (token.nesting !== 1) return '</div>\n';
      const startLine = token.map ? token.map[0] : '';
      return `<div${startLine === '' ? '' : ` data-line="${startLine}"`} class="custom-block ${name}"><p class="custom-block-title">${md.utils.escapeHtml(
        token.info.trim().slice(name.length).trim() || defaultTitle,
      )}</p>\n`;
    },
  });
}
useContainer('tip', '提示');
useContainer('info', '说明');
useContainer('warning', '注意');
useContainer('danger', '警告');

// details 容器渲染为可折叠的 <details>
md.use(markdownItContainer, 'details', {
  validate(params) {
    return params.trim().split(/\s+/)[0] === 'details';
  },
  render(tokens, idx) {
    const token = tokens[idx];
    // 只有开标签带 map，闭合 token 没有
    if (token.nesting !== 1) return '</details>\n';
    const startLine = token.map ? token.map[0] : '';
    // 默认折叠，点击 summary 展开
    return `<details${startLine === '' ? '' : ` data-line="${startLine}"`} class="custom-block details"><summary>${md.utils.escapeHtml(
      token.info.trim().slice('details'.length).trim() || '详情',
    )}</summary>\n`;
  },
});
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  tokens[idx].attrSet('cursor', 'y');
  // 笔记内部的 #锚点 在当前页面跳转，外链才新窗口打开
  if (!href.startsWith('#')) {
    tokens[idx].attrSet('target', '_blank');
  }
  return md.renderer.renderToken(tokens, idx, options, env, self);
};
md.renderer.rules.image = (tokens, idx) => {
  const srcItem = tokens[idx].attrs.find((item) => {
    return item[0] === 'src';
  });
  const token = tokens[idx];
  // 图片是 inline 子 token，本身没有 map，行号由 message 里的父级 inline 传递
  const startLine = token.map ? token.map[0] : '';
  const src = srcItem ? srcItem[1] : '';
  const alt = token.content;
  const escape = md.utils.escapeHtml;
  return `<img${startLine === '' ? '' : ` data-line="${startLine}"`} cursor="y" data-src="${escape(
    src,
  )}" src="${imgLoadImg}" alt="${escape(alt)}" title="${escape(alt)}" />`;
};

// 自定义代码块渲染规则
md.renderer.rules.fence = function (tokens, idx) {
  const token = tokens[idx];
  const startLine = token.map ? token.map[0] : '';
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

      // inline 的子 token（图片、链接等）没有自己的 map，
      // 继承父级 inline 的行号，渲染时才能拿到 data-line
      if (token.type === 'inline' && token.children) {
        token.children.forEach((child) => {
          if (!child.map) child.map = token.map;
        });
      }
    }
  });
  const html = md.renderer.render(tokens, md.options, {});
  self.postMessage(html);
});
