---
name: hello-api
description: 通过 HTTP API 操作 hello 自托管主页的数据：书签、笔记、待办、倒计时、文件、分享、壁纸、音乐、聊天、管理员只读状态等。支持远程实例：把地址和 Cookie 放在本地 .env 由脚本读取，智能体不接触明文。当用户要求「查/加/改/删书签」「写笔记」「管理待办」「看文件」「调用 hello 的接口」或需要用脚本访问本项目 /api 接口时使用。
---

# hello 数据接口操作

用项目自带的零依赖 CLI 访问运行中的 hello 实例，而不是直接改数据库。
所有命令都在项目根目录执行，脚本路径为 `.opencode/skills/hello-api/scripts/hello.mjs`。

## 前置条件

1. 知道远程 hello 实例地址，例如 `https://hello.example.com`。
2. 地址和登录 Cookie（`token=...`）已写入本地 `.env` 文件。**不需要用户名密码。**
3. 智能体全程不读取 Cookie 明文；需要确认状态时用 `config` 命令。

## 配置方式：本地 .env（推荐）

用户自己创建并填写，智能体不要代填、不要读取：

```powershell
Copy-Item .opencode\skills\hello-api\scripts\.env.example `
          .opencode\skills\hello-api\scripts\.env
```

`.env` 内容示例：

```dotenv
HELLO_BASE_URL=https://hello.example.com
HELLO_COOKIE=token=从浏览器复制的完整Cookie
```

该文件已被 `.gitignore` 忽略。之后所有命令自动读取，无需再传参。

检查配置是否就绪（默认隐藏地址、**不显示 Cookie 内容**，只显示来源和长度）：

```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
node .opencode\skills\hello-api\scripts\hello.mjs config
```

排错时确实需要看完整地址，再加 `--show-url`（不要加在普通查询里）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs config --show-url
```

验证连接（只输出账号信息，不输出凭据）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs whoami
```

配置优先级：

```
地址：--url  >  HELLO_BASE_URL  >  .env  >  hello.config.json  >  本地登录态  >  默认 localhost:55555
Cookie：--cookie  >  --cookie-file  >  HELLO_COOKIE  >  HELLO_COOKIE_FILE  >  .env  >  hello.config.json  >  本地登录态
```

## 其他连接方式

临时覆盖（会出现在命令记录里，非必要不用）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs whoami `
  --url "https://hello.example.com" `
  --cookie "token=xxxxx"
```

用单独文件存 Cookie：

```dotenv
HELLO_COOKIE_FILE=C:\path\to\cookie.txt
```

> 只有拿不到 Cookie、但知道账号密码时，才用 `login`。正常远程操作优先用 `.env` + Cookie。

常用查询：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
node .opencode\skills\hello-api\scripts\hello.mjs bmk list --group <分组id>
node .opencode\skills\hello-api\scripts\hello.mjs note list --word 关键词
node .opencode\skills\hello-api\scripts\hello.mjs todo list
node .opencode\skills\hello-api\scripts\hello.mjs file ls --path /
node .opencode\skills\hello-api\scripts\hello.mjs share list
```

完整命令用 `--help` 查看；接口细节见 [references/api.md](./references/api.md)，全部 245 条路由见 [references/routes.md](./references/routes.md)。

## 通用调用

没有封装成子命令的接口，用通用形式（自动带登录 Cookie）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api GET  /api/bmk/list --query id=<分组id>
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/todo/add --set content=整理接口文档
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/note/search --data @body.json
```

`--data` 支持内联 JSON 或 `@文件.json`；`--query k=v` 可重复；`--out 文件` 保存二进制响应。
默认只打印 `data`，加 `--full` 打印完整 `{code, codeText, data}`。

> Windows PowerShell 5.1 调用原生程序时会吃掉内联 JSON 里的双引号。优先用 `--set key=value` 或
> `--data @body.json`；确实要内联时，双引号要写成 `\"`，例如
> `--data '{\"content\":\"测试\"}'`。

## 典型工作流

### 添加书签

```powershell
# 先拿到分组 id；home 是“主页”固定分组
node .opencode\skills\hello-api\scripts\hello.mjs bmk groups
node .opencode\skills\hello-api\scripts\hello.mjs bmk add --title "OpenAI" --link "https://openai.com" --des "AI" --group <分组id>
```

### 新建/更新笔记

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs note add --title "周报" --file .\weekly.md
node .opencode\skills\hello-api\scripts\hello.mjs note set --id <笔记id> --title "周报" --file .\weekly.md
```

笔记 `--content` 直接传 Markdown；内容里含 `$`、引号、换行时优先用 `--file`，避免 PowerShell 转义问题。

### 待办

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs todo add --content "整理接口文档"
node .opencode\skills\hello-api\scripts\hello.mjs todo done --id <id>
```

### 读写文本文件

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs file ls --path /notes
node .opencode\skills\hello-api\scripts\hello.mjs file cat --path /notes/a.md
node .opencode\skills\hello-api\scripts\hello.mjs file write --path /notes/b.md --file .\local.md
```

文件路径是相对当前用户根目录的路径，必须以 `/` 开头。

## 敏感信息隔离（必须遵守）

- **不要读取、`cat`、`type`、`Get-Content` `.env`、`.hello-session.json`、`hello.config.json` 或 `cookie.txt`**。这些文件里有 Cookie，读取会把明文带进上下文。
- 不要要求用户在对话里粘贴 Cookie；让用户自己编辑 `.env`。
- 需要确认配置时执行 `config`：默认隐藏地址、只显示 Cookie 来源和长度，不输出 Cookie 值。
- 只有排错时才加 `--show-url` 查看完整地址；普通操作不要加。
- 需要验证登录态时执行 `whoami`，它只输出账号信息。
- 不要在命令中回显 Cookie（`echo $env:HELLO_COOKIE`、`--cookie` 明文等）；确实必须临时传时，先提醒用户该值会出现在命令记录中。
- 不要把 `.env` 或登录态文件的内容复制到回复、日志或提交记录里。

## 安全规则（必须遵守）

1. **写操作前先向用户确认**：新增/修改/删除书签、笔记、待办、文件、分享、壁纸等，先把“改什么、改成什么”告诉用户，得到同意再执行。
2. **删除必须显式 `--yes`**：CLI 对 `rm`/`trash rm` 会以退出码 `2` 拒绝执行；看到该提示时不要自行补 `--yes`，先问用户。
3. **不要调用管理员写接口**（`/api/root/*` 的增删改、清库、改 token、改配置）。只读的 `admin users`、`admin status` 可以用。
4. **不要操作 `about`、`tips` 笔记**，不要清空回收站、不要 `force` 永久删除，除非用户明确要求。
5. **不要把 Cookie、密码、`.hello-session.json` 的内容贴到回复或提交到 git**。Cookie 等同于登录凭证，泄露即可被他人操作账号。
6. 用户只问“有什么/查一下”时保持只读，不要顺手修改。
7. 远程操作时优先使用用户提供的 Cookie，**不要猜测或暴力尝试账号密码**。

## 故障排查

| 现象 | 原因 / 处理 |
| --- | --- |
| `请求失败 ... fetch failed` | 地址不对或无法访问；先跑 `config` 看 `baseUrl`，或检查 `.env` 里的 `HELLO_BASE_URL` |
| `未登录或登录态已过期`（code 2） | 让用户更新 `.env` 里的 `HELLO_COOKIE`，不要改去调 `login` |
| `config` 显示 `cookieSet: false` | 用户还没填 `.env`，或键名写错（应为 `HELLO_COOKIE`） |
| `需要图形/滑块验证码`（退出码 3） | 走的是账号密码登录；远程场景改用 `.env` + Cookie |
| `Cookie 无效` | Cookie 已过期/复制不完整，或复制成了别的站点；重新复制完整的 `token=...` |
| 中文输出乱码 | 先执行 `[Console]::OutputEncoding = [Text.Encoding]::UTF8` |
| `code: 0` 且 `data: 1` | 参数校验失败，看 `codeText` 里的字段名和原因 |
| 返回 `{ "key": "..." }` | 异步任务；用 `task info --key "..."` 轮询，`state` 非 1 即结束 |
| 返回二进制提示 | 该接口返回图片/音频；加 `--out 文件名` 保存 |
| `无权操作` | 用了普通账号访问 `/api/root/*`，或路径越界 |

## 已知限制

- 不封装 multipart 上传（`/api/file/up`、`/api/player/up`、`/api/bg/up`、`/api/pic/up`），需要分片合并协议；如需上传，改用浏览器或参考 [routes.md](./references/routes.md) 自行调用。
- 不处理 SSH 终端与长轮询 `/api/user/real-time`（CLI 请求模型不适合）。
- 直接操作 SQLite 不在本技能范围；所有读写都走服务端 API，保证缓存、回收站、多端同步逻辑一致。
