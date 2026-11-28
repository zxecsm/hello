# 智能工作流手册

本文件把「用户的一句话」翻译成安全的操作步骤。核心不是背接口，而是：
**先查现状 → 让用户选 → 自动补全 → 预览确认 → 执行 → 回报**。

> 下文的 `CLI` 都指：
> `node .opencode\skills\hello-api\scripts\hello.mjs`
> 所有命令在项目根目录执行。

---

## 0. 通用交互协议

### 0.1 什么时候必须问

| 情况 | 处理 |
| --- | --- |
| 缺少目标 ID（分组、笔记、待办、文件、分享、用户） | 先列候选，用 `question` 让用户选，不要猜 |
| 有多个同名/相似对象 | 列出标题、ID、关键差异，让用户选 |
| 写操作（新增/修改/删除/移动/覆盖/发送） | 先预览「改什么、改成什么」，确认后执行 |
| 删除、清空、永久删除、退出登录 | 单独确认；清空再加一次确认 |
| 参数可由上下文推断 | 先推断并写进预览，让用户改，不要反复追问 |
| 用户明确说「直接做，不用问」 | 仍要防重和校验；删除类仍需确认 |

### 0.2 用 `question` 给选项

- 选项数控制在 **2–10 个**；超过就先按关键词过滤或分页。
- 推荐项放第一个，并在 label 末尾标 `(推荐)`。
- `description` 里放 **ID、数量、时间、状态** 等关键信息。
- 永远给一个「其他 / 新建 / 取消」出口。

示例：

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

### 0.3 写操作预览模板

执行前用一小段文字或表格展示：

```
将要执行：新增书签
分组：开发工具（abc123）
标题：OpenAI
链接：https://openai.com
描述：AI 研究与产品
重复检查：该分组内没有相同链接
确认执行吗？
```

确认后再调用写接口。成功后只回报关键结果：

```
已添加：OpenAI → 开发工具
书签 id：xxx
```

### 0.4 幂等 / 防重

新增前先查重：

- 书签：同一分组内比较 `link`（忽略末尾 `/`、大小写主机名）。
- 笔记：按标题搜索，存在同名时问「更新已有 / 仍然新建 / 改名」。
- 待办：按内容搜索，存在相同内容时问「再建一条 / 跳过 / 改成新内容」。
- 倒计时：按标题 + 结束日期查重。
- 文件：目标路径已存在时问「覆盖 / 自动改名 / 取消」。
- 分享：同一对象已有有效分享时提示，避免重复创建。

### 0.5 结果展示

- 列表默认只展示：名称、ID、关键字段（链接、状态、时间、数量）。
- 不把完整 JSON、完整笔记正文、聊天记录一次性倾倒给用户；需要时再展开。
- 多个结果用编号或表格；保留 ID，方便用户继续说「删第 2 个」。

---

## 1. 书签 `/api/bmk`

### 1.1 新增书签（标准示范）

**触发**：加书签、收藏网址、保存链接、把这个网站记下来。

1. **取分组**：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
```

返回 `data.list`（分组数组，元素含 `id/title/share`）和 `data.home`。
`home` 是固定的「主页」分组，不在 `list` 里，也要作为一个选项。

2. **让用户选分组**（如果用户已经明确说了分组名，先在上面列表里匹配；
匹配不到再问是否新建，不要直接用错的分组）：

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

如果选「新建分组」：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk add-group --title "分组名"
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
```

`add-group` 不返回 id，必须重新拉一次分组列表拿到新 id。

3. **补全网址**：用户没给链接就问一次；只给域名时补成 `https://`。

4. **自动取标题和描述**：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs meta --link "https://example.com"
```

输出 `{ link, title, des, source }`。

- 有标题/描述：展示给用户，允许改。
- 为空或抓取失败（退出码 1）：请用户手动给标题，不要编造。
- 用户明确要自己写标题/描述时，以用户为准。

5. **查重**：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk list --group <分组id>
```

在返回的 `item` 里比较链接；也可以先搜：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk search --word "<域名或关键词>"
```

发现重复时问：「仍然添加 / 跳过 / 编辑原书签」。

6. **预览并确认**：分组、标题、链接、描述、重复检查结果。

7. **执行**：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk add `
  --title "OpenAI" `
  --link "https://openai.com" `
  --des "AI 研究与产品" `
  --group <分组id>
```

也可以让 CLI 自动补全（适合用户已明确同意自动取标题）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk add `
  --link "https://openai.com" `
  --group <分组id> `
  --auto
```

8. **回报**：标题、分组名、书签 id；需要的话再给出分组链接。

### 1.2 批量新增

用户一次给多个网址时：

1. 逐个 `meta`，列出表格（标题/链接/描述）。
2. 只问一次分组，确认整批。
3. 用接口一次提交（1–200 条）：

```powershell
$body = Join-Path $env:TEMP 'hello-bmk-batch.json'
@'
{
  "groupId": "abc123",
  "bms": [
    { "title": "OpenAI", "link": "https://openai.com", "des": "AI" },
    { "title": "GitHub", "link": "https://github.com", "des": "代码托管" }
  ]
}
'@ | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/bmk/add-bmk --data "@$body"
Remove-Item $body -Force
```

单个分组上限 300 条，超出会返回 403「分组书签已达上限」。

### 1.3 修改 / 移动书签

1. 定位书签：`bmk list --group <分组id>`，按标题/链接找到 `id`。
2. 记下它当前的 `group_id`、`title`、`link`、`des`。
3. 问用户改什么；只改描述也要把原字段一起带上：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/bmk/edit-bmk `
  --set groupId=<当前分组> `
  --set id=<书签id> `
  --set title="完整标题" `
  --set link="https://..." `
  --set des="新描述"
```

4. 只移动分组时更简单：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/bmk/bmk-to-group `
  --set groupId=<目标分组> `
  --set 'ids=["<书签id>"]'
```

> `--set` 里写数组容易被 PowerShell 吃掉引号。优先用 `--data @body.json`，
> 或按上面的单引号写法；不确定就写临时 JSON 文件。

### 1.4 删除 / 清空书签

1. 先列出候选（`bmk list --group ...` 或 `bmk search`），让用户多选。
2. 展示「将删除 N 个：标题 / 链接」。
3. 确认后执行（默认进回收站）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk rm --id <id1> --id <id2> --yes
```

4. 清空全部书签是高风险操作：必须用户明确说「清空全部」，再单独确认一次；
   使用接口 `ids: []`：

```powershell
$body = Join-Path $env:TEMP 'hello-clear-bmk.json'
'{ "ids": [] }' | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/bmk/delete-bmk --data "@$body"
Remove-Item $body -Force
```

5. 删除后可提示：回收站 `trash list --type bmk` 可恢复。

### 1.5 分组管理 / 分享

- 新建分组：`bmk add-group --title "名称"`，然后重新 `bmk groups` 拿 id。
- 删除分组：`bmk rm-group --id <id> --yes`（分组内书签会一起进回收站，先说明）。
- 分组改名/排序：`api POST /api/bmk/edit-group --set id=... --set title=... [--set toId=...]`
- 分享分组：先确认分组不为空，再：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/bmk/share `
  --set id=<分组id> `
  --set title="分享标题" `
  --set expireTime=7 `
  --set pass=""
```

`expireTime` 单位是天，`0` 表示永久；`pass` 可空。接口返回新分享 id。

---

## 2. 笔记 `/api/note`

### 2.1 新建笔记

1. 先搜重：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs note list --word "关键词"
```

2. 问标题；内容来源三选一：
   - 用户直接给 Markdown；
   - 用户给本地文件（用 `--file`，避免 PowerShell 转义）；
   - 根据当前任务生成草稿，先给用户看再保存。
3. 可选分类：`note categories` 取列表，用 `question` 多选（最多 10 个）。
4. 预览：标题、分类、内容前几行、字节数（上限 100 KB）。
5. 执行：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs note add --title "周报" --file .\weekly.md
```

6. `note add` 会返回新笔记 id；如果用户选了分类，再用 id 设置分类：

```powershell
$body = Join-Path $env:TEMP 'hello-note-category.json'
'{ "id": "<笔记id>", "category": ["<分类id>"] }' | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/note/set-category --data "@$body"
Remove-Item $body -Force
```

### 2.2 修改笔记

1. `note list --word ...` 找到笔记，让用户选。
2. `note get --id <id>` 读取正文，确认这是要改的笔记。
3. 只改标题/正文：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs note set --id <id> --title "新标题" --file .\new.md
```

4. 只改某个字段时，未改的字段保持原值；`note set` 需要 `--title`，缺省就从 `note get` 的结果补上。
5. 公开/私密：`api POST /api/note/state --set share=1 --set 'ids=["<id>"]'`
6. 置顶：`api POST /api/note/top --set id=<id> --set top=100`
7. 改元信息：`api POST /api/note/edit-info`，字段 `id/title/create_at/update_at/visit_count`，日期 `YYYY-MM-DD`。

### 2.3 删除笔记

1. 搜索 + 多选，展示标题和更新时间。
2. 确认后：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs note rm --id <id1> --id <id2> --yes
```

3. `about`、`tips` 两个内置笔记不可删；清空全部要单独确认（`ids: []`）。

---

## 3. 待办 `/api/todo`

### 3.1 添加

1. 内容上限 500 字；用户一次说多件事时，先问「拆成多条还是一条」。
2. 查重：`todo list` 里找相同内容。
3. 预览要添加的条目；确认后逐条添加：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs todo add --content "整理接口文档"
```

### 3.2 完成 / 取消完成

1. `todo list`，优先展示未完成项（`state=1`）。
2. 让用户多选。
3. 完成：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs todo done --id <id1> --id <id2>
```

取消完成用 `todo undo --id ...`。

### 3.3 修改 / 删除

- 修改内容：`api POST /api/todo/edit --set id=<id> --set content="新内容"`
- 删除：`todo rm --id ... --yes`（硬删除，不能恢复）
- 清空：`api POST /api/todo/delete --set ids=[]`，必须二次确认。

---

## 4. 倒计时 `/api/count`

### 4.1 添加

1. 需要标题、开始日期、结束日期。
2. 用户说「还有 30 天」「下个月考试」时，按当前日期计算，并在预览里写清楚具体日期。
3. 开始日期默认今天；开始必须早于结束。
4. 可选关联链接，必须是 http/https。
5. 确认后：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs count add `
  --title "考试" `
  --start 2026-11-19 `
  --end 2026-12-19 `
  --link "https://example.com"
```

### 4.2 修改 / 启停 / 删除

- 修改：`api POST /api/count/edit --set id=... --set title=... --set start=YYYY-MM-DD --set end=YYYY-MM-DD [--set link=...]`
- 启停：`api POST /api/count/state --set state=0 --set 'ids=["<id>"]'`
- 置顶：`api POST /api/count/top --set id=<id> --set top=100`
- 删除：`count rm --id ... --yes`；清空同样需要二次确认。

---

## 5. 文件 `/api/file`

### 5.1 铁律

- 所有 `path` 都是**相对当前用户根目录**、以 `/` 开头。
- **不要凭空猜路径**。先 `file ls --path <目录>`，从返回项里拿准确名称。
- 目录和文件同名可能共存，操作时带 `--type dir|file`。
- 耗时操作（复制、移动、删除、压缩）可能返回 `{ key }`，要轮询任务。

### 5.2 查看 / 读取

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs file ls --path /
node .opencode\skills\hello-api\scripts\hello.mjs file cat --path /notes/a.md
```

- 目录较大时可以调大 `--size`，或用 `--page` 翻页。
- 文本文件返回 `type: text`，展示前几行即可，不要整篇倾倒。
- 二进制返回 `type: other`，可给下载地址：`/api/f/<path>`。

### 5.3 写入 / 新建

1. 先 `file ls --path <父目录>` 检查是否已存在。
2. 已存在时问「覆盖 / 改名 / 取消」。
3. 执行：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs file write --path /notes/a.md --file .\a.md
node .opencode\skills\hello-api\scripts\hello.mjs file mkdir --path /notes --name 归档
```

新建空文件：`api POST /api/file/create-file --set path=/notes --set name=a.txt`

### 5.4 重命名 / 移动 / 复制

重命名：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs file mv `
  --path /notes --name a.md --new-name b.md --type file
```

移动/复制（先查同名，再决定 `rename`）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/file/same-name --data "@same-name.json"
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/file/move --data "@move.json"
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/file/copy --data "@copy.json"
```

`move.json` / `copy.json` 结构：

```json
{
  "path": "/目标目录",
  "rename": 1,
  "data": [{ "name": "a.md", "path": "/源目录", "type": "file" }]
}
```

`same-name.json` 用同样的 `path` + `data`，只是不需要 `rename`，返回 `{ hasSameName: true/false }`。

返回 `{ key }` 时：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs task info --key "<key>"
```

`state` 为 `1` 表示进行中，`0` / `-1` 表示结束，读 `text` 看结果。

### 5.5 删除

1. 确认名称、路径、类型，展示「将删除：/notes/a.md」。
2. 默认进回收站：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs file rm --path /notes --name a.md --type file --yes
```

3. `--force` 是永久删除，只有用户明确要求时才加；不要顺手加。
4. 返回 `{ key }` 时轮询任务。

### 5.6 分享 / 压缩

- 创建文件分享：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/file/share `
  --set title="分享标题" `
  --set expireTime=7 `
  --set pass="" `
  --set 'data={"name":"a.md","path":"/notes","type":"file","size":1234}'
```

需要问：标题、有效天数（`0` 永久）、提取码。
- 压缩/解压：`api POST /api/file/zip` / `/api/file/unzip`，先确认路径，返回 `{ key }` 时轮询。
- 上传是 multipart 分片协议，CLI 不封装；需要上传时让用户用页面，或参考 `routes.md`。

---

## 6. 分享 `/api/user`

### 6.1 查看

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs share list
```

展示：类型（`bookmk/music/dir/file`）、标题、提取码、过期时间、状态。

### 6.2 删除单条 / 多条

1. 让用户从列表里选。
2. 确认后：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs share rm --id <id1> --id <id2> --yes
```

### 6.3 清空全部

必须用户明确说「清空全部分享」，再单独确认一次：

```powershell
$body = Join-Path $env:TEMP 'hello-clear-share.json'
'{ "ids": [] }' | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/user/delete-share --data "@$body"
Remove-Item $body -Force
```

清空后所有分享链接立即失效。

### 6.4 停用 / 启用 / 编辑

- 停用：`api POST /api/user/share-state --set state=0 --set 'ids=["<id>"]'`
- 启用：`state=1`
- 编辑标题/有效期/提取码：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/user/edit-share `
  --set id=<id> --set title="新标题" --set expireTime=30 --set pass="1234"
```

注意：编辑后分享的旧访问 token 会失效，需要重新获取链接。

---

## 7. 剪切板

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs clipboard get
node .opencode\skills\hello-api\scripts\hello.mjs clipboard send --text "要同步的文字"
node .opencode\skills\hello-api\scripts\hello.mjs clipboard send --file .\snippet.txt
```

- 每个账号只保存一条，发送会**覆盖**旧内容。
- 覆盖前先 `get` 并展示旧内容摘要，确认后再发送。
- 上限 1 MB；内容含引号/换行时优先 `--file`。

---

## 8. 壁纸 / 图床 / 音乐

### 壁纸

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bg list --type bg
node .opencode\skills\hello-api\scripts\hello.mjs bg list --type bgxs
node .opencode\skills\hello-api\scripts\hello.mjs bg set --type bg --id <id>
```

- `type`：`bg` 桌面 / `bgxs` 移动端。
- `--collect` 只看收藏。
- 列表只返回 `{id, type}`；需要给用户预览时，拼图片地址 `/api/f/bg/<id>`。
- 设置当前壁纸是写操作，先让用户选并确认。
- 收藏/取消：`bg collect --id ...`；删除壁纸库仅管理员，不要主动做。

### 图床

- 列表：`api GET /api/pic/list --query pageNo=1 --query pageSize=20`
- 删除：`api POST /api/pic/delete --data '["<id>"]'`（body 是字符串数组），删除前确认。
- 图片地址：`/api/f/pic/<id>`。

### 音乐

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs music list --group all
node .opencode\skills\hello-api\scripts\hello.mjs music search --word "关键词"
node .opencode\skills\hello-api\scripts\hello.mjs music random --out "$env:TEMP\hello-random.mp3"
```

- 列表展示歌名、歌手、专辑、时长。
- `music list` 返回的是歌单数组；`id=all` 那个歌单的 `item` 才是全部歌曲，其他歌单同理。
- 播放控制在网页端，CLI 只负责查询/下载。
- 收藏/加入歌单等写操作使用 `/api/player/*`，先确认歌曲和歌单。

---

## 9. 聊天 `/api/chat`

### 9.1 发消息

1. 解析收件人：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs chat users --word "小明"
```

返回 `username/account/des/online/msg`；`account` 才是发送用的 ID。

2. 有多个候选时用 `question` 让用户选，展示用户名、备注、最后一条消息。
3. 预览：收件人、消息内容（长消息先展示前几行）。
4. 确认后：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs chat send --to <account> --content "你好"
```

### 9.2 读消息

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api GET /api/chat/read-msg `
  --query account=<account> --query type=0
```

- 每次固定 50 条，按 `serial` 升序。
- **读取会把这些消息标记为已读**，如果用户只是想知道内容，先说明这个副作用。
- 需要更早的消息：带 `--query flag=<游标消息id> --query type=1`。
- 按关键词/日期：`word`、`start`、`end`（`YYYY-MM-DD`）。

### 9.3 撤回 / 清空

1. 先读消息，确认消息 `id` 和 `_from` 是自己。
2. 只能撤回自己发送的消息。
3. 撤回多条：

```powershell
$body = Join-Path $env:TEMP 'hello-chat-del.json'
'{ "to": "<account>", "ids": ["msg1", "msg2"] }' | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/chat/delete-msg --data "@$body"
Remove-Item $body -Force
```

4. 清空会话是 `ids: []`，会删除双方全部消息；必须用户明确要求并二次确认。
   聊天室清空仅管理员可执行。

### 9.4 转发

1. 从源会话读出消息，让用户多选（最多 200 条）。
2. 用 `chat users` 选目标用户。
3. 确认后：

```powershell
$body = Join-Path $env:TEMP 'hello-chat-forward.json'
'{ "to": "<目标account>", "ids": ["msg1", "msg2"] }' | Set-Content $body -Encoding utf8
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/chat/forward --data "@$body"
Remove-Item $body -Force
```

### 9.5 备注 / 草稿 / 免打扰

- 备注：`api POST /api/chat/setdes --set account=<account> --set des="同事"`
- 读草稿：`api GET /api/chat/draft --query account=<account>`
- 存草稿：`api POST /api/chat/draft --set account=<account> --set draft="..."`
- 免打扰：`api POST /api/chat/dnd-mode --set account=<account> --set notify=0`

---

## 10. 回收站 / 管理员 / 公开接口

### 回收站

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs trash list --type bmk
node .opencode\skills\hello-api\scripts\hello.mjs trash recover --type note --id <id>
node .opencode\skills\hello-api\scripts\hello.mjs trash rm --type note --id <id> --yes
```

- `type`：`bmk`、`bmk_group`、`note`、`history`、`ssh`。
- 恢复/彻底删除前先列出内容让用户选。
- `trash rm` 不传 `--id` 表示清空该类型，必须二次确认。
- 不要把 `about`、`tips` 笔记、回收站清空当作顺手操作。

### 管理员（只读）

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs admin users --word "关键词"
node .opencode\skills\hello-api\scripts\hello.mjs admin status
node .opencode\skills\hello-api\scripts\hello.mjs admin logs
```

不要调用 `/api/root/*` 的增删改、清库、改 token、改配置接口。

### 公开接口

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs pub site-info --link https://example.com
node .opencode\skills\hello-api\scripts\hello.mjs pub icon --link example.com --out "$env:TEMP\icon.png"
```

公开接口默认可能被管理员关闭；登录用户通常不受影响。

---

## 12. SSH `/api/ssh`

SSH 模块需要先连接才能使用 SFTP 功能。

### 12.1 连接 SSH

1. 先列出 SSH 配置：`ssh list`（或 `api GET /api/ssh/search`）
2. 让用户选择要连接的配置
3. 调用 `api POST /api/ssh/connect --set id=<配置id> --set defaultPath=<默认路径>`
4. 连接结果通过长轮询推送，CLI 会自动处理

### 12.2 SFTP 文件操作

**列目录：**
```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api GET /api/ssh/sftp-list --query path=/远端/路径
```

**上传文件：**
```powershell
# 需要 multipart，CLI 不直接支持，改用浏览器或 curl
curl -X POST "http://localhost:55555/api/ssh/sftp-up?path=/远端/目录&name=文件名" \
  -H "Cookie: token=..." \
  -H "x-tem-id: <会话id>" \
  --form "file=@本地文件"
```

**下载文件：**
```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api GET /api/ssh/sftp-down --query path=/远端/文件 --query id=<会话id> --out 保存路径
```

**重命名/删除：**
```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/ssh/sftp-rename --set path=/远端/旧路径 --set name=新名称
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/ssh/sftp-delete --set paths='[""/远端/文件1"," /远端/文件2"]'
```

注意：
- SFTP 接口需要 `x-tem-id` 请求头（连接时返回的会话 ID）
- `sftp-list` 返回的 `mtime` 是毫秒时间戳
- 批量删除使用 `paths` 数组，单次最多 200 项

---

## 11. 通用 `api` 调用

没有封装成子命令的接口：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api GET /api/bmk/list --query id=<分组id>
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/todo/add --set content=整理接口文档
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/note/search --data @body.json
```

规则：

- `GET` 用 `--query k=v`，不能带 body。
- `POST` 优先 `--set k=v`；数组、对象、嵌套结构优先 `--data @文件.json`。
- `--full` 打印完整 `{code, codeText, data}`；默认只打印 `data`。
- `--out 文件` 保存二进制响应。
- PowerShell 5.1 会吃掉内联 JSON 的双引号，尽量用 `--set` 或 `--data @file`。
- 参数校验失败通常是 HTTP 400、`code: 0`、`data: 1`，看 `codeText` 里的字段名。

### 异步任务

返回 `{ "key": "..." }` 时：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs task info --key "<key>"
```

`state`：`1` 进行中，`0` / `-1` 结束；`text` 是进度或最终结果。
需要中止：`task cancel --key "<key>"`。

---

## 13. 自然语言映射

| 用户说 | 先做什么 | 再做什么 |
| --- | --- | --- |
| 加个书签 / 收藏这个网站 | `bmk groups` | 选分组 → 取 URL → `meta` → 查重 → 确认 → `bmk add` |
| 把书签移到另一个分组 | `bmk list --group <当前>` | 选书签 → 选目标分组 → `bmk-to-group` |
| 删掉那个书签 | `bmk search` / `bmk list` | 列候选 → 确认 → `bmk rm --yes` |
| 记一下 / 写篇笔记 | `note list --word` | 查重 → 标题 → 内容来源 → 分类 → 预览 → `note add` |
| 把笔记改成…… | `note list` + `note get` | 选笔记 → 改字段 → 预览 → `note set` |
| 加个待办 | `todo list` | 查重 → 确认 → `todo add` |
| 这个做完了 | `todo list` | 选未完成项 → `todo done` |
| 建个倒计时 | 问标题/日期 | 算日期 → 预览 → `count add` |
| 看看文件 / 写个文件 | `file ls --path` | 选路径 → 读/预览 → `file cat/write` |
| 删文件 / 清空回收站 | `file ls` / `trash list` | 确认 → `file rm --yes` / `trash rm --yes` |
| 看 SSH 远端文件 | `ssh list` + `ssh sftp-list --path` | 选 SSH 配置 → 选目录 → 列文件 |
| SSH 上传/下载文件 | `ssh sftp-list --path` | 选文件 → 确认 → `ssh sftp-up` / `ssh sftp-down` |
| 清空分享 | `share list` | 二次确认 → `delete-share ids=[]` |
| 同步剪切板 | `clipboard get` | 展示旧内容 → 确认覆盖 → `clipboard send` |
| 换个壁纸 | `bg list --type` | 选壁纸 → 确认 → `bg set` |
| 给小明发消息 | `chat users --word` | 选账号 → 预览内容 → `chat send` |
| 撤回刚才的消息 | 读会话 | 选自己的消息 → 确认 → `delete-msg` |
| 把消息转发给…… | 读源会话 + `chat users` | 多选消息 → 选目标 → `forward` |
| 服务器状态怎么样 / 帮我分析健康状态 | `health` | 按第 15 节的顺序分析指标 → 给结论和建议 |

---

## 14. 异常处理

| 现象 | 处理 |
| --- | --- |
| `code: 2` 未登录/过期 | 让用户重新生成 token 或更新 `.env` 的 `HELLO_COOKIE`；不要改用 `login` 硬试 |
| `code: 0` + `data: 1` | 参数校验失败，按 `codeText` 修正字段，不要原样重试 |
| 403「已达上限」 | 书签单组 300、笔记 100 KB、聊天单次 200 条、SFTP 编辑文件 2 MB 等；换分组/拆分/清理后再试 |
| 403「无权操作」 | 不是自己的数据，或用了普通账号访问管理员接口 |
| 404「不存在」 | ID 过期或选错；重新列列表确认 |
| 返回 `{ key }` | 异步任务，轮询 `task info`，不要当失败 |
| `fetch failed` | 检查 `.env` 的 `HELLO_BASE_URL`；用 `config` 确认地址来源 |
| `meta` 取不到标题 | 让用户手动输入，不要编造；可再试 `pub site-info --link` |
| PowerShell JSON 报错 | 改用 `--set` 或 `--data @body.json`，不要和引号硬碰 |

---

## 15. 健康检查 `/healthz`

管理员只读接口，一次返回运行环境、系统资源、进程、数据库、缓存、任务和关键配置。注意路径不在 `/api` 前缀下。

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs health
node .opencode\skills\hello-api\scripts\hello.mjs admin health
node .opencode\skills\hello-api\scripts\hello.mjs health --json        # 完整信封
node .opencode\skills\hello-api\scripts\hello.mjs api GET /healthz     # 通用 api 调用
```

普通账号会返回 403「无权访问」；未登录返回 401 / 403，按 `codeText` 处理。

### 15.1 分析和汇报顺序

1. **可用性**：`status` 是否为 `ok`；`runtime.uptimeText` 与服务启动时间。
2. **资源水位**：
   - `system.mem.percent` > 90% 需要关注；`system.swap.percent` 持续增长说明内存压力大；
   - `system.disk.percent` > 85% 提醒清理，同时看 `system.disk.availableText`；
   - `system.cpu.percent` 偶发高正常，持续 > 80% 才需要排查；
   - `process.memory.heapUsedText` / `rssText` 结合运行时长判断是否持续上涨。
3. **数据库**：
   - `database.sizeText`、`walSizeText`、`shmSizeText`；
   - WAL 明显大于主库（例如数倍）说明写入频繁或长时间未 checkpoint；
   - `freelistCount` 偏大说明有较多空闲页；`tables` 可看各表数据量是否异常增长。
4. **缓存**：
   - `caches[].hitRateText` 判断命中率；
   - `stale` 是已过期但尚未清理的条目；
   - `evictions` 持续增长说明 `maxSize` 太小；
   - `size` 接近 `maxSize`、或 `expired` 增长很快时提示容量/TTL 可能需要调整。
5. **任务**：`tasks.timedTasks` 是否与预期一致；`runningTasks` 持续偏高说明后台任务堆积。
6. **配置**：核对 `config.trustProxy`、`config.cookieSecure`、`config.pubApi` 是否符合当前部署（反向代理、HTTPS、公开接口开关）。

### 15.2 汇报格式

- 先给一句总体结论：**正常 / 需要关注 / 有风险**。
- 只列异常项和关键指标，优先使用 `xxxText` 可读字段，不倾倒完整 JSON。
- 给出可执行建议（清理磁盘、调大缓存上限、检查反向代理、重启服务等），但不要自行修改配置。
- 用户要求深入分析时，再用 `--json` 或 `api GET /healthz` 获取完整数据。
