# hello 核心接口手册

> 完整路由表见 [routes.md](./routes.md)（从源码自动提取，248 条）。
> 本文件只收录智能体最常用、参数已核实的数据接口。

## 1. 基础约定

| 项 | 说明 |
| --- | --- |
| 默认地址 | `http://localhost:55555`（`server/data/config.js` 中的 `port`）；远程实例写 `.env` 的 `HELLO_BASE_URL` |
| 路径前缀 | 业务接口都在 `/api` 下 |
| 请求体 | `Content-Type: application/json`，字段名区分大小写 |
| 登录态 | 浏览器 Cookie 中的 `token`（httpOnly、AES-GCM 加密 JWT，默认 2 天）。CLI 用 `use-cookie` 保存后自动携带；也可直接用 `login` 换取 |
| 设备头 | 部分接口（`/api/file/read-dir`、`/api/task/*`）要求 `x-tem-id` 非空，CLI 自动生成 |
| 公开接口 | `/api/echo`、`/api/icon`、`/api/site-info`、`/api/music` 受 `server/data/config.json` 的 `pubApi` 开关控制 |
| 上传接口 | `multipart/form-data`，需要分片/合并协议，不在本手册范围内（见 [routes.md](./routes.md) 中 `file`、`player`、`bg`、`pic` 的 `/up`） |

### 响应信封

所有 JSON 接口统一返回：

```json
{ "code": 1, "codeText": "操作成功", "data": null }
```

| code | 含义 | 处理方式 |
| --- | --- | --- |
| `1` | 成功 | 读 `data` |
| `0` | 失败（HTTP 4xx/5xx） | 读 `codeText`，不要重试同样的参数 |
| `2` | 未登录 / 登录态过期 | 重新登录 |
| `3` | 长轮询无新数据（正常） | 继续轮询或结束 |

参数校验失败时返回 HTTP 400，`code: 0`、`data: 1`，`codeText` 形如 `字段名: 错误原因`。

### 异步任务

`/api/file/read-dir`、`/api/file/delete` 等耗时操作可能立刻返回 `{ "key": "账号_xxx" }`，而不是结果。
此时用任务接口轮询（CLI 封装为 `task info --key ...`）：

```
POST /api/task/info   { "key": "账号_xxx" }
→ data: { text: "读取文件列表...20", state: 1 }
```

`state`：`1` 进行中，`0` 或 `-1` 表示已结束/不存在，读 `text` 获取最终文案。
需要中止时 `POST /api/task/cancel { "key": "..." }`。

> `read-dir`、`task/*` 等接口要求请求头 `x-tem-id` 非空；CLI 会自动生成并持久化到本地登录态文件。

---

## 2. 登录与用户

远程实例推荐把地址和 Cookie 写进本地 `.env`（脚本同目录，已被 git 忽略），CLI 自动读取：

```dotenv
HELLO_BASE_URL=https://hello.example.com
HELLO_COOKIE=token=...
```

也可以临时传：`use-cookie --url "https://hello.example.com" --cookie "token=..."`。
检查状态用 `config`（默认隐藏地址、不显示 Cookie；排错可加 `--show-url`）。

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/user/login` | `username`, `password`, `captchaId?` | 可选；成功下发 Cookie；返回 `data.needCaptcha=true` 时需先完成验证码 |
| POST | `/api/user/create-token` | `days`：`1`-`3650` 的整数 | 生成指定有效期的认证 token，可直接作为 Cookie 使用：`token=<返回值>` |
| POST | `/api/user/logout` | `other`：`0` 退出当前，`1` 退出其他设备 | |
| GET | `/api/user/userinfo` | - | 当前用户：`account`、`username`、`logo`、`bg`、`bgxs`、`email`、`verify` 等 |
| GET | `/api/user/share-list` | `pageNo`(1), `pageSize`(20, ≤200) | 我创建的分享 |
| GET | `/api/user/trash-list` | `type`: `bmk`\|`bmk_group`\|`note`\|`history`\|`ssh`，`word?`，`pageNo`，`pageSize` | 回收站列表 |
| POST | `/api/user/recover-trash` | `type`, `ids: string[]`（`ids: []` 表示全部） | 恢复 |
| POST | `/api/user/delete-trash` | `type`, `ids: string[]`（`[]` 表示清空） | 永久删除 |
| GET | `/api/user/font-list` | - | 字体列表 |
| GET | `/api/user/tips` | - | tips 标识 |
| GET | `/api/user/clipboard` | - | 读取当前账号的剪切板文本：`data: {text}` |
| POST | `/api/user/clipboard` | `text`（UTF-8，1 B–1 MB） | 保存/覆盖剪切板文本 |

剪切板每个账号只保存一条，发送会覆盖旧内容；内容原样保存在用户配置目录的 `backup/clipboard`。

`account` 是随机 ID（如 `V1StGXR8_Z5jdHi6B-myT`），`username` 才是登录名；两者不要混用。
管理员账号固定为 `root`。

---

## 3. 书签 `/api/bmk`

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/bmk/list` | `id?`（分组 ID，`home` 为主页），`account?` | 不带 `id` 只返回分组列表；带 `id` 返回该分组书签 |
| POST | `/api/bmk/search` | `word`, `pageNo`, `pageSize`, `category: string[]`, `account?` | 按标题/链接/备注搜索 |
| POST | `/api/bmk/add-bmk` | `groupId`（`home` 或分组 ID）, `bms: [{title, link, des}]` | `link` 必须是 http/https；单组上限 300 |
| POST | `/api/bmk/edit-bmk` | `groupId`, `id`, `title`, `link`, `des`, `toId?` | `toId` 用于同时移动分组 |
| POST | `/api/bmk/delete-bmk` | `ids: string[]`（`[]` = 清空全部） | 软删除，进回收站 |
| POST | `/api/bmk/bmk-to-group` | `groupId`, `ids: string[]` | 批量移动书签 |
| POST | `/api/bmk/add-group` | `title` | 新建分组 |
| POST | `/api/bmk/edit-group` | `id`, `title`, `toId?` | 改名/排序 |
| POST | `/api/bmk/delete-group` | `ids: string[]` | 软删除分组 |
| POST | `/api/bmk/move-group` | `fromId`, `toId` | 调整分组顺序 |
| POST | `/api/bmk/move-bmk` | `groupId`, `fromId`, `toId` | 调整书签顺序 |

`GET /api/bmk/list` 返回：

```json
{ "list": [{ "id": "abc", "title": "分组名", "share": 0, "item": [{ "id": "...", "title": "...", "link": "...", "des": "", "logo": "", "group_id": "abc", "num": 0 }] }], "home": [] }
```

注意：`item` 只在请求了具体分组 `id` 且有权访问时出现。

---

## 4. 笔记 `/api/note`

笔记正文是 Markdown，单篇上限 100 KB（`fieldLength.noteSize`）。

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/note/search` | `word?`, `pageNo`, `pageSize`, `category: string[]`, `account?` | 列笔记/搜索；返回预览 `con`，不含正文 |
| GET | `/api/note/read` | `v`（笔记 ID）, `download`：`0`/`1` | 读正文；`data: {title, content, ...}` |
| POST | `/api/note/edit` | `id`, `title`, `content` | **id 不存在则新建**；新建时客户端自行生成 ID |
| GET | `/api/note/editing` | `id` | 读取编辑草稿（无草稿时 `editing: null`）；新笔记用 `id=new` |
| POST | `/api/note/editing` | `id`, `content`, `clear?` | 实时保存编辑草稿（静默请求）；`clear=1` 删除草稿；保存笔记正文时服务端自动清除；新笔记用 `id=new` |
| POST | `/api/note/edit-info` | `id`, `title`, `create_at`, `update_at`（`YYYY-MM-DD`）, `visit_count` | 改元信息 |
| POST | `/api/note/delete` | `ids: string[]`（`[]` = 清空，`about`/`tips` 不可删） | 进回收站 |
| POST | `/api/note/state` | `share`: `0`/`1`, `ids: string[]` | 公开/私密 |
| POST | `/api/note/top` | `id`, `top`（0–99999） | 置顶权重 |
| POST | `/api/note/set-category` | `id`, `category: string[]`（最多 10 个分类 ID） | 设置分类 |
| GET | `/api/note/category` | `account?` | 分类列表 `[{id, title}]` |
| POST | `/api/note/add-category` | `title`（≤30 字） | 新建分类 |
| POST | `/api/note/edit-category` | `id`, `title` | 改名 |
| POST | `/api/note/delete-category` | `id` | 删除分类 |

新建笔记的 ID 约束：`alphanumeric`，1–50 字符。CLI 用 32 位十六进制随机 ID。

---

## 5. 待办 `/api/todo` 与倒计时 `/api/count`

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/todo/list` | `pageNo`(1), `pageSize`(40, ≤200) | 返回 `data` 和 `undoneCount` |
| POST | `/api/todo/add` | `content`（≤500 字） | |
| POST | `/api/todo/state` | `ids: string[]`, `state`: `0` 完成 / `1` 未完成 | |
| POST | `/api/todo/edit` | `id`, `content` | |
| POST | `/api/todo/delete` | `ids: string[]`（`[]` = 清空） | 硬删除 |
| GET | `/api/count/list` | `pageNo`, `pageSize` | 返回 `data` 和 `expireCount` |
| POST | `/api/count/add` | `title`, `start`, `end`（`YYYY-MM-DD`）, `link?` | 开始必须早于结束 |
| POST | `/api/count/edit` | `id`, `title`, `start`, `end`, `link` | |
| POST | `/api/count/delete` | `ids: string[]`（`[]` = 清空） | 硬删除 |
| POST | `/api/count/state` | `ids: string[]`, `state`：`0`/`1` | 启用/停用 |
| POST | `/api/count/top` | `id`, `top` | 置顶权重 |

---

## 6. 文件 `/api/file`

路径规则：所有 `path` 都是**相对当前用户根目录**的路径，以 `/` 开头。管理员账号 `root` 的根目录就是 `server/app_data`（Docker 下通常是 `/` 挂载），普通用户是 `server/app_data/userFiles/<account>`。服务端会做路径越界校验。

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/file/read-dir` | `path`, `pageNo`(1), `pageSize`(20), `sortType`: `name`\|`time`\|`size`\|`type`, `isDesc`: 0/1, `subDir`: 0/1, `word`, `update`: 0/1, `hidden`: 0/1 | 列目录/搜索；可能返回 `{key}` 走任务轮询 |
| POST | `/api/file/read-file` | `path` | 文本文件返回 `{type:'text', data:'...', editing:'...'}`；`editing` 为本人未保存的编辑草稿（无草稿时为 `null`）；二进制返回 `{type:'other'}` |
| POST | `/api/file/save-file` | `path`, `text` | 写文本，上限 10 MB；成功后清除该路径的编辑草稿 |
| POST | `/api/file/editing` | `path`, `text`, `clear?` | 实时保存编辑草稿（静默请求；存于 `.h_config/file_editing/<path 的 md5>`）；`clear=1` 删除草稿 |
| POST | `/api/file/create-file` | `path`（父目录）, `name` | 新建空文件 |
| POST | `/api/file/create-dir` | `path`（父目录）, `name` | 新建目录 |
| POST | `/api/file/rename` | `name`（新名）, `data: {name, path, type}` | 重命名 |
| POST | `/api/file/delete` | `force`: 0/1, `data: [{name, path, type}]` | `force=0` 进回收站，`1` 永久删除；可能返回 `{key}` |
| POST | `/api/file/move` | `path`（目标目录）, `rename`: 0/1（重名时是否自动改名）, `data: [{name, path, type}]` | 移动，可能返回 `{key}` |
| POST | `/api/file/zip` / `/unzip` | 见源码 | 压缩/解压 |
| POST | `/api/file/share` | `title`, `expireTime`（天，0 永久）, `pass`, `data: {name, path, type, size}` | 创建文件分享 |
| GET | `/api/file/cd-history` | - | 最近访问目录 |
| GET | `/api/file/favorites` | - | 收藏目录 |

读取目录返回项包含：`name`、`type`（`file`/`dir`）、`size`、`time`、`path`、`fileType` 等。

下载文件：`GET /api/f/<path>`，例如 `/api/f/notes/a.pdf`；也可 `GET /api/f/?p=/notes/a.pdf`。

---

## 7. 壁纸 `/api/bg` 与图床 `/api/pic`

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/bg/list` | `type`: `bg`（桌面）\|`bgxs`（移动）, `collect`: 0/1, `pageNo`, `pageSize`(≤100) | 列表 |
| POST | `/api/bg/change` | `type`, `id` | 设为当前壁纸 |
| POST | `/api/bg/collect` | body 为 `string[]`（壁纸 ID 数组） | 收藏 |
| POST | `/api/bg/delete` | `ids: string[]`, `collect`：`0` 删除壁纸库（仅管理员）/ `1` 取消收藏 | 删除壁纸 |
| GET | `/api/bg/r/:type` | - | 随机壁纸图片（`/api/bg/r/d` 桌面、`/api/bg/r/m` 移动） |
| GET | `/api/pic/list` | `pageNo`, `pageSize` | 图床列表 `[{id}]` |
| POST | `/api/pic/delete` | body 为 `string[]`（图片 ID 数组） | 删除图片 |

图片地址：`/api/f/pic/<id>`（由 `server/routes/getfile` 统一处理）。

壁纸图片地址：`/api/f/bg/<id>`；歌曲文件地址：`/api/f/music/url/<id>`。

---

## 8. 音乐 `/api/player`

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/player/list` | `id?`（歌单 ID，`all` 为全部歌曲）, `pageNo`, `pageSize`(≤200), `sort`, `onlyMv` | 歌单与歌曲 |
| GET | `/api/player/search` | `word`, `pageNo` | 搜索歌曲（固定每页 100） |
| GET | `/api/music` | - | 随机播放一首，返回音频二进制 |

歌曲对象字段：`id`、`title`、`artist`、`album`、`duration`、`pic`/`lrc`/`url`/`mv`（布尔）、`collect_count`、`play_count`。

---

## 9. 聊天 `/api/chat`

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/chat/user-list` | `pageNo`, `pageSize`, `word?` | 成员列表（含在线状态、备注） |
| POST | `/api/chat/send-msg` | `to`（对方 account）, `content` | 发文字消息 |
| GET | `/api/chat/read-msg` | `account`（对方）, `type`: 0/1/2, `flag?`, `word?`, `start?`, `end?` | 读取会话（每次 50 条） |
| GET | `/api/chat/news` | - | 未读消息 |
| POST | `/api/chat/delete-msg` | 见源码 | 撤回消息 |
| POST | `/api/chat/setdes` | `account`, `des` | 设置好友备注 |
| GET | `/api/chat/draft` | `account`（对方） | 读取聊天草稿 `{draft}` |
| POST | `/api/chat/draft` | `account`（对方）, `draft`（≤3000 字） | 保存聊天草稿到 `friends.draft`（静默请求） |

群聊/助手账号是固定值（`chang` / `hello`），普通用户直接发消息基本用不到。

---

## 10. 公开接口

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| ALL | `/api/echo` | 任意 | 回显请求，返回 method/path/query/headers/body |
| GET | `/api/icon` | `u`（域名或 URL） | 返回网站图标（二进制） |
| GET | `/api/site-info` | `u` | 返回 `{title, des}` |
| GET | `/api/music` | - | 随机音乐（二进制） |
| ALL | `/api/s/:chat_id` | GET `text=`；POST `{text}` | 给指定用户推送消息 |

公开接口默认关闭（`pubApi` 各项为 `false`），登录用户不受开关限制。CLI 会带 Cookie，所以登录后可直接调用。

---

## 11. 管理员 `/api/root`（仅 `root` 账号）

| 方法 | 路径 | 参数 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/root/user-list` | `pageNo`, `pageSize`(≤100), `word?` | 用户列表 + 全局开关状态 |
| GET | `/api/root/sys-status` | - | CPU/内存/磁盘等系统状态 |
| GET | `/api/root/log-list` | - | 日志文件列表 |
| GET | `/api/root/log` | `name` 等 | 读取日志内容 |
| POST | `/api/root/register-state` | `state`: 0/1 | 开关注册 |
| POST | `/api/root/pub-api-state` | 见源码 | 开关公开接口 |
| POST | `/api/root/create-account` | 见源码 | 创建账号 |
| POST | `/api/root/delete-account` | 见源码 | 删除账号 |

管理员接口权限大、参数多，**非必要不要让智能体调用写接口**。

---

## 12. 数据模型速查（SQLite）

数据库文件路径由 `server/utils/sqlite.js` 的 `appConfig.databaseDir('hello.db')` 决定，通常是
`<用户根目录>/.h_config/appFiles/data/db/hello.db`（管理员账号的根目录是 `server/app_data`；Docker 下是挂载进去的 `/app/app_data`）。表结构定义见 `server/data/initDatabase.js`。

| 表 | 关键字段 | 用途 |
| --- | --- | --- |
| `user` | `account`, `username`, `password`, `email`, `bg`, `bgxs`, `hide`, `verify` | 用户 |
| `bmk` | `id`, `account`, `group_id`, `title`, `link`, `des`, `logo`, `num`, `state` | 书签（`state=0` 为回收站） |
| `bmk_group` | `id`, `account`, `title`, `share`, `num`, `state` | 书签分组 |
| `note` | `id`, `account`, `title`, `content`, `category`（`-` 连接）, `share`, `top`, `state`, `visit_count` | 笔记 |
| `note_category` | `id`, `account`, `title` | 笔记分类 |
| `todo` | `id`, `account`, `content`, `state`, `update_at` | 待办 |
| `count_down` | `id`, `account`, `title`, `start`, `end`, `link`, `top`, `state` | 倒计时 |
| `bg` / `pic` | `id`, `type`, `url`, `title` | 壁纸 / 图床 |
| `songs` | `id`, `title`, `artist`, `album`, `duration`, `url`, `pic`, `lrc`, `mv` | 歌曲 |
| `share` | `id`, `account`, `type`, `title`, `pass`, `exp_time`, `data` | 分享记录 |
| `chat` | `id`, `_from`, `_to`, `flag`, `type`, `content` | 聊天消息 |
| `ssh` | `id`, `account`, `host`, `port`, `username`, `password`, `private_key`, `auth_type` | SSH 配置 |

时间字段都是毫秒时间戳（`create_at`、`update_at`、`exp_time`）。
