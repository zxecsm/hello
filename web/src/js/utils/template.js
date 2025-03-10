// 匹配属性的正则表达式，支持以下格式： [name]="value" 或 [name]='value' 或 [name]=value
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;

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
    } else if (index > 0) {
      // 处理下一个标签之前的文本
      const text = html.slice(0, index);
      advance(text.length);
      chars(text);
    }
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
        value: attrMatch[3] || attrMatch[4] || attrMatch[5] || '', // 属性值
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
      parent, // 父元素引用
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
    currentParent = stack[stack.length - 1]; // 将当前父元素设为前一个元素
    if (currentParent) {
      element.parent = currentParent; // 建立父子关系
      currentParent.children.push(element); // 将当前元素添加到父元素的子元素中
    }
  }

  // 处理标签内的文本节点
  function chars(text) {
    text = text.trim(); // 删除不必要的空白字符
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
    currentParent.children.push({
      type: 8, // 类型 8 表示注释节点
      text: comment, // 注释内容
      parent: currentParent, // 设置父元素
    });
  }

  return root; // 返回 AST 的根节点
}
// 插值
function tplReplace(tpl, data) {
  if (typeof tpl === 'string') {
    return tpl.replace(/\{\{(.*?)\}\}/g, (_, k) => {
      return evaluateExpression(k, data);
    });
  } else {
    return evaluateExpression(tpl, data);
  }
}
// 深拷贝
export function deepClone(obj, hash = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;

  if (hash.has(obj)) return hash.get(obj);

  const clone = Array.isArray(obj) ? [] : {};
  hash.set(obj, clone);

  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key], hash);
    }
  }

  return clone;
}
// 运行表达式
function evaluateExpression(expression, data) {
  try {
    const func = new Function(...Object.keys(data), `return ${expression};`);
    const res = func(...Object.values(data));
    if (res === undefined) {
      return '';
    }
    return res;
  } catch {
    return '';
  }
}
// 设置属性工具
const attrTool = {
  get(attrs, name) {
    return attrs.find((attr) => attr.name === name);
  },
  set(attrs, name, value) {
    const idx = attrs.findIndex((attr) => attr.name === name);
    if (idx < 0) {
      this.add(attrs, name, value);
    } else {
      attrs[idx].name = value;
    }
  },
  add(attrs, name, value) {
    attrs.push({ name, value });
  },
  del(attrs, name) {
    return attrs.filter((attr) => attr.name !== name);
  },
};
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
    // 处理v-for指令
    ast.children = hdchilds(ast);
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
          attrs: deepClone(child.attrs),
          data: ast.data,
        });
      }
    } else if (child.type === 3 || child.type === 8) {
      childs.push({ ...child, data: ast.data });
    }
  });
  return childs;
}
// 处理v-for遍历生成节点
function hdFor(ast, child, childs, v_for) {
  let [a, b] = v_for.value.split(' in ');
  const items = evaluateExpression(b.trim(), ast.data);
  a = a.trim();
  if (!a.includes(',') || /\}$/.test(a)) {
    a += ',index';
  }
  const arr = a.split(',');
  const idx = arr.pop();
  a = arr.join(',');
  if (Array.isArray(items)) {
    items.forEach((value, index) => {
      childs.push({
        ...child,
        attrs: deepClone(attrTool.del(child.attrs, 'v-for')),
        data: {
          ...ast.data,
          [a.trim()]: value,
          [idx]: index,
        },
      });
    });
  } else if (typeof items === 'object' && items !== null) {
    // 处理对象
    Object.keys(items).forEach((key) => {
      childs.push({
        ...child,
        attrs: deepClone(attrTool.del(child.attrs, 'v-for')),
        data: {
          ...ast.data,
          [a.trim()]: items[key],
          [idx]: key,
        },
      });
    });
  } else if (typeof items === 'string') {
    // 处理字符串
    Array.from(items).forEach((char, index) => {
      childs.push({
        ...child,
        attrs: deepClone(attrTool.del(child.attrs, 'v-for')),
        data: {
          ...ast.data,
          [a.trim()]: char,
          [idx]: index,
        },
      });
    });
  } else if (typeof items === 'number' && Number.isInteger(items)) {
    // 处理数字
    for (let i = 1; i <= items; i++) {
      childs.push({
        ...child,
        attrs: deepClone(attrTool.del(child.attrs, 'v-for')),
        data: {
          ...ast.data,
          [a.trim()]: i,
          [idx]: i - 1,
        },
      });
    }
  }
}
// 属性赋值
function hdAttrs(ast) {
  const { data, attrs } = ast;
  attrs.forEach((item) => {
    const { name, value } = item;
    if (['v-if', 'v-html', 'v-show', 'v-else-if', 'v-else'].includes(name)) {
      item.value = evaluateExpression(value, data);
    } else if (/^\:/.test(name)) {
      const name = item.name.replace(/^:+/, '');
      item.value = evaluateExpression(value, data);
      const idx = attrs.findIndex((attr) => attr.name === name);
      if (name === 'style') {
        let val = item.value;
        if (typeof val === 'object') {
          val =
            Object.keys(val)
              .map((key) => {
                return `${key}:${val[key]}`;
              })
              .join(';') + ';';
        }
        if (idx >= 0) {
          attrs[idx].value = `${attrs[idx].value}${val}`;
        } else {
          attrs.push({ name, value: val });
        }
      } else if (name === 'class') {
        let val = item.value;
        if (Array.isArray(val)) {
          val = val.join(' ');
        }
        if (idx >= 0) {
          attrs[idx].value = `${attrs[idx].value} ${val}`;
        } else {
          attrs.push({ name, value: val });
        }
      } else {
        if (idx >= 0) {
          attrs[idx].value = item.value;
        } else {
          attrs.push({ name, value: item.value });
        }
      }
    } else {
      item.value = tplReplace(value, data);
    }
  });
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
    // 去除指令属性 :动态属性
    if (/^v\-/.test(name) || /^\:/.test(name) || value === '') return;
    node.setAttribute(name, value);
  });
}
// 递归创建元素和节点
function createNode(ast, pEl) {
  const { attrs, type, children, tag, text } = ast;
  if (type === 1) {
    const el = createEl(tag);
    setAttr(el, attrs);
    const v_show = attrTool.get(attrs, 'v-show');
    if (v_show) {
      el.style.display = v_show.value ? 'block' : 'none';
    }
    const v_html = attrTool.get(attrs, 'v-html');
    if (v_html) {
      // 处理v-html指令
      if (typeof v_html.value === 'string') {
        el.innerHTML = v_html.value;
      } else {
        el.innerHTML = '';
        el.appendChild(v_html.value);
      }
    } else {
      if (children && children.length > 0) {
        // 然后继续递归处理子元素
        filterElement(children).forEach((child) => {
          createNode(child, el);
        });
      }
    }
    pEl.appendChild(el);
  } else if (type === 3) {
    pEl.appendChild(createText(text));
  } else if (type === 8) {
    pEl.appendChild(createCom(text));
  }
}
// 拆解template标签
function hdTemplate(child, result) {
  if (child.children.length > 0) {
    // template中的元素单独处理v-if指令
    hdVif(child.children).forEach((c) => {
      // 拆解嵌套的template
      if (c.tag === 'template') {
        hdTemplate(c, result);
      } else {
        result.push(c);
      }
    });
  }
}
// 过滤元素列表，把v-if不需要的去除，拆解template
function filterElement(childs) {
  const result = [];
  hdVif(childs).forEach((child) => {
    if (child.tag === 'template') {
      hdTemplate(child, result);
    } else {
      result.push(child);
    }
  });
  return result;
}
// 处理v-if指令
function hdVif(childs) {
  let result = [];
  let inConditionChain = false; // 条件链标识
  childs.forEach((child) => {
    const { attrs, type } = child;
    if (type === 1) {
      const v_if = attrTool.get(attrs, 'v-if'),
        v_else_if = attrTool.get(attrs, 'v-else-if'),
        v_else = attrTool.get(attrs, 'v-else');
      if (v_if) {
        inConditionChain = true; // v-if 条件链开始
        if (v_if.value) {
          result.push(child);
          inConditionChain = false; // v-if 为 true 时，条件链结束
        }
      } else if (v_else_if) {
        if (v_else_if.value && inConditionChain) {
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
    } else if (type === 3 || child.type === 8) {
      result.push(child);
    }
  });
  return result;
}
// 渲染dom
function createDom(ast) {
  const pEl = createEl('div');
  createNode(ast, pEl);
  return pEl;
}
export function _tpl(template, data) {
  const ast = parseHtmlToAst(template);
  const fragment = createFrag();
  const nodes = createDom(vnode(ast, data)).children[0].childNodes;
  [...nodes].forEach((item) => {
    fragment.appendChild(item);
  });
  return fragment;
}
_tpl.getAst = function (html) {
  return parseHtmlToAst(html);
};
_tpl.getVnode = function (html, data) {
  return vnode(_tpl.getAst(html), data);
};
_tpl.getDom = function (html, data) {
  return createDom(vnode(_tpl.getAst(html), data)).children[0].children;
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
    let divTemp = createEl('div');
    let nodes = null;
    let fragment = createFrag();
    divTemp.innerHTML = html;
    nodes = divTemp.childNodes;
    nodes.forEach((item) => {
      fragment.appendChild(item.cloneNode(true));
    });
    target.appendChild(fragment);
    // 在最前插入 prepend
    // this.insertBefore(fragment, this.firstChild);
    nodes = null;
    fragment = null;
  } else {
    target.appendChild(html);
  }
};
