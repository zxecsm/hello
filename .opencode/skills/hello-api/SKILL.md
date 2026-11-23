---
name: hello-api
description: 智能操作 hello 自托管主页的数据：书签、笔记、待办、倒计时、文件、分享、壁纸、音乐、聊天、剪切板、回收站、管理员只读状态。当用户说「加书签 / 收藏网址 / 记笔记 / 加待办 / 建倒计时 / 看文件 / 清理分享 / 发消息 / 同步剪切板 / 查一下 hello」等，先查现状、让用户选择、自动补全网页标题描述、写前预览确认，再通过零依赖 CLI 调用 /api。支持远程实例：地址与 Cookie 放在本地 .env，智能体不接触明文。
---

# hello 数据接口操作（智能工作流）

用项目自带的零依赖 CLI 访问运行中的 hello 实例，而不是直接改数据库：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs <命令> [选项]
```

所有命令都在项目根目录执行。CLI 会读取 `.env` / `hello.config.json` / 本地登录态，自动携带 Cookie。

**目标不是“会调接口”，而是像人一样先问清楚、再安全执行。**
每个任务都按：**定位 → 选择 → 补全 → 预览确认 → 执行 → 回报**。

> 详细的分域流程、边界情况和批量写法见
> [references/workflows.md](./references/workflows.md)；
> 接口参数见 [references/api.md](./references/api.md)；
> 全部路由见 [references/routes.md](./references/routes.md)；
> 连接与 token 见 [references/setup.md](./references/setup.md)；
> 完整接口文档见项目根目录 `docs/API.md`。
>
> **执行具体任务前，先读 workflows.md 对应章节**；需要精确参数时再查 api.md。

---

## 0. 工作原则（每次任务都适用）

1. **先读后写**：先查列表/详情，再决定改什么；不要凭记忆猜 ID。
2. **不猜关键参数**：分组、笔记、待办、文件、分享、聊天对象缺失时，先列候选让用户选。
3. **写前预览**：把「目标 + 变更 + 影响」展示给用户，确认后再执行。
4. **删除必须确认**：删除、清空、永久删除、覆盖、退出登录都要单独确认；清空再加一次。
5. **自动补全**：网址自动取标题/描述；相对日期自动算成 `YYYY-MM-DD`；文件路径先用 `ls` 校验；聊天对象先解析 `account`。
6. **新增先查重**：书签比链接、笔记比标题、待办比内容、倒计时比标题+日期、文件比同名。
7. **一次问完**：能从上下文推断的先推断并写进预览，不要拆成很多轮追问。
8. **不自行加 `--yes`**：CLI 对删除类操作会拒绝；看到提示时先问用户，不要绕过。
9. **保护隐私**：不读取 `.env`、Cookie、`.hello-session.json`；不把凭据写进回复或提交。
10. **结果可追踪**：回报新建/修改的 ID、名称、位置；列表只展示关键字段，不倾倒大 JSON。

---

## 1. 标准交互流程

### 1.1 用 `question` 给选项

优先用当前环境的交互选择工具（OpenCode 中是 `question`）；没有时用编号列表让用户回复序号。

- 选项 **2–10 个**；太多就先按关键词过滤或分页。
- 需要多选时加 `multiple: true`，并在问题里说明最多可选多少条（如聊天转发最多 200 条）。
- 推荐项放第一个，label 末尾标 `(推荐)`。
- `description` 里放 **ID、数量、时间、状态** 等关键信息。
- 永远提供「新建 / 其他 / 取消」出口。

```js
question({
  questions: [
    {
      header: '选择书签分组',
      question: '要添加到哪个分组？',
      options: [
        { label: '开发工具', description: 'id: abc123' },
        { label: '主页 (home)', description: '固定分组，显示在主页' },
        { label: '新建分组', description: '先创建，再把书签放进去' },
      ],
    },
  ],
});
```

### 1.2 写操作预览

```
将要执行：新增书签
分组：开发工具（abc123）
标题：OpenAI
链接：https://openai.com
描述：AI 研究与产品
重复检查：该分组内没有相同链接
确认执行吗？
```

只有用户确认后才调用写接口。成功后回报：

```
已添加：OpenAI → 开发工具
书签 id：xxx
```

### 1.3 用户已经给全参数

可以跳过选择，但仍然要：

1. 校验格式（URL、日期、长度）；
2. 查重；
3. 预览确认（除非用户明确说「直接做，不用问」）。

### 1.4 参数补全顺序

| 参数状态 | 做法 |
| --- | --- |
| 用户已经给了 | 校验格式，不重复问 |
| 列表里唯一匹配 | 直接用，在预览里标出匹配依据 |
| 列表里多个匹配 | 用 `question` 让用户选 |
| 可以自动获取 | 网址用 `meta`，日期按今天计算，文件用 `file ls`，聊天对象用 `chat users` |
| 仍然缺失 | 一次问完，不要挤牙膏 |

---

## 2. 能力地图

| 需求 | 先查 | 常用命令 | 详细流程 |
| --- | --- | --- | --- |
| 书签增删改查/分组/分享 | `bmk groups`、`bmk list` | `bmk add/rm`、`meta`、`api /api/bmk/*` | [书签](./references/workflows.md#2-书签-apibmk) |
| 笔记增删改查/分类/公开 | `note list`、`note categories` | `note add/get/set/rm`、`api /api/note/*` | [笔记](./references/workflows.md#3-笔记-apinote) |
| 待办增删改/完成 | `todo list` | `todo add/done/undo/rm` | [待办](./references/workflows.md#4-待办-apitodo) |
| 倒计时增删改/启停 | `count list` | `count add/rm`、`api /api/count/*` | [倒计时](./references/workflows.md#5-倒计时-apicount) |
| 文件浏览/读写/移动/删除/分享 | `file ls` | `file cat/write/mkdir/mv/rm`、`api /api/file/*` | [文件](./references/workflows.md#5-文件-apifile) |
| SSH 文件管理 | `ssh sftp-list --path <目录>` | `ssh sftp-up/sftp-down`、`api /api/ssh/sftp-*` | [SSH](./references/workflows.md#13-ssh-apissh) |
| 分享列表/删除/清空/停用/编辑 | `share list` | `share rm`、`api /api/user/*share*` | [分享](./references/workflows.md#7-分享-apiuser) |
| 剪切板读写 | `clipboard get` | `clipboard send` | [剪切板](./references/workflows.md#7-剪切板) |
| 壁纸/图床/音乐 | `bg list`、`music list` | `bg set/collect`、`music search/random` | [壁纸/音乐](./references/workflows.md#8-壁纸--图床--音乐) |
| 聊天发消息/读记录/撤回/转发 | `chat users`、`read-msg` | `chat send`、`api /api/chat/*` | [聊天](./references/workflows.md#10-聊天-apichat) |
| 回收站恢复/彻底删除 | `trash list` | `trash recover/rm` | [回收站](./references/workflows.md#11-回收站--管理员--公开接口) |
| 管理员只读状态 | — | `admin users/status/logs` | 同上 |
| 未封装接口 | — | `api <METHOD> <PATH>` | [通用 api](./references/workflows.md#12-通用-api-调用) |

---

## 3. 书签：完整示范

**触发**：加书签、收藏网址、保存链接、把这个网站记下来。

### 3.1 取分组并让用户选

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
```

返回 `data.list`（分组数组，元素含 `id/title/share`）和 `data.home`。
`home` 是固定的「主页」分组，不在 `list` 里，也要作为选项。

```js
question({
  questions: [
    {
      header: '选择书签分组',
      question: '要添加到哪个分组？',
      options: [
        { label: '主页 (home)', description: '固定分组，显示在主页' },
        { label: '<分组名>', description: 'id: <分组id>' },
        { label: '新建分组', description: '先输入分组名，创建后再添加' },
      ],
    },
  ],
});
```

**如果用户已经明确说了分组名**：先在分组列表里匹配；匹配到多个同名分组时让用户选；匹配不到再问是否新建，不要直接用错的分组。
**如果用户没说**：必须问，不要默认 `home`。

新建分组后要重新拉列表拿 id（`add-group` 不返回 id）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk add-group --title "分组名"
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
```

### 3.2 补全网址并自动取标题/描述

用户没给链接就问一次；只给域名时补成 `https://`。

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs meta --link "https://example.com"
```

输出：

```json
{ "link": "https://example.com", "title": "Example Domain", "des": "", "source": "网页 HTML" }
```

- 有标题/描述：展示给用户，允许修改。
- 为空或抓取失败（退出码 1）：请用户手动给标题，**不要编造**。
- 用户明确要自己写标题/描述时，以用户为准。

### 3.3 查重

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk list --group <分组id>
node .opencode\skills\hello-api\scripts\hello.mjs bmk search --word "<域名或关键词>"
```

在返回结果里比较链接（忽略末尾 `/`、大小写主机名）：`home` 分组看 `data.home`，
其他分组看 `data.list[].item`。
重复时问：「仍然添加 / 跳过 / 编辑原书签」。

### 3.4 预览并执行

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk add `
  --title "OpenAI" `
  --link "https://openai.com" `
  --des "AI 研究与产品" `
  --group <分组id>
```

用户同意自动补全时，也可以：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk add `
  --link "https://openai.com" `
  --group <分组id> `
  --auto
```

### 3.5 书签的修改 / 删除 / 移动

- 修改：先 `bmk list --group <id>` 拿到完整的 `group_id/title/link/des`，再
  `api POST /api/bmk/edit-bmk --set ...`；只改一个字段也要把原字段带上。
- 移动：`api POST /api/bmk/bmk-to-group --set groupId=<目标> --set 'ids=["<id>"]'`。
- 删除：先列候选让用户选，确认后 `bmk rm --id <id> --yes`（进回收站）。
- 清空全部：必须用户明确要求并二次确认，用 `api POST /api/bmk/delete-bmk` + `ids: []`。

批量、编辑、分享的完整写法见
[workflows.md 的书签章节](./references/workflows.md#1-书签-apibmk)。

---

## 4. 其他高频任务（速查）

### 笔记

1. `note list --word 关键词` 查重；
2. 问标题、内容来源（直接给 / 本地文件 / 生成草稿）、可选分类（`note categories`）；
3. 预览标题、分类、前几行、大小（≤100 KB）；
4. `note add --title ... --file ...`，返回 id 后再 `api /api/note/set-category`。

修改先 `note get`，再 `note set`；删除用 `note rm --id ... --yes`。
`about` / `tips` 不可删。

### 待办

1. `todo list` 查重；
2. 用户一次说多件事时先问「拆成多条还是一条」；
3. `todo add --content ...`；
4. 完成/取消：`todo done/undo --id ...`；
5. 删除是硬删除，必须确认：`todo rm --id ... --yes`。

### 倒计时

1. 问标题、开始/结束日期；
2. 「还有 30 天」「下个月考试」按当前日期算成具体 `YYYY-MM-DD`；
3. 开始必须早于结束；
4. `count add --title ... --start ... --end ... [--link ...]`。

修改/启停/置顶用 `api /api/count/edit|state|top`。

### 文件

1. **先 `file ls --path <目录>`**，不要猜路径；目录较大时调大 `--size` 或用 `--page` 翻页；
2. 读：`file cat --path /a.md`；二进制给下载地址 `/api/f/<path>`；
3. 写：先查同名，问「覆盖 / 改名 / 取消」，再 `file write`；
4. 重命名：`file mv`；移动/复制：`api /api/file/move|copy`，先 `same-name` 查冲突；
5. 删除：默认回收站，`--force` 仅限用户明确要求；
6. 返回 `{ key }` 时用 `task info --key ...` 轮询。

### 分享

1. `share list` 展示类型、标题、过期时间、状态；
2. 删除单条/多条：`share rm --id ... --yes`；
3. 清空全部：用户明确要求 + 二次确认，`api POST /api/user/delete-share` + `ids: []`；
4. 停用/启用：`api /api/user/share-state`；编辑：`api /api/user/edit-share`（编辑后旧访问 token 失效）。

### 剪切板

1. 先 `clipboard get`，展示旧内容摘要；
2. 确认覆盖后 `clipboard send --text ...` 或 `--file ...`；
3. 每个账号只保存一条，上限 1 MB。

### 壁纸 / 音乐

- `bg list --type bg|bgxs [--collect]` → 让用户选 → 确认 → `bg set --type ... --id ...`。
- 音乐：`music list --group all`、`music search --word ...`、`music random --out ...`；
  播放控制在网页端，CLI 只查询/下载。
- 壁纸库删除、图床删除等写操作先确认；管理员接口不要主动调用。

### 聊天

1. `chat users --word "关键词"` 解析 `account`；多个候选让用户选；
2. 发消息前预览收件人和内容，确认后 `chat send --to <account> --content ...`；
3. 读记录：`api GET /api/chat/read-msg --query account=... --query type=0`
   （**读取会标记已读**，先说明）；
4. 撤回只能撤回自己的消息：`api POST /api/chat/delete-msg`，body `{ to, ids: [...] }`；
5. 转发：`api POST /api/chat/forward`，body `{ to, ids: [...] }`；
6. 清空会话是 `ids: []`，必须用户明确要求并二次确认。

---

## 5. 命令与配置

### 连接

推荐把地址和 Cookie 写进脚本同目录的 `.env`（已被 git 忽略），用户自己填写，智能体不要代填或读取：

```dotenv
HELLO_BASE_URL=https://hello.example.com
HELLO_COOKIE=token=页面生成的token
```

检查配置（不显示 Cookie 内容）：

```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
node .opencode\skills\hello-api\scripts\hello.mjs config
node .opencode\skills\hello-api\scripts\hello.mjs whoami
```

生成 token、续期、配置优先级、token 失效原因和连接排错见
[references/setup.md](./references/setup.md)。核心规则：

- 只有拿不到 Cookie、但知道账号密码时才用 `login`；远程操作优先 `.env` + Cookie。
- 命令行登录遇到图形/滑块验证码会以退出码 `3` 结束，此时改用 Cookie。
- 不要把 `--cookie` 明文写进命令；确实必须临时传时，先提醒用户会出现在命令记录里。

### 常用命令

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
node .opencode\skills\hello-api\scripts\hello.mjs bmk list --group <分组id>
node .opencode\skills\hello-api\scripts\hello.mjs meta --link https://example.com
node .opencode\skills\hello-api\scripts\hello.mjs note list --word 关键词
node .opencode\skills\hello-api\scripts\hello.mjs todo list
node .opencode\skills\hello-api\scripts\hello.mjs file ls --path /
node .opencode\skills\hello-api\scripts\hello.mjs share list
node .opencode\skills\hello-api\scripts\hello.mjs clipboard get
node .opencode\skills\hello-api\scripts\hello.mjs bg list --type bg
node .opencode\skills\hello-api\scripts\hello.mjs music list --group all
node .opencode\skills\hello-api\scripts\hello.mjs chat users --word 小明
```

完整命令用 `--help` 查看。

### 通用 api

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api GET  /api/bmk/list --query id=<分组id>
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/todo/add --set content=整理接口文档
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/note/search --data @body.json
```

- `GET` 用 `--query k=v`，不能带 body。
- `POST` 优先 `--set k=v`；数组、对象、嵌套结构用 `--data @文件.json`。
- `--full` 打印完整 `{code, codeText, data}`；默认只打印 `data`。
- `--out 文件` 保存二进制响应。

> Windows PowerShell 5.1 会吃掉内联 JSON 里的双引号。优先用 `--set key=value` 或
> `--data @body.json`；确实要内联时，双引号写成 `\"`。
> 写法示例：

```powershell
$body = Join-Path $env:TEMP 'hello-body.json'
'{ "ids": ["id1", "id2"] }' | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/note/delete --data "@$body"
Remove-Item $body -Force
```

---

## 6. 错误处理

| 现象 | 处理 |
| --- | --- |
| `未登录或登录态已过期`（code 2） | 让用户重新生成 token 或更新 `.env` 的 `HELLO_COOKIE`；不要改用 `login` 硬试 |
| `code: 0` 且 `data: 1` | 参数校验失败，按 `codeText` 修正字段，不要原样重试 |
| 403「已达上限」 | 书签单组 300、笔记 100 KB、聊天单次 200 条等；换分组/拆分/清理后再试 |
| 403「无权操作」 | 不是自己的数据，或普通账号访问了管理员接口 |
| 404「不存在」 | ID 过期或选错；重新列列表确认 |
| 返回 `{ key }` | 异步任务，用 `task info --key ...` 轮询；`state` 非 1 即结束 |
| `fetch failed` | 检查 `.env` 的 `HELLO_BASE_URL`；用 `config` 确认地址来源 |
| `meta` 取不到标题 | 让用户手动输入，不要编造；可再试 `pub site-info --link` |
| 中文输出乱码 | 先执行 `[Console]::OutputEncoding = [Text.Encoding]::UTF8` |

更多排查见 [setup.md](./references/setup.md)。

---

## 7. 安全规则（必须遵守）

1. **写操作前先向用户确认**：新增/修改/删除书签、笔记、待办、文件、分享、壁纸、聊天消息等。
2. **删除必须显式 `--yes`**：CLI 对 `rm` / `trash rm` 会以退出码 `2` 拒绝；看到提示先问用户，不要自行补 `--yes`。
3. **不要调用管理员写接口**（`/api/root/*` 的增删改、清库、改 token、改配置）。只读的 `admin users`、`admin status`、`admin logs` 可以用。
4. **不要操作 `about`、`tips` 笔记**，不要清空回收站、不要 `force` 永久删除，除非用户明确要求。
5. **不要读取、`cat`、`type`、`Get-Content`** `.env`、`.hello-session.json`、`hello.config.json`、`cookie.txt`。
6. **不要回显 Cookie**；需要确认状态时用 `config`（默认隐藏地址、不显示 Cookie 值）。
7. **不要猜测或暴力尝试账号密码**；远程操作优先使用用户提供的 Cookie。
8. 用户只问「有什么 / 查一下」时保持只读，不要顺手修改。

---

## 8. 已知限制

- 不封装 multipart 上传（`/api/file/up`、`/api/player/up`、`/api/bg/up`、`/api/pic/up`、`/api/ssh/sftp-up`），需要分片合并协议；如需上传，改用浏览器或参考 [routes.md](./references/routes.md)。
- 不处理 SSH 终端与长轮询 `POST /api/user/real-time`（body 需带 `page` / `pages` / `temids`）。
- 直接操作 SQLite 不在本技能范围；所有读写都走服务端 API，保证缓存、回收站、多端同步逻辑一致。
