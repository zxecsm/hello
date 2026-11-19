/* eslint-disable no-console */
/**
 * 项目自研的轻量模板引擎（一次性渲染，无响应式）
 *
 * 支持：{{ 插值 }}、:动态属性、v-if / v-else-if / v-else、v-for、v-show、v-html、<template>
 *
 * 对齐 Vue 的行为：
 * - 文本空白按 condense 模式压缩，缩进换行去掉，同一行 inline 元素间的空格保留；
 * - 插值时 null / undefined / false 渲染为空；
 * - :class / :style 支持字符串、数组、对象；
 * - HTML 布尔属性：true 输出空字符串，false 移除属性；其它动态属性 null / undefined 移除；
 * - 文本和属性值会解码 HTML 实体。
 *
 * 与 Vue 的差异（刻意保留）：
 * - 动态属性求值为空字符串时不输出该属性（项目约定，避免空的 data-src 触发懒加载）；
 * - 没有事件绑定、v-model、组件和响应式更新，每次 _tpl 调用都是全量渲染；
 * - v-show 只切换行内 display，元素能否显示仍由 CSS 决定（与 Vue 一致，CSS 不能默认 display:none）；
 * - v-for 支持 item、item, index、{a,b}、{a,b}, index、(item, index)，Map/Set 按 value 迭代。
 */

// 匹配属性的正则表达式，支持以下格式： [name]="value" 或 [name]='value' 或 [name]=value
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;

// 匹配简单 HTML 标签的正则表达式，例如 <my-header></my-header>
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z]*`;

// 匹配带命名空间的标签名，例如 <my:header></my:header>
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;

// 匹配开始标签，例如 <div>
const startTagOpen = new RegExp(`^<${qnameCapture}`);

// 匹配开始标签的结束部分，例如 > 或 />
const startTagClose = /^\s*(\/?)>/;

// 匹配结束标签，例如 </div>
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);

// 匹配注释标签 <!-- 注释内容 -->
const commentTag = /^<!--([\s\S]*?)-->/;

// 动态属性（:xxx）
const dynamicAttr = /^:/;

// 指令属性（v-xxx）
const directiveAttr = /^v\-/;

// 需要在虚拟节点阶段求值的指令（v-if / v-else 系列在过滤阶段单独处理）
const evalDirectives = new Set(['v-show', 'v-html']);

// HTML 布尔属性：对齐 Vue，值为 true 时输出空字符串，为 false 时移除属性
const booleanAttrs = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'scoped',
  'seamless',
  'selected',
]);

// 开发环境提示，webpack 会把 process.env.NODE_ENV 替换成对应字符串
const isDev = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

// HTML 实体解码表（HTML 模板的文本和属性值都会被解码，对齐浏览器解析行为）
const namedEntities = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  times: '×',
  divide: '÷',
  middot: '·',
  bull: '•',
  deg: '°',
  plusmn: '±',
  laquo: '«',
  raquo: '»',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
};

const entityRE = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

// 解码 HTML 实体，无法识别的实体保持原样
function decodeEntities(str) {
  if (!str || !str.includes('&')) return str;
  return str.replace(entityRE, (raw, code) => {
    if (code[0] === '#') {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const num = parseInt(isHex ? code.slice(2) : code.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(num) || num < 0 || num > 0x10ffff) return raw;
      try {
        return String.fromCodePoint(num);
      } catch {
        return raw;
      }
    }
    return Object.prototype.hasOwnProperty.call(namedEntities, code) ? namedEntities[code] : raw;
  });
}

// 空白处理对齐 Vue 的 condense 模式：
// 1. 连续空白压成一个空格，缩进用的换行会被去掉；
// 2. 纯空白文本节点：同一行内保留一个空格（inline 元素之间的语义空格），跨行缩进直接丢弃；
// 3. 有内容的文本：只去掉“换行缩进”产生的首尾空格，同一行内的空格保留。
function normalizeText(text) {
  const condensed = text.replace(/[ \t\r\n\f]+/g, ' ');
  if (condensed === ' ') return /[\r\n]/.test(text) ? '' : ' ';
  let result = condensed;
  const leading = text.match(/^\s+/);
  const trailing = text.match(/\s+$/);
  if (leading && /[\r\n]/.test(leading[0])) result = result.slice(1);
  if (trailing && /[\r\n]/.test(trailing[0]) && result.endsWith(' ')) result = result.slice(0, -1);
  return result;
}

// 解析 HTML 字符串为 AST (抽象语法树) 的函数
export default function parseHtmlToAst(html) {
  // 如果输入不是字符串，则直接返回
  if (typeof html !== 'string') {
    return html;
  }

  // 为了确保根元素有效，给输入的 HTML 包裹一个 <div> 标签
  html = `<div>${html}</div>`;

  let root,
    currentParent,
    stack = [];

  // 当 HTML 还有剩余字符时，继续解析
  while (html) {
    // 找到下一个 '<'
    const index = html.indexOf('<');

    // 如果没有找到 '<'，则退出循环
    if (index < 0) break;

    // 如果当前位置以 '<' 开头
    if (index === 0) {
      // 解析注释标签 <!-- 注释内容 -->
      const commentMatch = html.match(commentTag);
      if (commentMatch) {
        advance(commentMatch[0].length); // 前进到注释的结尾
        handleComment(commentMatch[1]); // 处理注释内容
        continue;
      }

      // 解析开始标签 (例如 <div id="app">)
      if (parseStartTag()) continue;

      // 尝试匹配结束标签 (例如 </div>)
      const endTagMatch = html.match(endTag);
      if (endTagMatch) {
        // 如果找到结束标签，向前推进解析器并处理结束
        advance(endTagMatch[0].length);
        end();
        continue;
      }

      // 兜底：不是合法标签的 '<' 按普通文本处理，必须消费字符避免死循环
      advance(1);
      chars('<');
      continue;
    } else if (index > 0) {
      // 处理下一个标签之前的文本
      const text = html.slice(0, index);
      advance(text.length);
      chars(text);
    }
  }

  if (isDev && stack.length > 0) {
    console.warn('[tpl] 存在未闭合的标签：', stack.map((item) => item.tag).join('、'));
  }

  // 解析开始标签并返回标签信息
  function parseStartTag() {
    // 匹配开始标签 (例如 <div>)
    const tagOpenMatch = html.match(startTagOpen);
    if (!tagOpenMatch) return null;

    const startTagInfo = {
      tagName: tagOpenMatch[1], // 标签名 (例如 'div')
      attrs: [], // 存储属性的数组
    };

    // 删除已经匹配的开始标签
    advance(tagOpenMatch[0].length);

    let endTagMatch, attrMatch;

    // 处理标签内的属性 (例如 id="app")
    while (
      !(endTagMatch = html.match(startTagClose)) && // 当未匹配到 '>' 或 '/>' 时继续
      (attrMatch = html.match(attribute)) // 匹配属性
    ) {
      // 将属性添加到标签信息中
      startTagInfo.attrs.push({
        name: attrMatch[1], // 属性名 (例如 'id')
        value: decodeEntities(attrMatch[3] || attrMatch[4] || attrMatch[5] || ''), // 属性值
      });
      // 删除已经匹配的属性
      advance(attrMatch[0].length);
    }

    // 如果找到了开始标签的结束部分 (例如 '>' 或 '/>')
    if (endTagMatch) {
      advance(endTagMatch[0].length); // 向前推进 HTML 字符串
      start(startTagInfo.tagName, startTagInfo.attrs); // 处理标签
      if (endTagMatch[0].trim() === '/>') {
        end(); // 如果是自闭合标签，立即结束
      }
    }

    return startTagInfo;
  }

  // 向前推进解析器 n 个字符
  function advance(n) {
    html = html.substring(n);
  }

  // 处理新标签的开始并构建 AST 元素
  function start(tagName, attrs) {
    const element = {
      tag: tagName, // 标签名 (例如 'div')
      type: 1, // 类型 1 表示标签节点
      children: [], // 用于存储子节点
      attrs, // 属性列表
      parent: null, // 父元素引用，end() 中建立
    };

    // 如果是第一个元素，则设置为根元素
    if (!root) {
      root = element;
    }

    currentParent = element; // 将当前元素设为父元素，供下一个子节点使用
    stack.push(element); // 将元素推入堆栈，跟踪打开的标签
  }

  // 处理标签的结束，并建立父子关系
  function end() {
    const element = stack.pop(); // 弹出最近打开的元素
    if (!element) return; // 多余的结束标签直接忽略
    currentParent = stack[stack.length - 1]; // 将当前父元素设为前一个元素
    if (currentParent) {
      element.parent = currentParent; // 建立父子关系
      currentParent.children.push(element); // 将当前元素添加到父元素的子元素中
    }
  }

  // 处理标签内的文本节点
  function chars(text) {
    if (!currentParent) return; // 结构异常时忽略多余文本
    text = normalizeText(decodeEntities(text)); // 解码实体并压缩空白
    if (text.length > 0) {
      currentParent.children.push({
        type: 3, // 类型 3 表示文本节点
        text, // 文本内容
        parent: currentParent, // 设置父元素
      });
    }
  }

  // 处理注释节点
  function handleComment(comment) {
    if (!currentParent) return;
    currentParent.children.push({
      type: 8, // 类型 8 表示注释节点
      text: comment, // 注释内容
      parent: currentParent, // 设置父元素
    });
  }

  return root; // 返回 AST 的根节点
}
// 插值结果转成展示内容，对齐 Vue：null / undefined / false 渲染为空
function toDisplayValue(value) {
  return value === null || value === undefined || value === false ? '' : value;
}
// 插值
function tplReplace(tpl, data) {
  if (typeof tpl === 'string') {
    if (!tpl.includes('{{')) return tpl;
    return tpl.replace(/\{\{(.*?)\}\}/g, (_, k) => {
      return toDisplayValue(evaluateExpression(k, data));
    });
  } else {
    return toDisplayValue(evaluateExpression(tpl, data));
  }
}
// 深拷贝
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;

  const hash = new WeakMap();
  const stack = [];
  const clone = Array.isArray(obj) ? [] : {};

  // 初始化栈
  stack.push({
    source: obj,
    target: clone,
  });
  hash.set(obj, clone);

  while (stack.length > 0) {
    const { source, target } = stack.pop();

    for (let key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];

        if (value === null || typeof value !== 'object') {
          // 基本类型直接赋值
          target[key] = value;
        } else if (hash.has(value)) {
          // 已克隆过的对象直接引用
          target[key] = hash.get(value);
        } else {
          // 新对象，创建克隆并加入栈
          const newClone = Array.isArray(value) ? [] : {};
          target[key] = newClone;
          hash.set(value, newClone);
          stack.push({
            source: value,
            target: newClone,
          });
        }
      }
    }
  }

  return clone;
}
// 运行表达式
// 编译结果按「表达式 + 变量名列表」缓存，避免每次求值都 new Function
const fnCache = new Map();
function evaluateExpression(expression, data) {
  try {
    const keys = Object.keys(data);
    const cacheKey = expression + '\u0000' + keys.join('\u0001');
    let func = fnCache.get(cacheKey);
    if (!func) {
      func = new Function(...keys, `return ${expression};`);
      fnCache.set(cacheKey, func);
    }
    return func(...Object.values(data));
  } catch (error) {
    if (isDev) {
      console.warn('[tpl] 表达式执行失败：', expression, error);
    }
    return undefined;
  }
}
// 设置属性工具
const attrTool = {
  get(attrs, name) {
    return attrs.find((attr) => attr.name === name);
  },
  del(attrs, name) {
    return attrs.filter((attr) => attr.name !== name);
  },
};
// 复制属性数组。
// 这里只做浅拷贝：复制发生在 hdAttrs 求值之前，属性值此时都是解析出来的字符串；
// 之后的赋值都是替换 attr.value 本身，不会修改嵌套对象，
// 所以每个节点 / 每次 v-for 迭代各自持有独立的 { name, value } 对象就够了。
// 注意：如果以后改成复用或缓存 AST，并在求值之后再拷贝属性，这里必须改回深拷贝。
function cloneAttrs(attrs) {
  return attrs.map((attr) => ({ name: attr.name, value: attr.value }));
}
// class 值转字符串，对齐 Vue 支持字符串 / 数组 / 对象
function stringifyClass(val) {
  if (val === null || val === undefined || val === false) return '';
  if (Array.isArray(val)) {
    return val
      .map((item) => stringifyClass(item))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof val === 'object') {
    return Object.keys(val)
      .filter((key) => val[key])
      .join(' ');
  }
  return String(val);
}
// style 值转字符串，对齐 Vue 支持字符串 / 数组 / 对象
function stringifyStyle(val) {
  if (val === null || val === undefined || val === false) return '';
  if (Array.isArray(val)) {
    return val
      .map((item) => stringifyStyle(item))
      .filter(Boolean)
      .join(';');
  }
  if (typeof val === 'object') {
    return Object.keys(val)
      .map((key) => `${key}:${val[key]}`)
      .join(';');
  }
  return String(val);
}
// 合并动态 class 到静态 class
function mergeClass(attrs, val) {
  const idx = attrs.findIndex((attr) => attr.name === 'class');
  if (idx < 0) {
    attrs.push({ name: 'class', value: val });
  } else {
    attrs[idx].value = `${attrs[idx].value} ${val}`.trim();
  }
}
// 合并动态 style 到静态 style，注意补上分隔符
function mergeStyle(attrs, val) {
  const idx = attrs.findIndex((attr) => attr.name === 'style');
  if (idx < 0) {
    attrs.push({ name: 'style', value: val });
  } else {
    const prev = attrs[idx].value;
    const sep = prev && !prev.trimEnd().endsWith(';') ? ';' : '';
    attrs[idx].value = `${prev}${sep}${val}`;
  }
}
// 生成虚拟节点
function vnode(ast, data) {
  ast.data = data;
  generate(ast);
  return ast;
}
// 处理元素文本虚拟节点
function generate(ast) {
  if (ast.type === 1) {
    hdel(ast);
    hdAttrs(ast);
  } else if (ast.type === 3 || ast.type === 8) {
    ast.text = tplReplace(ast.text, ast.data);
  }
}
// 递归处理虚拟节点
function hdel(ast) {
  const { children } = ast;
  if (children.length > 0) {
    // 处理 v-for 展开，然后先过滤掉 v-if 的假分支，
    // 避免为不会渲染的节点求值和创建整棵子树
    ast.children = filterVif(hdchilds(ast));
    // 递归处理子元素
    ast.children.forEach((child) => {
      generate(child);
    });
  }
}
function hdchilds(ast) {
  const childs = [];
  ast.children.forEach((child) => {
    if (child.type === 1) {
      const v_for = attrTool.get(child.attrs, 'v-for');
      if (v_for) {
        hdFor(ast, child, childs, v_for);
      } else {
        childs.push({
          ...child,
          attrs: cloneAttrs(child.attrs),
          data: ast.data,
        });
      }
    } else if (child.type === 3 || child.type === 8) {
      childs.push({ ...child, data: ast.data });
    }
  });
  return childs;
}
// 过滤 v-if / v-else-if / v-else 的假分支（此时 data 已按 v-for 迭代赋值）
function filterVif(childs) {
  const result = [];
  let inConditionChain = false; // 条件链标识
  childs.forEach((child) => {
    if (child.type !== 1) {
      result.push(child);
      return;
    }
    const { attrs, data } = child;
    const v_if = attrTool.get(attrs, 'v-if');
    const v_else_if = attrTool.get(attrs, 'v-else-if');
    const v_else = attrTool.get(attrs, 'v-else');
    if (v_if) {
      inConditionChain = true; // v-if 条件链开始
      if (evaluateExpression(v_if.value, data)) {
        result.push(child);
        inConditionChain = false; // v-if 为 true 时，条件链结束
      }
    } else if (v_else_if) {
      if (inConditionChain && evaluateExpression(v_else_if.value, data)) {
        result.push(child);
        inConditionChain = false;
      }
    } else if (v_else) {
      if (inConditionChain) {
        result.push(child);
        inConditionChain = false; // v-else 结束条件链
      }
    } else {
      // 如果不是 v-if/v-else-if/v-else，则结束当前条件链并保留当前项
      inConditionChain = false;
      result.push(child);
    }
  });
  return result;
}
// 处理 v-for 遍历生成节点
function hdFor(ast, child, childs, v_for) {
  const splitIdx = v_for.value.indexOf(' in ');
  if (splitIdx < 0) {
    if (isDev) console.warn('[tpl] v-for 语法错误：', v_for.value);
    return;
  }
  const aliasStr = v_for.value.slice(0, splitIdx).trim();
  const source = v_for.value.slice(splitIdx + 4).trim();
  if (!aliasStr) return;
  const items = evaluateExpression(source, ast.data);

  // 解析别名，支持 item / item,idx / {a,b} / {a,b},idx / (item, idx)
  let alias = aliasStr;
  let idxName = 'index';
  const unwrapped = /^\(.*\)$/.test(alias) ? alias.slice(1, -1).trim() : alias;
  if (!/\}\s*$/.test(unwrapped) && unwrapped.includes(',')) {
    const pos = unwrapped.lastIndexOf(',');
    alias = unwrapped.slice(0, pos).trim();
    idxName = unwrapped.slice(pos + 1).trim() || 'index';
  }
  if (!alias) return;

  const baseAttrs = attrTool.del(child.attrs, 'v-for');
  const pushItem = (value, index) => {
    const data = { ...ast.data, [alias]: value };
    // 别名本身就是 index 时不再重复写入第二个参数，对齐 Vue 的 1 开始行为
    if (idxName !== alias) data[idxName] = index;
    childs.push({
      ...child,
      // 每次迭代都要独立复制属性，否则插值/动态属性会互相污染
      attrs: cloneAttrs(baseAttrs),
      data,
    });
  };

  if (Array.isArray(items)) {
    items.forEach(pushItem);
  } else if (items instanceof Map) {
    // 对齐 Vue：Map 的 value 作为迭代项，key 作为第二个参数
    items.forEach((value, key) => pushItem(value, key));
  } else if (items instanceof Set) {
    let index = 0;
    items.forEach((value) => pushItem(value, index++));
  } else if (typeof items === 'object' && items !== null) {
    // 处理对象
    Object.keys(items).forEach((key) => pushItem(items[key], key));
  } else if (typeof items === 'string') {
    // 处理字符串
    Array.from(items).forEach(pushItem);
  } else if (typeof items === 'number' && Number.isInteger(items)) {
    // 处理数字，对齐 Vue：从 1 开始
    for (let i = 1; i <= items; i++) {
      pushItem(i, i - 1);
    }
  } else if (items !== undefined && items !== null && isDev) {
    console.warn('[tpl] v-for 的值不可遍历：', source);
  }
}
// 属性赋值
function hdAttrs(ast) {
  const { data } = ast;
  const attrs = [];

  // 第一遍：静态属性做插值，指令先求值，动态属性留到第二遍
  ast.attrs.forEach((item) => {
    const { name } = item;
    if (evalDirectives.has(name)) {
      attrs.push({ name, value: evaluateExpression(item.value, data) });
    } else if (!dynamicAttr.test(name)) {
      if (item.value.includes('{{')) item.value = tplReplace(item.value, data);
      attrs.push(item);
    }
  });

  // 第二遍：动态属性求和静态属性同名的合并
  ast.attrs.forEach((item) => {
    if (!dynamicAttr.test(item.name)) return;
    const name = item.name.replace(/^:+/, '');
    const raw = evaluateExpression(item.value, data);
    // 对齐 Vue：null / undefined 移除属性；
    // 本项目的约定是动态属性为空字符串时不输出该属性，保持原行为
    if (raw === null || raw === undefined || raw === '') return;
    if (booleanAttrs.has(name)) {
      // 对齐 Vue：空字符串、"false"、false 都视为不设置
      if (!raw || raw === 'false') return;
      attrs.push({ name, value: '' });
      return;
    }
    if (name === 'class') {
      const val = stringifyClass(raw);
      if (val) mergeClass(attrs, val);
      return;
    }
    if (name === 'style') {
      const val = stringifyStyle(raw);
      if (val) mergeStyle(attrs, val);
      return;
    }
    const idx = attrs.findIndex((attr) => attr.name === name);
    const val = raw === false ? 'false' : raw;
    if (idx >= 0) {
      attrs[idx].value = val;
    } else {
      attrs.push({ name, value: val });
    }
  });

  ast.attrs = attrs;
}
// 创建dom元素
function createEl(tag) {
  return document.createElement(tag);
}
// 创建文本节点
function createText(text) {
  return document.createTextNode(text);
}
function createCom(text) {
  return document.createComment(text);
}
// 创建文档片段
function createFrag() {
  return document.createDocumentFragment();
}
// dom元素设置属性
function setAttr(node, attrs) {
  attrs.forEach((item) => {
    const { name, value } = item;
    // 指令属性和动态属性不直接输出；空字符串的静态属性需要保留（例如 alt=""）
    if (directiveAttr.test(name) || dynamicAttr.test(name)) return;
    if (value === null || value === undefined) return;
    node.setAttribute(name, value);
  });
}
// 展开 template 标签（v-if 已在 filterVif 中处理）
function flattenTemplates(children, result = []) {
  children.forEach((child) => {
    if (child.type === 1 && child.tag === 'template') {
      flattenTemplates(child.children || [], result);
    } else {
      result.push(child);
    }
  });
  return result;
}
// 递归创建元素和节点
function createNode(ast, pEl) {
  const { attrs, type, children, tag, text } = ast;
  if (type === 1) {
    const el = createEl(tag);
    setAttr(el, attrs);
    const v_show = attrTool.get(attrs, 'v-show');
    if (v_show) {
      // 对齐 Vue：true 时恢复元素原本的行内 display，false 时使用 none
      const original = el.style.display;
      el.style.display = v_show.value ? original : 'none';
    }
    const v_html = attrTool.get(attrs, 'v-html');
    if (v_html) {
      // 处理v-html指令
      const val = v_html.value;
      if (typeof val === 'string') {
        el.innerHTML = val;
      } else if (val && val.nodeType) {
        el.innerHTML = '';
        el.appendChild(val);
      }
    } else if (children && children.length > 0) {
      // 然后继续递归处理子元素
      flattenTemplates(children).forEach((child) => {
        createNode(child, el);
      });
    }
    pEl.appendChild(el);
  } else if (type === 3) {
    pEl.appendChild(createText(text));
  } else if (type === 8) {
    pEl.appendChild(createCom(text));
  }
}
// 把 AST 渲染到指定容器里
function renderInto(ast, pEl) {
  if (ast && ast.children) {
    flattenTemplates(ast.children).forEach((child) => createNode(child, pEl));
  }
  return pEl;
}
export function _tpl(template, data) {
  return renderInto(vnode(parseHtmlToAst(template), data), createFrag());
}
_tpl.getAst = function (html) {
  return parseHtmlToAst(html);
};
_tpl.getVnode = function (html, data) {
  return vnode(_tpl.getAst(html), data);
};
_tpl.getDom = function (html, data) {
  return renderInto(vnode(_tpl.getAst(html), data), createEl('div')).children;
};
_tpl.createEl = createEl;
_tpl.createText = createText;
_tpl.createFrag = createFrag;
_tpl.setAttr = setAttr;
_tpl.html = function (target, dom) {
  if (typeof dom === 'string') {
    target.innerHTML = dom;
  } else {
    target.innerHTML = '';
    target.appendChild(dom);
  }
};
_tpl.append = function (target, html) {
  if (typeof html === 'string') {
    const tempDiv = createEl('div');
    tempDiv.innerHTML = html;

    const fragment = createFrag();

    Array.from(tempDiv.childNodes).forEach((node) => {
      if (node.tagName === 'SCRIPT') {
        const script = createEl('script');
        if (node.src) {
          script.src = node.src;
          script.async = node.async;
          script.defer = node.defer;
          fragment.appendChild(script);
        } else {
          script.textContent = node.textContent;
          fragment.appendChild(script);
        }
      } else if (node.tagName === 'TITLE') {
        document.title = node.textContent;
      } else if (node.tagName === 'LINK') {
        if (!document.head.querySelector(`link[href="${node.href}"]`)) {
          const link = createEl('link');
          link.rel = node.rel;
          link.href = node.href;
          document.head.appendChild(link);
        }
      } else if (node.tagName === 'META') {
        if (!document.head.querySelector(`meta[name="${node.name}"]`)) {
          const meta = createEl('meta');
          meta.name = node.name;
          meta.content = node.content;
          document.head.appendChild(meta);
        }
      } else {
        fragment.appendChild(node.cloneNode(true));
      }
    });

    target.appendChild(fragment);
  } else {
    target.appendChild(html);
  }
};
