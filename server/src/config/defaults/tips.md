# Hello 使用说明

> 功能速查：每个语法先给 **写法**，再给 **效果**。

::: tip 快速跳转
- [主页快捷键](#主页快捷键)
- [标题与锚点](#标题与锚点)
- [文本样式](#文本样式)
- [列表与任务](#列表与任务)
- [引用](#引用)
- [代码块](#代码块)
- [链接与图片](#链接与图片)
- [表格](#表格)
- [提示容器](#提示容器)
- [折叠内容](#折叠内容)
- [脚注](#脚注)
- [定义列表与缩写](#定义列表与缩写)
- [原始 HTML](#原始-html)
:::

## 主页快捷键

| 快捷键 | 功能 | 快捷键 | 功能 |
| :---: | :--- | :---: | :--- |
| <kbd>a</kbd> | 打开 / 关闭左侧菜单 | <kbd>s</kbd> | 打开搜索框 |
| <kbd>b</kbd> | 书签夹 | <kbd>h</kbd> | 搜索历史 |
| <kbd>n</kbd> | 笔记本 | <kbd>e</kbd> | 新建笔记 |
| <kbd>f</kbd> | 文件管理 | <kbd>p</kbd> | 图床 |
| <kbd>c</kbd> | 聊天室 | <kbd>u</kbd> | 用户管理 |
| <kbd>l</kbd> | 日志 | <kbd>t</kbd> | 终端管理 |
| <kbd>x</kbd> | 关闭所有窗口 | <kbd>q</kbd> | 隐藏所有窗口 |

### 音乐播放

| 快捷键 | 功能 |
| :---: | :--- |
| <kbd>space</kbd> | 播放 / 暂停 |
| <kbd>m</kbd> | 显示 / 收起播放器 |
| <kbd>o</kbd> | 关闭播放器 |
| <kbd>r</kbd> | 切换播放模式 |
| <kbd>Ctrl</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | 上一曲 / 下一曲 |
| <kbd>Ctrl</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd> | 音量加 / 减 |

### 触屏手势

| 手势 | 功能 |
| :--- | :--- |
| 上滑 | 打开音乐播放器 |
| 下滑 | 打开壁纸库 |
| 右滑 | 打开左侧菜单 |
| 左滑 | 打开设置菜单 |

## 标题与锚点

**写法**

```markdown
# 一级标题
## 二级标题
### 三级标题

[跳转到表格](#表格)
[回到顶部](#hello-使用说明)
```

**效果**

<div style="font-size: 1.9em; font-weight: 700; line-height: 1.4;">一级标题</div>
<div style="font-size: 1.5em; font-weight: 700; line-height: 1.6;">二级标题</div>
<div style="font-size: 1.25em; font-weight: 700; line-height: 1.8;">三级标题</div>

[跳转到表格](#表格)　[回到顶部](#hello-使用说明)

## 文本样式

| 写法 | 效果 |
| :--- | :--- |
| `*斜体*` 或 `_斜体_` | *斜体* 或 _斜体_ |
| `**加粗**` 或 `__加粗__` | **加粗** 或 __加粗__ |
| `***加粗斜体***` | ***加粗斜体*** |
| `~~删除线~~` | ~~删除线~~ |
| `` `行内代码` `` | `行内代码` |
| `==高亮==` | ==高亮== |
| `++插入线++` | ++插入线++ |
| `2^10^ = 1024` | 2^10^ = 1024 |
| `H~2~O` | H~2~O |
| `:smile: :rocket: :tada:` | :smile: :rocket: :tada: |

## 列表与任务

**写法**

```markdown
- 无序列表
- 无序列表
  - 二级列表

1. 有序列表
2. 有序列表

- [ ] 未完成
- [x] 已完成
```

**效果**

- 无序列表
- 无序列表
  - 二级列表

1. 有序列表
2. 有序列表

- [ ] 未完成
- [x] 已完成

## 引用

**写法**

```markdown
> 引用文本
>
> > 嵌套引用
```

**效果**

> 引用文本
>
> > 嵌套引用

## 代码块

**写法**

````markdown
```javascript
console.log('Hello, World!');
```
````

**效果**

```javascript
console.log('Hello, World!');
```

## 链接与图片

**写法**

```markdown
[Hello 项目地址](https://github.com/zxecsm/hello)

![图片描述](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
```

**效果**

[Hello 项目地址](https://github.com/zxecsm/hello)

![图片描述](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)

## 表格

**写法**

```markdown
| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 1 | 2 | 3 |
```

**效果**

| 左对齐 | 居中 | 右对齐 |
| :--- | :---: | ---: |
| 1 | 2 | 3 |

## 提示容器

**写法**

```markdown
::: tip 提示
适合放补充说明。
:::

::: info 说明
适合放背景信息。
:::

::: warning 注意
适合放需要留意的地方。
:::

::: danger 警告
适合放危险操作。
:::
```

**效果**

::: tip 提示
适合放补充说明。
:::

::: info 说明
适合放背景信息。
:::

::: warning 注意
适合放需要留意的地方。
:::

::: danger 警告
适合放危险操作。
:::

## 折叠内容

**写法**

````markdown
::: details 展开查看示例代码
```javascript
function greet(name) {
  return `Hello, ${name}`;
}
```
:::
````

**效果**

::: details 展开查看示例代码
```javascript
function greet(name) {
  return `Hello, ${name}`;
}
```
:::

## 脚注

**写法**

```markdown
正文可以添加脚注[^1]。

[^1]: 脚注会显示在文末，并自动编号。
```

**效果**

正文可以添加脚注[^1]。

[^1]: 脚注会显示在文末，并自动编号。

## 定义列表与缩写

**写法**

```markdown
Markdown
: 一种轻量级标记语言。

*[HTML]: HyperText Markup Language

HTML 是网页的基础。
```

**效果**

Markdown
: 一种轻量级标记语言。

*[HTML]: HyperText Markup Language

HTML 是网页的基础。

## 原始 HTML

**写法**

```markdown
键盘：<kbd>Ctrl</kbd> + <kbd>S</kbd>

高亮：<mark>高亮标签</mark>
```

**效果**

键盘：<kbd>Ctrl</kbd> + <kbd>S</kbd>

高亮：<mark>高亮标签</mark>

---

[回到顶部](#hello-使用说明)
