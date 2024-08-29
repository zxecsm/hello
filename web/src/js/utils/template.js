// id="app" id='app' id=app
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/;
// <my-header></my-header>
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z]*`;
// <my:header></my:header>
const qnameCapture = `((?:${ncname}\\:)?${ncname})`;
// <div
const startTagOpen = new RegExp(`^<${qnameCapture}`);
// > />
const startTagClose = /^\s*(\/?)>/;
// </div>
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`);
// 解析HTML
function parseHtmlToAst(html) {
  if (typeof html !== 'string') {
    return html;
  }
  html = `<div>${html}</div>`;
  let root,
    currentParent,
    stack = [];
  // 一直到html为''结束
  while (html) {
    // 判断是否<开头
    const index = html.indexOf('<');
    if (index < 0) break;
    if (index === 0) {
      // 解析标签和属性信息 <div id="app"> {tagName: 'div', attrs: [{name: 'id', value: 'app'}]}
      if (parseStartTag()) continue;
      // 匹配 </div>
      const endTagMatch = html.match(endTag);
      if (endTagMatch) {
        advance(endTagMatch[0].length);
        end();
        continue;
      }
    } else if (index > 0) {
      const text = html.slice(0, index);
      advance(text.length);
      chars(text);
    }
  }

  // <div id="app">
  function parseStartTag() {
    // <div
    const tagOpenMatch = html.match(startTagOpen);
    if (!tagOpenMatch) return null;

    const startTagInfo = {
      tagName: tagOpenMatch[1],
      attrs: [],
    };
    // 删除<div
    advance(tagOpenMatch[0].length);
    let endTagMatch, attrMatch;
    // 剩下的字符不是> />,匹配开始匹配属性"id"="app"
    while (
      !(endTagMatch = html.match(startTagClose)) &&
      (attrMatch = html.match(attribute))
    ) {
      startTagInfo.attrs.push({
        name: attrMatch[1],
        // 属性值可能是双引号可能是单引号可能没有引号三种情况
        value: attrMatch[3] || attrMatch[4] || attrMatch[5] || '',
      });
      // 删除已经匹配的属性
      advance(attrMatch[0].length);
    }
    // 匹配到结束 > />
    if (endTagMatch) {
      advance(endTagMatch[0].length);
      start(startTagInfo.tagName, startTagInfo.attrs);
      if (endTagMatch[0].trim() === '/>') {
        end();
      }
    }
    return startTagInfo;
  }

  // 删除已经处理的字符
  function advance(n) {
    html = html.substring(n);
  }
  // 创建元素信息
  function start(tagName, attrs) {
    const element = {
      tag: tagName,
      type: 1,
      children: [],
      attrs,
      parent,
    };
    if (!root) {
      root = element;
    }
    currentParent = element;
    stack.push(element);
  }

  // stack['div'] 每结束一个标签后确立父子关系
  function end() {
    const element = stack.pop();
    currentParent = stack[stack.length - 1];
    if (currentParent) {
      element.parent = currentParent;
      currentParent.children.push(element);
    }
  }
  // 创建文本节点
  function chars(text) {
    text = text.trim();
    if (text.length > 0) {
      currentParent.children.push({
        type: 3,
        text,
        parent: currentParent,
      });
    }
  }

  return root;
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
export function deepClone(obj) {
  //判断传入对象为数组或者对象
  const result = Array.isArray(obj) ? [] : {};
  // for in遍历
  for (let key in obj) {
    // 判断是否为自身的属性值（排除原型链干扰）
    if (obj.hasOwnProperty(key)) {
      // 判断对象的属性值中存储的数据类型是否为对象
      if (typeof obj[key] === 'object') {
        // 有可能等于null
        if (obj[key] === null) {
          result[key] = null;
          continue;
        }
        // 递归调用
        result[key] = deepClone(obj[key]); //递归复制
      }
      // 不是的话直接赋值
      else {
        result[key] = obj[key];
      }
    }
  }
  // 返回新的对象
  return result;
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
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
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
  } else if (ast.type === 3) {
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
    } else if (child.type === 3) {
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
    if (v_show && !v_show.value) {
      el.style.display = 'none';
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
    } else if (type === 3) {
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
  // console.log(createDom(vnode(ast, data)).children[0].innerHTML);
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
