# hello API 接口文档

自托管主页 hello 的后端 HTTP API 参考。文档由 `server/src` 源码整理，覆盖认证、用户、管理员、文件、音乐、壁纸、图床、书签、笔记、待办、倒计时、搜索、聊天、SSH 等模块。

- 默认服务地址：`http://<主机>:55555`
- 所有接口以 `/api` 开头，无版本号
- 文档中的所有路径均为完整路径，可直接拼接在服务地址后

## 目录

- [基础信息](#基础信息)
- [鉴权方式](#鉴权方式)
- [快速上手](#快速上手)
- [统一响应格式](#统一响应格式)
- [通用请求头](#通用请求头)
- [分页结构](#分页结构)
- [限流与公开接口](#限流与公开接口)
- [用户与认证 `/api/user`](#用户与认证)
- [管理员 `/api/root`](#管理员-apiroot)
- [文件管理](#文件管理) — `/api/file`、`/api/f`、`/api/task`
- [音乐、壁纸与图床](#音乐壁纸与图床)
- [书签 `/api/bmk`](#书签-apibmk)
- [笔记 `/api/note`](#笔记-apinote)
- [待办 `/api/todo`](#待办-apitodo)
- [倒计时 `/api/count`](#倒计时-apicount)
- [搜索 `/api/search`](#搜索-apisearch)
- [聊天 `/api/chat`](#聊天-apichat)
- [SSH `/api/ssh`](#ssh-apissh)
- [全局与公开接口](#全局与公开接口)
- [附录：接口速查表](#附录接口速查表)

## 基础信息

| 项 | 说明 |
| --- | --- |
| 传输协议 | HTTP / HTTPS（建议通过 Nginx 反向代理并开启 HTTPS） |
| 默认端口 | `55555` |
| 数据格式 | JSON（`Content-Type: application/json`），上传接口使用 `multipart/form-data` |
| 字符编码 | UTF-8 |
| 跨域 | 已开启：`Access-Control-Allow-Origin: *`，允许 `GET,POST,PUT,DELETE,OPTIONS` |
| 压缩 | 文本资源支持 gzip / brotli；请求头带 `x-no-compression` 可关闭 |
| 请求体上限 | JSON / 表单 10 MB；大文件请使用分片上传接口 |

## 鉴权方式

服务使用 **Cookie + 加密 JWT** 维持登录态，没有传统的 `Authorization: Bearer` 头。

| 方式 | 说明 |
| --- | --- |
| 登录 Cookie | 调用 `/api/user/login`、`/api/user/register`、`/api/user/code-login` 等成功后，服务端写入 `token` Cookie（`HttpOnly`、`SameSite=Lax`，有效期 2 天）。后续请求浏览器会自动携带 |
| 认证 Token | 已登录后调用 `POST /api/user/create-token` 生成长期 Token，可用于脚本/第三方调用。该 Token 与 Cookie 内容一致，主要作为文件访问参数 `?token=` 使用 |
| 文件临时 Token | `GET /api/user/file-token?p=<路径>` 生成仅能访问指定文件的 Token，供未登录场景（如分享页）使用 |
| 分享 Token | 各模块的 `get-share` / `share` 接口会返回分享 Token，分享页凭 Token 访问，受提取码和过期时间限制 |
| 设备标识 | 请求头 `X-Tem-ID`：客户端生成的临时设备 ID（字母数字）。用于多端消息推送、长轮询区分设备、SSH 会话绑定。需要推送/SSH 的接口必须携带 |

> 修改密码、退出其他设备、管理员修改 `tokenKey` 后，已签发的 Token 会全部失效。

## 快速上手

以下示例默认服务地址为 `http://localhost:55555`。

**1. 登录并保存 Cookie**

```bash
curl -c cookie.txt -X POST 'http://localhost:55555/api/user/login' \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"你的密码"}'
```

**2. 携带 Cookie 调用需要登录的接口**

```bash
curl -b cookie.txt 'http://localhost:55555/api/user/userinfo'
```

**3. 生成长期 Token，供脚本或第三方使用**

```bash
curl -b cookie.txt -X POST 'http://localhost:55555/api/user/create-token' \
  -H 'Content-Type: application/json' \
  -d '{"days":30}'
```

返回的 `data` 即 Token。访问文件时通过 `?token=` 传入：

```bash
curl 'http://localhost:55555/api/f/file/文档/示例.txt?token=<Token>'
```

**4. 多端推送 / SSH**

客户端启动时生成一个设备 ID，之后请求带上：

```bash
curl -b cookie.txt -H 'X-Tem-ID: device001' \
  'http://localhost:55555/api/user/real-time?page=home'
```

该接口是长轮询：有消息立即返回，20 秒无消息返回 `code=3`。

**5. 文件上传**

大文件使用「断点检查 → 分片上传 → 合并」三步协议，具体字段见 [文件接口 `/api/file`](#文件接口-apifile) 的 `breakpoint`、`up`、`merge`。

## 统一响应格式

所有 JSON 接口返回同一层信封：

```json
{
  "code": 1,
  "codeText": "操作成功",
  "data": null
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| code | number | `1` 成功；`0` 业务失败；`2` 未登录；`3` 处理中/无新数据（长轮询常用） |
| codeText | string | 提示文案，可直接展示给用户 |
| data | any | 业务数据；无返回值时为 `null` |

HTTP 状态码与 `code` 的常见组合：

| HTTP | code | 含义 |
| --- | --- | --- |
| 200 | 1 | 成功 |
| 200 | 3 | 请求已受理但暂无新数据（如长轮询超时） |
| 400 | 0 | 参数校验失败，`codeText` 为具体字段错误 |
| 401 | 2 | 未登录或登录态失效 |
| 403 | 0 | 无权限、频率超限、功能未开启等 |
| 404 | 0 | 资源不存在 |
| 500 | 0 | 服务端异常 |

> 本文档后续只描述各接口的 `data` 结构，不再重复外层信封。

## 通用请求头

| 请求头 | 必填 | 说明 |
| --- | --- | --- |
| `Cookie: token=<JWT>` | 需登录接口必填 | 登录态 |
| `X-Tem-ID` | 推送 / SSH / 多端同步相关接口必填 | 客户端设备 ID，字母、数字、下划线，≤50 字符 |
| `Content-Type` | POST JSON 必填 | `application/json`；上传用 `multipart/form-data` |
| `X-Debug` | 否 | 仅 `/api/echo`：值为 `true` 时附带原始请求体 |
| `X-No-Compression` | 否 | 值为任意非空时跳过响应压缩 |

> `X-Source-Service` 为服务内部标记，普通客户端携带会被直接拒绝（403）。

## 分页结构

列表类接口统一返回：

```json
{
  "total": 120,
  "totalPage": 6,
  "pageNo": 1,
  "data": []
}
```

| 字段 | 说明 |
| --- | --- |
| total | 总条数 |
| totalPage | 总页数（至少为 1） |
| pageNo | 实际页码（越界会自动收敛到有效范围） |
| data | 当前页数据 |

通用分页参数：`pageNo`（从 1 开始，默认 1）、`pageSize`（默认 20，最大 200）。

## 限流与公开接口

- 同一 IP 10 秒内最多 500 个请求，超出返回 `403 请求频率超过限制`，并会通知管理员。
- 登录、验证码、注册、邮件等敏感接口另有更严格的独立限流。
- 以下公开接口默认关闭，需要管理员在 `POST /api/root/pub-api-state` 中开启；管理员登录后不受开关限制：

| 开关 | 接口 |
| --- | --- |
| `randomBgApi` | `GET /api/bg/r/:type` 随机壁纸 |
| `randomMusicApi` | `GET /api/music` 随机音乐 |
| `siteInfoApi` | `GET /api/site-info` 网站信息 |
| `faviconApi` | `GET /api/icon` 网站图标 |
| `echoApi` | `ALL /api/echo` 回显 |

---

---

# 用户与认证

`/api/user` 负责账号的注册、登录、两步验证、邮箱绑定、密码与用户名修改、头像上传、在线状态、多端消息长轮询、分享管理、回收站和剪切板。

本模块的路由挂载于 `server/src/app.js`：

```js
app.use('/api/user', userRoute);
```

因此下文所有路径都带 `/api/user` 前缀。

## 模块约定

- `server/src/routes/user/index.js` 中 `route.use(验证登录态)` 之前的接口公开，之后的接口需要登录（未登录返回 HTTP 401、`code=2`）。
- 登录态来自 Cookie `token`（服务端加密 JWT，`HttpOnly`、`SameSite=Lax`，有效期 2 天）。修改密码、退出其他设备会把 `exp_token_time` 提前，使旧 Token 全部失效。
- 多端推送、长轮询、SSH 相关接口需要请求头 `X-Tem-ID`：客户端生成的设备 ID，仅字母、数字、下划线，≤50 字符（缺省为空字符串，但 `GET /api/user/real-time` 要求非空）。
- 下文只描述各接口返回的 `data`，外层统一为 `{ code, codeText, data }`。
- `server/src/routes/user/user.js` 只有工具函数、没有路由，不属于 HTTP 接口，被其它模块复用：
  - `getFontList()`：字体目录不存在时从内置资源复制，返回文件名数组（供 `GET /api/user/font-list` 使用）。
  - `getUserInfo(account, fields)`：`fields='*'` 走用户信息缓存，否则直接查库。
  - `deleteUser(account)`：在一个事务里删除该账号的书签、书签分组、倒计时、历史、笔记、笔记分类、分享、SSH、SSH 分类、待办、播放记录/列表/歌单/收藏壁纸、聊天记录与好友关系，提交后清缓存并删除用户根目录。
  - `validShareState(shareToken, t)`：校验分享访问 Token（类型、分享是否取消、`update_at` 是否变化、是否过期），供书签、文件、音乐等分享页复用。
  - `validShareAddUserState(res, types, id, pass, captchaId)`：校验分享提取码与验证码，返回 `state=1/2/3` 供调用方判断。

### 本模块限流

| 位置 | 规则 |
| --- | --- |
| 全局 | 同一 IP 10 秒 500 次，超出 403 |
| `GET /api/user/captcha` | 同一 IP 60 秒 20 次；同一 IP + `flag` 10 分钟 10 次 |
| `POST /api/user/captcha` | 同一 IP + `flag` 10 分钟 10 次，失败计入，成功清零 |
| `POST /api/user/login` | 同一用户名 30 分钟内失败 3 次后要求验证码 |
| `POST /api/user/verify-login` | 同一账号 30 分钟内失败 3 次后要求验证码 |
| `POST /api/user/reset-pass` | 同一邮箱 30 分钟内失败 3 次后要求验证码 |
| `POST /api/user/bind-mail-code` | 同一账号 10 分钟 5 次（非滑动窗口） |
| `POST /api/user/bind-email` | 同一账号 10 分钟 5 次验证码错误 |

### 验证码（滑块）流程

1. `GET /api/user/captcha?flag=<业务标识>` 取图，返回 `id`、背景图、拼图块与纵向参数。
2. 用户拖动后调用 `POST /api/user/captcha` 提交 `id` 与轨迹 `track`。
3. 验证通过后，把该 `id` 作为业务接口的 `captchaId` 提交。服务端以 `captcha.consume(id, flag)` 校验“已验证 + flag 一致”，且每个 `id` 只能消费一次。
4. 业务侧 `flag` 约定：登录/注册/批准登录请求用 `username`，重置密码用 `account`。

---

## POST /api/user/error

前端错误上报。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| err | string | 是 | 错误文本，最少 1 字符，服务端只记录前 1000 字符 |

**响应 data**

```json
null
```

**说明**

- 以等级 100 写入服务日志，不做其它处理。
- 不要求登录，便于登录页出错时上报。

---

## GET /api/user/custom-code

获取用户自定义的 HTML 代码。

**鉴权**：公开

**Query**

无参数。

**响应 data**

```json
{ "head": "<style>...</style>", "body": "<div>...</div>" }
```

**说明**

- 读取自定义目录下的 `custom_head.html` 与 `custom_body.html`；文件不存在时对应字段为空字符串。
- 内容由管理员在后台写入，前端会直接插入页面。

---

## POST /api/user/register

注册账号（需先完成滑块验证）。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名，1–40 字符，字母/数字/下划线（会 trim） |
| password | string | 是 | 密码，1–50 字符，字母/数字/下划线（会 trim，服务端哈希存储） |
| captchaId | string | 否 | 滑块验证通过后拿到的 id，默认空串，≤50 字符 |

**响应 data**

```json
{ "account": "HXXXXXXXXXXXX", "username": "demo" }
```

**说明**

- 注册总开关 `registerState` 关闭，或本小时注册数已超过 20 时返回 403 `已关闭注册功能`（计数每小时整点清零）。
- 验证码未通过时返回 `code=1`、`codeText=需要验证验证码，请完成验证`、`data={ needCaptcha: true, username }`，前端应弹出滑块。
- 用户名已存在返回 403 `用户名无法使用`。
- 成功后：写入 `user` 表、自动与聊天室账号和通知助手建立好友关系（同一事务）、种下登录 Cookie、通知管理员。
- 账号 `account` 为服务端生成的大写字母/数字 ID（以 `H` 开头，约 21 位），后续接口用它标识用户。

---

## POST /api/user/allow-login-req

发起“免密登录”请求，通知目标账号的在线设备弹出批准框。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 登录码，固定 6 位字母/数字，由请求方生成并展示 |
| username | string | 是 | 目标用户名，1–40 字符，字母/数字/下划线 |
| captchaId | string | 否 | 滑块验证 id，默认空串 |

**响应 data**

```json
null
```

**说明**

- 未登录也能触发通知，因此强制要求滑块验证码（`flag=username`）；未通过时返回 `code=1` 与 `data={ needCaptcha: true, username }`。
- 目标账号必须存在、`state=1`、不是通知助手账号，且已开启免密登录（`remote_login != 0`），否则 403。
- 通过 `_connect.send` 向该账号所有在线设备推送：

```json
{ "type": "allowLogin", "data": { "ip": "1.2.3.4", "os": "Windows / Chrome", "code": "123456" } }
```

- 请求方还需轮询 `POST /api/user/code-login` 等待批准结果。

---

## POST /api/user/code-login

免密登录轮询接口。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 6 位登录码，字母/数字 |
| username | string | 是 | 用户名，1–40 字符 |

**响应 data**

```json
{ "account": "HXXXXXXXXXXXX", "username": "demo" }
```

**说明**

- 目标账号不存在、或未开启免密登录时返回 403。
- 服务端以 `account + '_' + code` 查询批准记录：没有记录时返回 `code=3`（HTTP 200），前端应继续轮询。
- 批准端调用 `POST /api/user/allow-code-login` 写入记录后，本接口取出账号、删除记录、种下 Cookie，并给本人发一条登录成功通知。
- 登录码在批准端等待 10 秒未被取走会失效，需要重新发起。

---

## GET /api/user/captcha

获取滑块验证码图片（拼图背景 + 拼图块）。

**鉴权**：公开

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| flag | string | 是 | 业务标识，1–50 字符；登录/注册用用户名，重置密码用 account |
| theme | string | 否 | 主题，枚举 `light`、`dark`，默认 `light` |

**响应 data**

```json
{
  "y": 78,
  "s": 52,
  "w": 400,
  "h": 220,
  "theme": "light",
  "bg": "data:image/png;base64,...",
  "piece": "data:image/png;base64,...",
  "id": "HXXXXXXXXXXXX"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| y | number | 拼图块的目标纵坐标（像素），前端按此定位 |
| s | number | 拼图块边长（像素），40–60 |
| w | number | 背景图宽，固定 400 |
| h | number | 背景图高，固定 220 |
| theme | string | 实际使用的主题 |
| bg | string | 背景图，PNG 的 base64 Data URL |
| piece | string | 拼图块，PNG 的 base64 Data URL |
| id | string | 本次验证码 ID，提交验证时使用 |

**说明**

- 响应禁止缓存（`Cache-Control: no-store`）。
- 真实横坐标 `x` 不下发给客户端，只保留在服务端用于比对轨迹终点。
- 验证码 60 秒过期；同一 `id` 验证通过后再次提交会被判失败。
- 取图同时受“单 IP 20 次/分钟”和“单 IP + flag 10 次/10 分钟”限制，超限 403 `请稍后再试`。

---

## POST /api/user/captcha

提交滑块轨迹，验证拼图位置。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | `GET /api/user/captcha` 返回的 id，1–50 字符 |
| track | array | 是 | 拖动轨迹点数组，元素为 `{ x, y, t }`，三个值都是 ≥0 的数字（`t` 为毫秒时间戳） |

**响应 data**

```json
null
```

**说明**

- 成功时 `codeText=验证成功`，之后业务接口可用该 `id` 作为 `captchaId` 消费。
- 失败（位置偏差、轨迹过短/过长、耗时异常、匀速脚本特征、重复提交）返回 403 `验证失败，请重试`，并计入失败次数。
- 轨迹至少 5 个点、最多 300 个点；拖动时长 200 ms–15 s；服务端实际耗时也需在 200 ms–30 s 内；终点横向误差 ≤5 px；时间必须单调不减；需要存在 Y 轴抖动与速度变化。
- 验证失败或已过期时 `id` 作废，需要重新取图。

---

## POST /api/user/login

账号密码登录。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名，1–40 字符，字母/数字/下划线 |
| password | string | 是 | 密码，1–50 字符；若账号密码为空（如被重置），任意非空密码均可通过 |
| captchaId | string | 否 | 滑块验证 id，默认空串 |

**响应 data**

```json
{ "account": "HXXXXXXXXXXXX", "username": "demo" }
```

开启两步验证时：

```json
{ "account": "HXXXXXXXXXXXX", "verify": true }
```

**说明**

- 同一用户名 30 分钟内密码错误 3 次后要求验证码；此时未带有效 `captchaId` 会返回 `code=1`、`data={ needCaptcha: true, username }`。
- 用户名不存在、密码错误、账号被禁用、或是通知助手账号，统一返回 403 `用户名或密码错误，请重新输入`，并累计失败次数。
- 密码正确且未开启两步验证：种下 Cookie、发送登录成功通知，返回账号信息。
- 密码正确但已开启两步验证：不种 Cookie，返回 `verify: true`，需继续调用 `POST /api/user/verify-login`。

```http
POST /api/user/login
Content-Type: application/json

{"username":"demo","password":"123456"}
```

---

## POST /api/user/verify-login

两步验证（TOTP）完成登录。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | string | 是 | 6 位动态验证码，字母/数字 |
| account | string | 是 | 账号 ID，1–50 字符 |
| password | string | 是 | 密码，1–50 字符（密码为空时跳过校验） |
| captchaId | string | 否 | 滑块验证 id，默认空串 |

**响应 data**

```json
{ "account": "HXXXXXXXXXXXX", "username": "demo" }
```

**说明**

- 同一账号 30 分钟内失败 3 次后要求验证码，未带有效 `captchaId` 时返回 `code=1`、`data={ needCaptcha: true, account }`。
- 账号不存在返回 403 `用户无法两步验证`。
- 密码错误、未开启两步验证、动态码错误都返回 403 `验证码错误，请重新输入`。
- 成功后种 Cookie 并发送登录成功通知。

---

## GET /api/user/mail-code

发送“重置密码”邮箱验证码。

**鉴权**：公开

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名，1–40 字符 |
| captchaId | string | 否 | 滑块验证 id，默认空串 |

**响应 data**

```json
{ "account": "HXXXXXXXXXXXX" }
```

**说明**

- 必须先通过滑块验证（`flag=username`），否则返回 `code=1`、`data={ needCaptcha: true, username }`。
- 邮箱功能未开启（`email.state=false`）返回 403 `邮箱验证功能已关闭`。
- 用户不存在、账号被禁用或未绑定邮箱分别返回 403 `用户无法验证邮箱` / `用户未绑定邮箱`。
- 验证码为 6 位数字，10 分钟内有效；同一邮箱已有未过期验证码时直接返回 `验证码已发送`，不重复发信。
- 客户端不接触邮箱明文，重置时用 `account` 提交。

---

## POST /api/user/reset-pass

通过邮箱验证码重置密码（重置为空密码并自动登录）。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 账号 ID，1–50 字符 |
| code | string | 是 | 邮箱验证码，6 位字母/数字 |
| captchaId | string | 否 | 滑块验证 id，默认空串 |

**响应 data**

```json
{ "account": "HXXXXXXXXXXXX", "username": "demo" }
```

**说明**

- 服务端按 `account` 查邮箱；账号不存在、被禁用、未绑定邮箱都返回 403 `用户无法重置密码`。
- 同一邮箱 30 分钟内验证码错误 3 次后要求滑块验证；未通过时返回 `code=1`、`data={ needCaptcha: true, account }`。
- 验证码错误返回 403 `验证码错误，请重新输入`。
- 成功后：密码与两步验证密钥清空、`exp_token_time` 提前（踢掉所有旧登录）、清用户缓存、种下新 Cookie、删除已用验证码。
- 返回文案为 `已重置密码为空，请尽快修改密码`。

---

## GET /api/user/file-token

为当前用户生成“指定文件”的临时访问 Token。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| p | string | 是 | 文件路径，1–2000 字符，通常形如 `upload/xxx`、`file/xxx`、`bg/xxx` |

**响应 data**

```json
"eyJhbGciOiJBMjU2R0NNS1ciLCJlbmMiOiJBMjU2R0NNIn0..."
```

**说明**

- 生成 `type=temAccessFile` 的 JWT，载荷包含 `{ account, p }`，有效期 10 小时。
- 用途：把 Token 拼到 `/api/f/<路径>?token=<token>` 上，即可在未登录的分享页中以该账号身份访问这一个文件。
- 只对 Token 中记录的路径生效；即使换了 `p` 参数，服务端也以 Token 内的路径为准。

---

## GET /api/user/font-list

获取可用字体列表。

**鉴权**：需要登录

**Query**

无参数。

**响应 data**

```json
["AlibabaPuHuiTi-3-55-Regular.ttf", "HarmonyOS_Sans_SC_Regular.ttf"]
```

**说明**

- 字体目录不存在时会先从 `server/src/resources/fonts` 复制一份，再返回目录下的文件名。
- 目录不存在或读取失败时返回空数组。

---

## POST /api/user/bind-mail-code

向待绑定邮箱发送验证码。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 是 | 邮箱地址，1–255 字符，需符合邮箱格式 |

**响应 data**

```json
null
```

**说明**

- 邮箱功能未开启返回 403 `邮箱验证功能已关闭`。
- 该邮箱 10 分钟内已有验证码时直接返回 `验证码已发送`，不重复发信。
- 同一账号 10 分钟最多 5 次（先占配额再发信，发送失败会归还配额）。
- 邮箱已被其他用户绑定时返回 403 `邮箱已绑定用户`。
- 发送成功文案 `验证码发送成功`。

---

## POST /api/user/bind-email

绑定或解绑邮箱。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 否 | 邮箱，1–255 字符；`code` 为空时可省略（默认空串） |
| code | string | 否 | 邮箱验证码，6 位；为空表示解绑 |
| password | string | 是 | 当前密码，1–50 字符（账号密码为空时跳过校验） |

**响应 data**

```json
null
```

**说明**

- 密码错误返回 403 `密码错误，请重新输入`。
- `code` 为空 → 解绑邮箱，返回 `解绑邮箱成功`。
- `code` 非空但 `email` 为空 → 400 `email 不能为空`。
- 同一账号 10 分钟内验证码错误 5 次后返回 403 `验证码错误次数过多，请稍后再试`；成功后清零计数。
- 邮箱已被其他用户占用返回 403 `邮箱已绑定用户`。
- 绑定/解绑都会清用户缓存，并向其它在线设备推送 `updatedata`（`flag=userinfo`）。

---

## GET /api/user/verify

获取待绑定的两步验证密钥（用于生成二维码）。

**鉴权**：需要登录

**Query**

无参数。

**响应 data**

```json
"JBSWY3DPEHPK3PXP"
```

**说明**

- 返回 base32 编码的 TOTP 密钥，客户端可据此生成 `otpauth://` 二维码。
- 密钥缓存 10 分钟，每次读取都会续期；同一账号多次调用返回同一密钥。
- 该密钥尚未写入用户表，需再用 `POST /api/user/verify` 提交动态码确认。

---

## POST /api/user/verify

开启或关闭两步验证。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | string | 否 | 6 位动态验证码，默认空串；为空表示关闭 |
| password | string | 是 | 当前密码，1–50 字符（密码为空时跳过校验） |

**响应 data**

```json
null
```

**说明**

- 密码错误返回 403 `密码错误，请重新输入`。
- `token` 为空 → 清空用户表 `verify` 字段，返回 `关闭两步验证成功`。
- `token` 非空 → 与当前缓存密钥比对，成功则写入用户表、删除密钥缓存，返回 `开启两步验证成功`；失败返回 403 `验证码错误，请重新输入`。
- 两种操作都会清用户缓存并向其它设备推送 `updatedata`（`flag=userinfo`）。

---

## GET /api/user/tips

获取 tips 标记。

**鉴权**：需要登录

**Query**

无参数。

**响应 data**

```json
1
```

**说明**

- 返回服务端配置项 `tipsFlag`（默认 1），前端用来判断是否展示提示。

---

## POST /api/user/allow-code-login

批准一次免密登录请求（在已登录设备上操作）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 6 位登录码，字母/数字 |

**响应 data**

```json
null
```

**说明**

- 服务端把 `account + '_' + code` 写入内存，然后每秒检查一次，直到被登录端取走（最多 10 秒）。
- 被取走 → `code=1`，文案 `批准登录成功`；10 秒未被取走 → 403 `批准登录超时`，记录删除。
- 同一 `account + code` 已存在未消费记录 → 403 `登录码冲突，请刷新登录码再试`。
- 接口会挂起最长约 10 秒，前端请求超时应大于该值。

---

## POST /api/user/change-pd

修改密码。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| oldpassword | string | 是 | 原密码，1–50 字符，字母/数字/下划线 |
| newpassword | string | 是 | 新密码，1–50 字符，字母/数字/下划线 |

**响应 data**

```json
null
```

**说明**

- 账号当前密码为空时跳过原密码校验；否则必须匹配，错误返回 403 `原密码错误，请重新输入`。
- 成功后更新密码哈希，并把 `exp_token_time` 设为当前秒，使已签发的 Token 全部失效（包括本次登录），需重新登录。
- 返回文案 `修改密码成功，请重新登录`；不会主动清除当前 Cookie。

---

## POST /api/user/create-token

生成长期认证 Token。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| days | number | 是 | 有效天数，整数，1–3650 |

**响应 data**

```json
"eyJhbGciOiJBMjU2R0NNS1ciLCJlbmMiOiJBMjU2R0NNIn0..."
```

**说明**

- 生成 `type=authentication` 的 JWT，载荷为 `{ account, username }`，有效期 `days` 天。
- 与 Cookie 中的 Token 同构，主要作为文件访问参数 `?token=` 使用（脚本、第三方客户端）。
- 修改密码 / 退出其他设备后，此类 Token 同样失效。

---

## POST /api/user/logout

退出登录。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| other | number | 是 | `0` 退出当前设备；`1` 退出其他设备（当前设备保留登录） |

**响应 data**

```json
null
```

**说明**

- `other=0`：清除 `token` Cookie。
- `other=1`：把 `exp_token_time` 设为当前秒减 2（所有旧 Token 失效），清用户缓存，然后为当前设备重新种 Cookie。
- 两种情况都返回 `退出登录成功`。

---

## POST /api/user/changename

修改用户名。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 新用户名，1–40 字符，字母/数字/下划线 |

**响应 data**

```json
null
```

**说明**

- 用户名已被占用（含自己当前用户名）返回 403 `用户名无法使用`。
- 成功后更新用户表、清缓存、重新种 Cookie（Token 中的用户名同步更新），并向其它设备推送 `updatedata`（`flag=userinfo`）。

---

## POST /api/user/delete-account

注销账号（不可恢复）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| password | string | 是 | 当前密码，1–50 字符（密码为空时跳过校验） |

**响应 data**

```json
null
```

**说明**

- 密码错误返回 403 `密码错误，请重新输入`。
- 管理员账号（`isRoot`）和通知助手账号无权注销，返回 403 `无权操作`。
- 成功后调用 `deleteUser`：事务内删除用户及其书签、笔记、待办、倒计时、分享、SSH、聊天、好友等全部数据；提交后清缓存并删除用户文件目录。
- 清除 Cookie，并通知管理员注销成功。

---

## GET /api/user/userinfo

获取当前登录用户信息。

**鉴权**：需要登录

**Query**

无参数。

**响应 data**

```json
{
  "logo": "2026/11/14/xxx/abc.png",
  "username": "demo",
  "forward_msg_link": {
    "link": "",
    "type": "get",
    "header": {},
    "body": "{}",
    "contentType": "application/json"
  },
  "forward_msg_state": 0,
  "verify": true,
  "account": "HXXXXXXXXXXXX",
  "daily_change_bg": 0,
  "remote_login": 1,
  "bg": "",
  "bgxs": "",
  "hide": 0,
  "email": "demo@example.com"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| logo | string | 头像相对路径，空串表示未设置 |
| username | string | 用户名 |
| forward_msg_link | object | 消息转发配置，已解析为对象；默认 `{link:'',type:'get',header:{},body:'{}',contentType:'application/json'}` |
| forward_msg_state | number | 消息转发开关，0 关 / 1 开 |
| verify | boolean \| string | 已开启两步验证返回 `true`，未开启返回空串 |
| account | string | 账号 ID |
| daily_change_bg | number | 每日更换壁纸，0 关 / 1 开 |
| remote_login | number | 免密登录，0 关 / 1 开（默认 1） |
| bg | string | 当前壁纸标识 |
| bgxs | string | 壁纸显示样式 |
| hide | number | 隐身状态，0 正常 / 1 隐身 |
| email | string | 已绑定邮箱，空串表示未绑定 |

**说明**

- 数据来自登录校验时加载的用户记录（全字段查询走缓存），不会返回密码哈希。

---

## POST /api/user/delete-logo

删除头像。

**鉴权**：需要登录

**Body**

无。

**响应 data**

```json
null
```

**说明**

- 把用户表 `logo` 置空，清用户缓存，向其它设备推送 `updatedata`（`flag=userinfo`）。
- 不删除磁盘上的历史头像文件。

---

## POST /api/user/up-logo

上传图片，用作头像、书签图标、搜索引擎图标或翻译接口图标。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 原始文件名，1–255 字符，扩展名必须是 `jpg/jpeg/png/gif/webp/avif/svg` |
| HASH | string | 是 | 文件内容哈希，1–50 字符，字母/数字/下划线；服务端用它命名并校验文件 |
| type | string | 是 | 用途，枚举 `userlogo`、`bookmark`、`engine`、`translator` |
| id | string | 否 | 目标 ID，默认空串，≤50 字符；`bookmark`/`engine`/`translator` 必填 |

**Body（multipart/form-data）**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| 任意文件字段 | file | 是 | 单个图片文件，≤5 MB（取表单中的第一个文件字段；官方 Web 端字段名为 `attrname`） |

**响应 data**

```json
null
```

**说明**

- 文件保存到 `logo/<account>/<年>/<月>/<日>/<时>/<分>/<HASH>.<扩展名>`；服务端会校验哈希是否与内容一致，不一致直接失败。
- 上传后还会用 sharp 试读图片，无法解析返回 403 `图片格式错误`。
- `type=bookmark`：更新 `bmk` 表中属于当前账号的该书签图标，推送 `updatedata`（`flag=bookmark`），返回 `更新书签LOGO成功`。
- `type=userlogo`：更新用户头字段、清缓存、推送 `userinfo`，返回 `更新头像成功`。
- `type=engine` / `translator`：读取并修改该账号的搜索配置 `searchEngineData` / `translatorData`，推送 `searchConfig`，分别返回 `更新搜索引擎LOGO成功` / `更新翻译接口LOGO成功`；找不到对应 id 时仍返回成功，但不改配置。
- 上传请求超时为 10 分钟；`multipart` 只接受一个文件。

---

## POST /api/user/daily-change-bg

切换“每日更换壁纸”开关。

**鉴权**：需要登录

**Body**

无。

**响应 data**

```json
null
```

**说明**

- 取反 `daily_change_bg`（0 ↔ 1），清缓存，推送 `updatedata`（`flag=userinfo`）。
- 返回文案 `成功开启` 或 `成功关闭`。

---

## POST /api/user/hide-state

切换隐身状态。

**鉴权**：需要登录

**Body**

无。

**响应 data**

```json
null
```

**说明**

- 取反 `hide`（0 ↔ 1），清缓存，推送 `updatedata`（`flag=userinfo`）。
- 从隐身穿回正常时，会调用 `onlineMsg` 通知在线好友“已上线”；开启隐身时不通知。

---

## POST /api/user/remote-login-state

切换免密登录开关。

**鉴权**：需要登录

**Body**

无。

**响应 data**

```json
null
```

**说明**

- 取反 `remote_login`（0 ↔ 1），清缓存，推送 `updatedata`（`flag=userinfo`）。
- 关闭后 `POST /api/user/allow-login-req` 与 `POST /api/user/code-login` 都会返回 403。

---

## GET /api/user/real-time

长轮询接收推送指令（多端同步、聊天通知、远程播放、SSH 输出等）。

**鉴权**：需要登录

**请求头**

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| X-Tem-ID | 是 | 当前设备 ID，非空，字母/数字/下划线，≤50 字符；缺失时返回 400 |

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| flag | string | 否 | 上一次响应返回的指令标识，默认空串，≤50 字符；为空时取当前连接标识（首轮） |
| page | string | 否 | 页面标识，默认空串，≤30 字符；`home` 会刷新用户 `update_at`、标记在线；`ssh` 会续期该设备的 SSH 会话 |

**响应 data**

有新消息（`code=1`）：

```json
{
  "flag": "HYYYYYYYYYYYY",
  "msgs": [
    { "type": "updatedata", "data": { "flag": "note", "id": "" }, "fromID": "HXXXXXXXXXXXX" }
  ]
}
```

等待 20 秒仍无新消息（`code=3`）：

```json
{ "flag": "HYYYYYYYYYYYY" }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| flag | string | 最新指令标识，下次请求原样带回 |
| msgs | array | 上次 `flag` 之后、且发往本设备的推送数据；每个元素含 `type`、`data`、`fromID` |
| fromID | string | 发送方设备 ID（`_connect.send` 自动附加） |

**说明**

- 每个账号的连接状态存在内存缓存中（60 秒无人访问即回收，每次请求续期），消息本身只保留 30 秒。
- 服务端最多挂起 20 秒：有匹配消息立即返回 `code=1`；超时返回 `code=3`，客户端应立即重新发起长轮询。
- 消息按接收目标过滤：`all` 全部设备、`temid` 指定设备、`self` 仅发送设备、`other` 除发送设备外的其他设备。
- `page=home` 时还会通知好友“已上线”（受隐身和朋友勿扰设置影响）。
- `page=ssh` 用于保活 SSH 终端会话，避免长时间无输出被回收。

---

## POST /api/user/real-time

发送推送指令到本账号的其他设备（或指定设备）。

**鉴权**：需要登录

**请求头**

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| X-Tem-ID | 是 | 发送方设备 ID，非空，≤50 字符；缺失时返回 400 |

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 是 | 指令类型，枚举 `updatedata`、`chat`、`playmode`、`playspeed`、`play`、`vol`、`progress`、`pastefiledata`、`ssh` |
| data | object | 是 | 指令负载，结构随 `type` 变化，见下表 |

**data 结构**

| type | 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| ssh | type | string | 是 | `cmd` 执行命令 / `size` 调整终端尺寸 |
| ssh | text | string | 否 | 命令文本，默认空串，≤5000 字符；`cmd` 时使用 |
| ssh | cols | number | 否 | 列数，默认 0，≥0；`size` 时使用 |
| ssh | rows | number | 否 | 行数，默认 0，≥0；`size` 时使用 |
| updatedata | flag | string | 是 | 需要同步的数据类型，枚举 `bookmark`、`userinfo`、`playinglist`、`musicinfo`、`todolist`、`countlist`、`music`、`bg`、`sharelist`、`note`、`trash`、`history`、`category`、`sshCategory`、`file`、`searchConfig`、`quickCommand`、`historyCommands` |
| updatedata | id | string | 否 | 相关记录 ID，默认空串，≤50 字符 |
| play | state | number | 是 | 播放状态，`0` 暂停 / `1` 播放 |
| play | targetID | string | 否 | 目标设备 ID，默认空串（空表示“其他设备”），≤50 字符 |
| play | obj | object | 视情况 | 歌曲对象；`state=1` 时必填 |
| playmode | state | string | 是 | 播放模式，枚举 `random`、`loop`、`order` |
| playmode | targetID | string | 否 | 目标设备 ID，默认空串 |
| vol | value | number | 是 | 音量，0–1 |
| vol | targetID | string | 否 | 目标设备 ID，默认空串 |
| playspeed | value | number | 是 | 倍速，枚举 `2`、`1.75`、`1.5`、`1.25`、`1`、`0.75`、`0.25` |
| playspeed | targetID | string | 否 | 目标设备 ID，默认空串 |
| progress | value | number | 是 | 播放进度，0–1 |
| progress | targetID | string | 否 | 目标设备 ID，默认空串 |
| chat | to | string | 是 | 会话对象账号，1–50 字符，字母/数字/下划线 |
| chat | flag | string | 是 | 操作，枚举 `addmsg`、`del`、`clear` |
| chat | msgData | object | 视情况 | 消息数据；`del` 时必填且需含 `msgId`（1–50 字符） |
| pastefiledata | type | string | 否 | 粘贴方式，默认空串，枚举 ``（空）、`copy`、`cut` |
| pastefiledata | data | array | 否 | 文件列表，1–200 项；`type` 非空时必填 |
| pastefiledata | data[].name | string | 是 | 文件名，1–255 字符 |
| pastefiledata | data[].path | string | 是 | 文件路径，1–2000 字符 |
| pastefiledata | data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
null
```

**说明**

- 所有分支成功都返回 `code=1`、`data=null`；参数不合法返回 400，`codeText` 指明字段。
- `ssh`：写入该设备（`X-Tem-ID`）已有的 SSH 终端；`size` 调整窗口大小，`cmd` 写入命令。会话不存在或写入失败时，服务端给发送设备回推一条 `{ type:'ssh', data:'SSH connection has been disconnected...' }`，本接口仍返回成功。
- `updatedata`：调用 `syncUpdateData`，向其他设备推送 `{ type:'updatedata', data:{ flag, id } }`。
- `play` / `playmode` / `vol` / `playspeed` / `progress`：推送给 `targetID` 指定的设备；`targetID` 为空时推给“除发送设备外的其他设备”。
- `chat`：调用 `sendNotifyMsg`，更新双方好友会话的最后消息、未读状态，并向接收方与发送方推送 `{ type:'chat', data:{ flag, to, from, msgData } }`；本接口不写入聊天记录表（消息落库走 `/api/chat` 相关接口）。`flag=addmsg` 时 `msgData` 应携带消息对象（至少含 `type`、`content`，用于生成未读提示）。
- `pastefiledata`：`type` 为 `copy`/`cut` 时校验文件列表并原样推送；`type` 为空表示清空粘贴板，推送 `{ type:'pastefiledata', data:{} }`。均只发给其他设备。

```json
{
  "type": "updatedata",
  "data": { "flag": "note", "id": "HXXXXXXXXXXXX" }
}
```

---

## POST /api/user/delete-share

删除分享记录。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 分享 ID 数组，1–200 项，每项 1–50 字符 |

**响应 data**

```json
null
```

**说明**

- 只删除 `account` 为当前用户的记录，传别人的 ID 不会生效。
- 分享记录删除后，对应分享链接立即失效。
- 成功后推送 `updatedata`（`flag=sharelist`），文案 `删除分享成功`。

---

## POST /api/user/share-state

启用 / 停用分享。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 分享 ID 数组，1–200 项，每项 1–50 字符 |
| state | number | 是 | `1` 启用 / `0` 停用 |

**响应 data**

```json
null
```

**说明**

- 只更新属于当前账号的记录。
- 停用后分享页校验（`validShareState` 要求 `state=1`）会返回“分享已取消”。
- 成功后推送 `updatedata`（`flag=sharelist`），文案 `修改分享状态成功`。

---

## GET /api/user/share-list

分页获取我的分享列表。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageNo | number | 否 | 页码，整数，默认 1，≥1；越界会自动收敛 |
| pageSize | number | 否 | 每页条数，默认 20，1–200 |

**响应 data**

```json
{
  "total": 3,
  "totalPage": 1,
  "pageNo": 1,
  "data": [
    {
      "id": "HXXXXXXXXXXXX",
      "type": "file",
      "title": "分享文件",
      "pass": "",
      "exp_time": 0,
      "state": 1
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 总条数 |
| totalPage | number | 总页数（至少为 1） |
| pageNo | number | 实际页码 |
| data | array | 当前页分享列表 |
| data[].id | string | 分享 ID |
| data[].type | string | 分享类型：书签 `bookmk`、歌单 `music`、目录 `dir`、文件 `file` |
| data[].title | string | 分享标题 |
| data[].pass | string | 提取码，空串表示无 |
| data[].exp_time | number | 过期时间（毫秒时间戳），`0` 表示永久 |
| data[].state | number | `1` 启用 / `0` 停用 |

**说明**

- 按记录创建顺序倒序（`serial desc`）返回。
- 不返回分享内容明细，内容需通过对应模块的分享页接口获取。

---

## POST /api/user/edit-share

编辑分享标题、有效期和提取码。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分享 ID，1–50 字符 |
| title | string | 是 | 标题，1–200 字符 |
| expireTime | number | 是 | 有效天数，整数，≤99999；`0` 表示永久 |
| pass | string | 否 | 提取码，默认空串，≤20 字符 |

**响应 data**

```json
null
```

**说明**

- 只更新属于当前账号的记录；ID 不存在时也返回成功。
- `expireTime` 以“当前时间 + 天数”换算为绝对过期时间写入。
- 更新 `update_at`，因此该分享已发出的访问 Token 会立即失效（`validShareState` 比对 `update_at`），需要重新获取。
- 成功后推送 `updatedata`（`flag=sharelist`），文案 `更新分享成功`。

---

## GET /api/user/trash-list

分页获取回收站内容（书签、分组、笔记、历史、SSH）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 是 | 回收站类型，枚举 `note`（笔记）、`bmk`（书签）、`bmk_group`（书签分组）、`history`（历史记录）、`ssh`（SSH 配置） |
| word | string | 否 | 搜索词，默认空串，≤100 字符 |
| pageNo | number | 否 | 页码，整数，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 20，1–200 |

**响应 data**

```json
{
  "total": 2,
  "totalPage": 1,
  "pageNo": 1,
  "data": [],
  "splitWord": ["关键字", "关键", "字"]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 总条数 |
| totalPage | number | 总页数 |
| pageNo | number | 实际页码 |
| data | array | 当前页数据，字段随 `type` 变化 |
| splitWord | string[] | 搜索分词结果（含完整搜索词），无搜索词时为空数组 |

`data` 元素字段：

| type | 字段 |
| --- | --- |
| note | `id`、`title`、`create_at`、`update_at`、`visit_count`、`top`、`con`、`category`、`categoryArr`、`images` |
| bmk | `id`、`title`、`link`、`des`、`group_id`、`group_title`、`logo` |
| bmk_group | `id`、`title` |
| history | `id`、`content` |
| ssh | `id`、`title`、`port`、`host`、`username`、`category`、`top`、`auth_type`、`categoryArr` |

**说明**

- 只查询 `state=0`（已移入回收站）且属于当前账号的记录。
- 有关键词时按分词做相关度排序（最多取前 10 个分词，首词权重 10）；无关键词时书签按 `serial desc`、笔记按 `create_at desc`、其余按 `serial desc`。
- 笔记会解析 Markdown：`con` 为关键词前后的摘要片段数组（元素形如 `{ value, type }`，`type` 为 `text` 或 `icon`），无关键词时取正文前 200 字符；`images` 为笔记内图片；`categoryArr` 由 `category` 中记录的 ID 关联笔记分类得到。
- 书签会关联分组标题，分组不存在时 `group_title` 为 `主页` 或 `未知分组`。
- SSH 记录会关联 `ssh_category` 得到 `categoryArr`。

---

## POST /api/user/delete-trash

彻底删除回收站记录。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 是 | 类型，枚举 `bmk_group`、`bmk`、`note`、`history`、`ssh` |
| ids | string[] | 是 | 记录 ID 数组，0–200 项，每项 1–50 字符；空数组表示清空该类型全部回收站 |

**响应 data**

```json
null
```

**说明**

- 只处理 `state=0` 且属于当前账号的记录。
- `type=bmk_group`：删除分组后，在同一事务内删除这些分组下的所有书签（不区分 `state`）。
- `type=note`：数据库提交后，把每条笔记的历史版本目录移动到用户文件回收站，目标重名时自动改名。
- 成功后推送 `updatedata`（`flag=trash`），文案 `删除成功`。
- 删除不可恢复。

---

## POST /api/user/recover-trash

从回收站恢复记录。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 是 | 类型，枚举 `bmk_group`、`bmk`、`note`、`history`、`ssh` |
| ids | string[] | 是 | 记录 ID 数组，0–200 项，每项 1–50 字符；空数组表示恢复该类型全部 |

**响应 data**

```json
null
```

**说明**

- 把所选记录的 `state` 改回 1（空数组则批量恢复该类型全部）。
- 只恢复所选记录本身：恢复书签分组不会自动恢复其下书签；恢复笔记不会恢复历史版本文件。
- 先推送 `updatedata`（`flag=trash`），再推送一条对应业务的同步：`bmk_group`/`bmk` 映射为 `bookmark`，其余类型原样（`note`/`history`/`ssh`）。
- 文案 `恢复成功`。

---

## POST /api/user/clipboard

写入剪切板内容并同步到其他设备。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| text | string | 是 | 文本内容，最少 1 字符；UTF-8 字节数 ≤1 MB（1,048,576） |

**响应 data**

```json
null
```

**说明**

- 覆盖保存到该账号的备份目录 `clipboard` 文件。
- 向该账号其他在线设备推送 `{ type: 'clipboard', data: { text, os } }`，`os` 为发送端设备信息；不推送给发送设备。
- 超过大小限制返回 400，提示“剪切板内容不能超过 1MB”。

---

## GET /api/user/clipboard

读取剪切板内容。

**鉴权**：需要登录

**Query**

无参数。

**响应 data**

```json
{ "text": "复制的内容" }
```

**说明**

- 读取该账号备份目录中的 `clipboard` 文件；文件不存在时返回空字符串。
- 只返回最近一次写入的内容，没有历史记录。

---

## GET /api/user/online-clients

获取当前账号的在线客户端列表。

**鉴权**：需要登录

**Query**

无参数。

**响应 data**

```json
[
  {
    "temid": "HXXXXXXXXXXXX",
    "page": "home",
    "ip": "192.168.1.10",
    "os": "Windows / Chrome 131",
    "time": 1763100000000
  }
]
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| temid | string | 设备 ID（含账号前缀） |
| page | string | 设备最后上报的页面标识 |
| ip | string | 客户端 IP |
| os | string | 客户端系统 / 浏览器信息 |
| time | number | 最后活跃时间（毫秒时间戳） |

**说明**

- 数据来自内存中的连接缓存，只保留 30 秒内有长轮询、且 `page=home` 的设备；没有在线设备时返回空数组。
- 用于多端控制时选择目标设备（即 `POST /api/user/real-time` 的 `targetID`）。

---

# 管理员 /api/root

`/api/root` 下的全部接口在路由入口统一挂载了管理员校验中间件（`server/src/routes/root/index.js` 顶部 `route.use`），因此**每一个接口都要求登录且为管理员账号**，下文各接口的「鉴权」均写作「管理员」。

注意：该中间件只判断 `res.locals.hello.isRoot`（由 `app.js` 中 `user.account === appConfig.adminAccount` 得出），未登录时该值为 `undefined`，返回的是 403 `code:0`（`无权操作`），而不是 401 `code:2`。普通用户访问同样返回 403。

本文件中的「清理 / 删除」类操作都会经过 `_delDir`：当文件回收站开关（`trashState`）开启时（默认开启），被删文件会移动到管理员账号的回收站目录 `.h_trash`，而不是物理删除；关闭回收站后才会真正删除。

## POST /api/root/email

配置系统发信邮箱。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| state | number | 是 | 是否启用邮箱：0 关闭，1 开启 |
| user | string | 否 | 发信邮箱地址，默认空串，最长 255；`state=1` 时必须为合法邮箱格式 |
| pass | string | 否 | 邮箱密码 / 授权码，默认空串，最长 100 |
| host | string | 否 | SMTP 服务器地址，默认空串，最长 255；`state=1` 时不能为空 |
| secure | number | 是 | 是否使用 SSL：0 否，1 是（写入配置时转为布尔值） |
| port | number | 否 | SMTP 端口，默认 465，最小 0 |

**响应 data**：无

**说明**：校验只在 `state=1` 时执行；`state=0` 时其余字段可全部留空。配置会写入 `config.json`（`pass` 为明文），并立即生效，供找回密码、绑定邮箱等验证码邮件以及测试邮件使用；关闭后这些依赖邮箱的功能会直接返回未开启。

## GET /api/root/user-list

分页获取用户列表，并附带站点主要配置（注册、回收站、缓存过期、公开接口、邮箱、备用图标接口）。

**鉴权**：管理员

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageNo | number | 否 | 页码，默认 1，最小 1；超过总页数时自动修正为最后一页 |
| pageSize | number | 否 | 每页条数，默认 10，范围 1~100 |
| word | string | 否 | 搜索词，默认空串，最长 100；对 `username`、`account`、`email` 做**精确匹配**（OR 关系），非模糊搜索 |

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 用户总数（不含通知账号） |
| totalPage | number | 总页数，至少为 1 |
| pageNo | number | 修正后的实际页码 |
| data | array | 用户列表，见下表 |
| registerState | boolean | 注册开关 |
| trashState | boolean | 文件回收站开关 |
| cacheExp | object | 缓存过期配置 `{ uploadSaveDay, faviconCache, siteInfoCache }` |
| pubApi | object | 公开接口开关 `{ randomBgApi, randomMusicApi, siteInfoApi, faviconApi, echoApi }` |
| email | object | 当前邮箱配置，字段为 `{ user, pass, host, secure, port, state }`，**包含明文密码** |
| faviconSpareApi | string | 备用图标接口地址 |

`data` 数组元素：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| account | string | 账号 ID |
| username | string | 用户名 |
| update_at | number | 最后活跃时间（毫秒时间戳） |
| email | string | 绑定邮箱，未绑定为空串 |
| state | number | 账号状态：1 正常，0 已关闭 |
| hide | number | 隐身开关：1 隐藏（在聊天在线列表中按离线处理），0 正常 |
| os | string[] | 当前在线连接，格式为 `系统名(ip)`，无连接时为空数组 |
| online | number | 1 表示 30 秒内有活动，0 表示离线 |

**说明**：查询条件中固定排除了 `appConfig.notifyAccount`（通知机器人账号），按 `update_at` 倒序排列。

## POST /api/root/favicon-spare-api

设置图标获取失败时使用的备用接口地址。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| link | string | 否 | 备用接口地址，默认空串，最长 2000；非空时必须是合法的 http/https URL |

**响应 data**：无

**说明**：空串表示清空备用接口。

## POST /api/root/account-state

批量启用 / 关闭账号。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| accounts | string[] | 是 | 账号 ID 数组，长度 1~100；单个元素长度 1~50，仅允许字母、数字、下划线；不能包含通知账号与管理员账号 |
| state | number | 否 | 目标状态，默认 1；0 关闭，1 激活 |

**响应 data**：无

**说明**：一次性更新所有匹配账号的 `state` 字段，并清空这些账号的用户信息缓存，使状态立即生效；被关闭的账号无法登录。管理员账号与通知账号被校验规则排除，不能通过该接口关闭。

## POST /api/root/delete-account

彻底销毁指定账号及其全部数据。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 要删除的账号 ID，长度 1~50，仅允许字母、数字、下划线；不能是通知账号或管理员账号 |

**响应 data**：无

**说明**：危险操作，不可撤销。内部 `deleteUser` 会删除 `user`、书签、书签分组、倒计时、历史、笔记、笔记分类、分享、SSH、SSH 分类、待办、播放记录、播放列表、歌单、收藏壁纸、聊天记录、好友关系等数据，并删除该用户的文件目录（回收站开启时移入管理员回收站），最后清理用户缓存。数据库改动在单个事务中提交。

## POST /api/root/clean-music-file

清理音乐库中的无效数据与孤儿文件。

**鉴权**：管理员

**Body**：无

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | string | 后台任务标识，格式为 `管理员account_nanoid` |

**说明**：接口立即返回，清理在后台异步执行，分三部分：

1. 遍历 `songs` 表，删除磁盘上已找不到对应文件的歌曲记录；
2. 遍历音乐目录，删除 `songs` 表中无记录引用的文件（不会删除数据库中仍在引用的文件）；
3. 递归删除音乐目录下的空文件夹。

进度可通过 `POST /api/task/info`（传 `key`）查询，任务文本形如 `清理歌曲: 数据(n)-文件(n)-空文件夹(n)`；可用 `POST /api/task/cancel` 中止。任务完成后 30 秒自动从内存移除。执行失败时会写入日志并向管理员推送站内消息。

## POST /api/root/clean-bg-file

清理壁纸库中的无效数据与孤儿文件。

**鉴权**：管理员

**Body**：无

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | string | 后台任务标识，格式为 `管理员account_nanoid` |

**说明**：逻辑与 `/clean-music-file` 一致，只是作用于 `bg` 表与壁纸目录：删除文件缺失的壁纸记录、删除壁上目录中无记录引用的文件、删除空文件夹。立即返回，后台执行，可通过 `/api/task/info`、`/api/task/cancel` 查询进度或取消；失败时写日志并通知管理员。

## POST /api/root/clean-pic-file

清理图床中的无效数据与孤儿文件。

**鉴权**：管理员

**Body**：无

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | string | 后台任务标识，格式为 `管理员account_nanoid` |

**说明**：逻辑同上，作用于 `pic` 表与图床目录：删除文件缺失的图片记录、删除目录中无记录引用的文件、删除空文件夹。立即返回，后台异步执行，失败时写日志并通知管理员。

## POST /api/root/clean-chat-file

清理聊天室上传记录与上传文件。

**鉴权**：管理员

**Body**：无

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | string | 后台任务标识，格式为 `管理员account_nanoid` |

**说明**：立即返回，后台异步执行，包含三步：

1. 以 `upload.hash` 左连接 `chat.hash`，删除所有**没有任何聊天消息引用**的上传记录（孤儿记录）；
2. 遍历剩余 `upload` 记录，删除磁盘上文件已不存在的记录；
3. 遍历上传目录，删除无记录引用的文件，并删除空文件夹。

会同时清理数据库记录与磁盘文件，属于破坏性操作；回收站开启时文件进入管理员回收站。失败时写日志并通知管理员。

## POST /api/root/register-state

切换注册开关（取反）。

**鉴权**：管理员

**Body**：无

**响应 data**：`boolean`，切换后的注册状态（`true` 开启，`false` 关闭）

**说明**：无参数，每调用一次在开 / 关之间翻转一次；当前值可在 `/user-list` 返回的 `registerState` 中读取。

## POST /api/root/update-tokenkey

重新生成用于签发登录令牌的 `tokenKey`。

**鉴权**：管理员

**Body**：无

**响应 data**：无

**说明**：危险操作。`tokenKey` 是 JWT 的签名 / 加密密钥，更新后会写入 `config.json` 并立即生效，**所有已签发的登录令牌全部失效**，包括管理员自己，所有用户（含当前会话）都需要重新登录。

## GET /api/root/log

读取指定日志文件内容。

**鉴权**：管理员

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 日志文件名，去空格后长度 1~255，例如 `2xx.log`、`4xx.log`、`5xx.log` |

**响应 data**：`string[]`，日志文件按行切分后过滤空行并**倒序**排列（最新的在最前）

**说明**：日志文件按 HTTP 状态码首位分组写入，文件名形如 `2xx.log` / `4xx.log` / `5xx.log`，位于日志目录，可用 `/log-list` 获取真实文件名。文件不存在时返回空数组。

## GET /api/root/log-list

获取日志文件列表。

**鉴权**：管理员

**Query**：无

**响应 data**：数组，仅包含日志目录下的文件（不含子目录），按创建时间倒序：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 文件名 |
| path | string | 所在目录 |
| type | string | 固定为 `file` |
| time | number | 创建时间（毫秒时间戳，取自 `ctimeMs`） |
| size | number | 文件大小（字节） |
| mode | string | 权限，形如 `rw-r--r-- 644` |
| uid | number | 所有者 uid |
| gid | number | 所属 gid |
| fileType | string | 文件类型标识，如 `file` |
| fileTypeName | string | 文件类型中文名 |

**说明**：服务端每 30 分钟检查一次，日志文件超过 200 个时自动删除最旧的文件，并通知管理员。

## POST /api/root/delete-log

删除日志文件。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 日志文件名，去空格后长度 1~255；传入固定值 `all` 表示清空整个日志目录 |

**响应 data**：无

**说明**：危险操作。`name=all` 时删除整个日志目录（不只是目录内的文件）；其他值只删除对应文件。回收站开启时被删对象进入管理员回收站。参数只校验了长度，未过滤 `../` 等路径片段，调用方应只传真实日志文件名。

## POST /api/root/trash-state

切换文件回收站开关（取反）。

**鉴权**：管理员

**Body**：无

**响应 data**：`boolean`，切换后的状态（`true` 开启，`false` 关闭）

**说明**：无参数，每次调用翻转一次。开启时删除类操作会把文件移动到管理员回收站 `.h_trash`；关闭时直接物理删除，后续删除不可恢复。

## POST /api/root/pub-api-state

设置各公开接口的开放状态。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| randomBgApi | number | 是 | 随机壁纸接口开关：0 关闭，1 开启 |
| randomMusicApi | number | 是 | 随机音乐接口 `/api/music` 开关：0 关闭，1 开启 |
| siteInfoApi | number | 是 | 网页信息接口 `/api/site-info` 开关：0 关闭，1 开启 |
| faviconApi | number | 是 | 图标接口开关：0 关闭，1 开启 |
| echoApi | number | 是 | Echo 接口开关：0 关闭，1 开启 |

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| randomBgApi | boolean | 随机壁纸接口状态 |
| randomMusicApi | boolean | 随机音乐接口状态 |
| siteInfoApi | boolean | 网页信息接口状态 |
| faviconApi | boolean | 图标接口状态 |
| echoApi | boolean | Echo 接口状态 |

**说明**：五个字段都是必填且必须同时提交（未传会返回 400）；内部按布尔值保存，关闭后接口仅登录用户可用（具体限制以各公开接口自身实现为准）。

## POST /api/root/change-cache-time

设置缓存 / 文件的过期天数。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| uploadSaveDay | number | 是 | 聊天上传文件保留天数，范围 0~99999；0 表示永久保留，大于 0 时过期文件会被定时清理 |
| faviconCache | number | 是 | 网站图标缓存天数，范围 0~99999；0 表示不过期 |
| siteInfoCache | number | 是 | 网页信息缓存天数，范围 0~99999；0 表示不过期 |

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| uploadSaveDay | number | 保存后的上传文件保留天数 |
| faviconCache | number | 保存后的图标缓存天数 |
| siteInfoCache | number | 保存后的网页信息缓存天数 |

**说明**：三个字段均为必填，`toInt` 转换后必须在 0~99999 之间。

## POST /api/root/clean-database

整理数据库文件。

**鉴权**：管理员

**Body**：无

**响应 data**：无

**说明**：执行 SQLite 的 `VACUUM`，回收删除数据后留下的空闲空间并压缩数据库文件。操作期间会锁库，大库可能耗时较长；不需要停止服务。

## POST /api/root/custom-code

写入注入到页面 `<head>` 与 `<body>` 的自定义代码。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| head | string | 否 | 注入到 `<head>` 的代码，默认空串，UTF-8 字节数不超过 102400（100KB） |
| body | string | 否 | 注入到 `<body>` 的代码，默认空串，UTF-8 字节数不超过 102400（100KB） |

**响应 data**：无

**说明**：内容分别整体覆盖写入自定义目录下的 `custom_head.html` 与 `custom_body.html`，空串即清空。代码会原样注入页面，可执行任意脚本，仅管理员可操作；前端需重新加载页面后生效。

## POST /api/root/tips

设置站点提示（更新提示）状态。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| flag | string | 是 | 操作类型：`close` 关闭提示（写入 0），`update` 生成新的提示标识（写入随机 nanoid） |

**响应 data**：无

**说明**：修改后会通过 WebSocket 向所有在线连接广播 `{ type: 'updatedata', data: { flag: 'tips' } }`，前端据此刷新提示状态，无需手动刷新页面。

## POST /api/root/test-email

发送一封测试邮件。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| email | string | 是 | 收件邮箱，去空格后长度 1~255，必须是合法邮箱地址 |

**响应 data**：无

**说明**：需先在 `/email` 中启用邮箱（`state=1`），否则返回 403 `未开启邮箱验证`。邮件标题为 `Hello账号验证邮件`，正文为 `测试邮件`；SMTP 发送失败时返回 500 `code:0`。

## POST /api/root/test-tfa

校验两步验证验证码。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| token | string | 是 | 6 位验证码，仅允许字母数字 |

**响应 data**：无

**说明**：使用**当前登录管理员账号**已绑定的两步验证密钥（`user.verify`）进行校验。管理员未开启两步验证时返回 403 `未开启两步验证`；验证码错误返回 403 `验证码错误`；正确返回成功。该接口只做校验，不会修改任何数据。

## POST /api/root/create-account

由管理员创建新账号。

**鉴权**：管理员

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 用户名，去空格后长度 1~40，仅允许字母、数字、下划线 |
| password | string | 是 | 登录密码，去空格后长度 1~50，仅允许字母、数字、下划线（会哈希后存储） |

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| account | string | 新账号的账号 ID（服务端随机生成） |
| username | string | 新账号用户名 |

**说明**：用户名已存在时返回 403 `用户名已注册`。创建时会生成随机 `account` 与 `chat_id`、写入密码哈希，并在同一事务内自动与聊天室账号（`chang`）和通知账号建立好友关系；`state` 默认为 1（可用），邮箱为空。创建后用户可立即登录，登录记录 / token 有效期等走正常登录流程。

## GET /api/root/sys-status

获取服务器实时资源占用。

**鉴权**：管理员

**Query**：无

**响应 data**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| cpu | object | `{ percent, cores, arch }`：CPU 使用率百分比、核心数、架构 |
| mem | object | `{ total, free, used, percent }`：物理内存总量 / 空闲 / 已用 / 使用率，单位字节 |
| swap | object | `{ total, used, free, percent }`：虚拟内存信息，单位字节；无 swap 时全为 0 |
| disk | object | `{ total, used, available, percent }`：根分区容量信息，单位字节；读取失败时全为 0 |
| net | object | `{ rx, tx }`：当前网速（字节/秒），取自 `/proc/net/dev` 中 `eth` / `en` / `wl` 开头的网卡；读取失败为 0 |

**说明**：结果为采样值并带缓存：CPU、网速缓存 1 秒，内存、swap 缓存 2 秒，磁盘缓存 5 秒。首次调用时网速恒为 0（没有上一次采样点）。

---

# 文件管理

本文档覆盖三个挂载点：

| 挂载点 | 源码 | 说明 |
| --- | --- | --- |
| `/api/file` | `server/src/routes/file/index.js` | 目录浏览、上传、压缩、分享、回收站等全部管理接口 |
| `/api/f` | `server/src/routes/getfile/index.js` | 通用文件读取/下载/缩略图处理器，成功时直接返回文件流 |
| `/api/task` | `server/src/routes/task/index.js` | 异步任务进度查询与取消 |

**全局约定**

- 除 `/api/f` 成功响应外，所有接口统一返回 `{ code, codeText, data }`：`code=1` 成功、`0` 失败、`2` 未登录（HTTP 401）、`3` 处理中或无新数据（HTTP 200）。下文只写 `data`。
- 鉴权使用 Cookie `token`（加密 JWT）。`/api/file` 中 `get-share`、`read-dir`、`read-file` 注册在登录中间件之前，属于公开接口（`read-dir`/`read-file` 需登录态或有效分享 token），其余接口一律需要登录。
- 路径参数 `path` 均为**相对当前用户根目录**的 Unix 风格路径，以 `/` 开头（如 `/docs/a.txt`）。管理员 `root` 的根目录是 `server/app_data`，普通用户是 `server/app_data/appFiles/userFiles/<account>`。
- 所有涉及真实文件系统的操作都会经过 `isPathSafe(base, target, allowEqual)`：对目标路径逐级向上做 `realpath`，解析结果必须位于用户根目录内，用于阻断 `../` 穿越与符号链接逃逸。越界返回 403。
- 保留目录：`.h_trash`（回收站）、`.h_config`（用户配置，禁止移动/删除/重命名，解压时非管理员忽略链接）、`.h_history`（文本编辑历史版本）。
- 异步任务：接口立即返回 `{ "key": "<account>_<nanoid>" }`，之后用 `POST /api/task/info` 轮询进度；`key` 前缀固定为任务归属账号。
- 请求头 `X-Tem-ID`（客户端临时 ID，字母数字，≤50 字符）：`POST /api/file/read-dir`、`POST /api/task/info`、`POST /api/task/cancel` 强制要求非空，缺失返回 400。
- 写操作完成后服务端会向该账号的 WebSocket 连接推送 `updatedata`（`flag` 为 `file` / `sharelist` / `music` / `bg` 等），客户端据此刷新，无需轮询。

# 文件接口 /api/file

## POST /api/file/get-share

校验分享链接并换取分享访问 token。打开他人分享的文件/文件夹时调用。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分享 ID，字母数字，1~50 字符 |
| pass | string | 否 | 提取码，默认 `''`，最长 20 字符 |
| captchaId | string | 否 | 验证码票据 ID，默认 `''`，字母数字，最长 50 字符 |

**响应 data**

校验通过（`code=1`）：

```json
{
  "username": "分享者昵称（好友关系下会替换为备注）",
  "logo": "/api/f/logo/root/xxx.png",
  "exp_time": 1767225600000,
  "account": "root",
  "data": { "name": "docs", "path": "/", "type": "dir", "size": 0 },
  "title": "分享标题",
  "token": "分享访问 JWT（有效期 10 小时）"
}
```

需要验证码（`code=1`，`needCaptcha=true`）：

```json
{ "id": "分享ID", "needCaptcha": true }
```

提取码错误：`code=3`，`data` 为 `null`。分享已取消/已过期/不存在：HTTP 404，`code=0`。

**说明**

- 同一 IP 连续输错提取码会触发验证码，需先完成验证再带上 `captchaId` 重试；首次空提取码不计入错误次数。
- `token` 是后续 `read-dir`、`read-file`、`/api/f/sharefile/*`、`/api/task/*` 的分享凭证，过期或被分享者取消、分享内容变更后立即失效。
- `exp_time=0` 表示永不过期，否则为毫秒时间戳。

## POST /api/file/read-dir

读取目录列表（支持搜索、排序、分页、按分享 token 浏览）。

**鉴权**：公开（需登录态，或提供有效分享 `token`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 目录路径，1~2000 字符；分享模式下相对分享根目录 |
| pageNo | number | 否 | 页码，默认 `1`，最小 1 |
| pageSize | number | 否 | 每页条数，默认 `20`，范围 1~200 |
| sortType | string | 否 | 排序字段，默认 `time`，枚举 `name` / `time` / `size` / `type` |
| isDesc | number | 否 | 是否降序，默认 `1`，枚举 `0` / `1` |
| subDir | number | 否 | 搜索时是否递归子目录，默认 `0`，枚举 `0` / `1`（仅配合 `word` 生效） |
| update | number | 否 | `1` 表示跳过缓存强制重读，默认 `0` |
| word | string | 否 | 文件名关键词，默认 `''`，最长 100 字符，不区分大小写 |
| token | string | 否 | 分享访问 token，默认 `''`，最长 2000 字符 |
| hidden | number | 否 | `1` 过滤以 `.` 开头的隐藏项，默认 `0` |

**响应 data**

正常：

```json
{
  "total": 2,
  "totalPage": 1,
  "pageNo": 1,
  "data": [
    {
      "path": "/",
      "type": "dir",
      "name": "docs",
      "time": 1763000000000,
      "size": 10240,
      "mode": "drwxr-xr-x 755",
      "uid": 1000,
      "gid": 1000,
      "favorite": 0
    },
    {
      "path": "/docs",
      "type": "file",
      "name": "a.txt",
      "time": 1763000000000,
      "size": 12,
      "mode": "-rw-r--r-- 644",
      "uid": 1000,
      "gid": 1000,
      "fileType": "file",
      "fileTypeName": "文件"
    }
  ]
}
```

`data` 元素字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| path | string | 所在目录（相对用户根目录或分享根目录） |
| name | string | 名称 |
| type | string | `dir` 或 `file` |
| time | number | 变更时间（毫秒时间戳） |
| size | number | 文件大小；目录返回缓存大小（未读取过为 0） |
| mode | string | 权限字符串，如 `drwxr-xr-x 755`；非管理员不返回 |
| uid / gid | number | 属主/属组；非管理员不返回 |
| favorite | number | 目录是否已收藏，`0/1`，仅在登录且非分享模式、仅目录项返回 |
| fileType | string | 文件实际类型：`file` / `symlink` / `fifo` / `socket` 等 |
| fileTypeName | string | 文件类型中文名 |
| linkTarget | string | 符号链接目标（已裁剪到用户根目录内的相对路径） |
| linkTargetType | string | 链接目标类型 |
| linkTargetTypeName | string | 链接目标类型中文名 |

读取超时（超过 1 秒）时立即返回任务 key，结果稍后通过任务接口或重新请求获取：

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 读取列表时会顺带记录 `cd-history`（最多 100 条）并返回收藏标记。
- 目录列表按 `account + 目录 + word` 缓存 10 分钟，命中缓存时不续期；`update=1` 可强制重读。
- 路径越界不报错，返回空的 `data`；`subDir=1` 且带 `word` 时递归遍历子目录并按关键词过滤。
- 分享 token 模式下 `path` 相对分享目标的父目录，且不会写访问历史。

## POST /api/file/read-file

读取文本文件内容（用于在线编辑）。

**鉴权**：公开（需登录态，或提供有效分享 `token`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 否 | 文件路径，默认 `''`，最长 2000 字符；分享模式下相对分享目录 |
| token | string | 否 | 分享访问 token，默认 `''`，最长 2000 字符 |

**响应 data**

文本文件（≤10MB 且判定为文本）：

```json
{ "type": "text", "data": "文件内容", "editing": "未保存的编辑草稿，没有则为 null" }
```

非文本或超过 10MB：

```json
{ "type": "other" }
```

**说明**

- 文件不存在、是目录或路径越界返回 403 `文件不存在`。
- 只有本人登录查看（非分享模式）时才返回 `editing` 草稿；草稿由 `POST /api/file/editing` 写入。

## POST /api/file/history-state

开启/关闭文本文件保存历史版本。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| state | number | 否 | `1` 开启、`0` 关闭，默认 `0` |

**响应 data**

`null`。

**说明**

- 开启后，每次 `save-file` 覆盖已有文件前会把旧内容复制到同目录的 `.h_history` 下，文件名带时间戳。

## GET /api/file/history-state

查询是否开启文件历史版本。

**鉴权**：需要登录

**响应 data**

```json
{ "file_history": 1 }
```

**说明**

- `0` 关闭，`1` 开启。

## GET /api/file/cd-history

获取目录访问历史（最近进入过的路径）。

**鉴权**：需要登录

**响应 data**

```json
["/", "/docs", "/docs/2026"]
```

**说明**

- 最多保留 100 条，新的在后，重复访问会移到末尾。

## GET /api/file/favorites

获取收藏的目录列表。

**鉴权**：需要登录

**响应 data**

```json
["/docs", "/pic/wallpaper"]
```

## POST /api/file/favorites

添加或移除收藏目录。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 否 | `add` 或 `del`，默认 `add` |
| data.name | string | 是 | 目录名，最长 255 字符 |
| data.path | string | 是 | 目录所在路径，最长 2000 字符 |
| data.type | string | 是 | 固定 `dir` |

**响应 data**

`null`。

**说明**

- 收藏路径由 `path` + `name` 拼接；最多收藏 100 个，超出返回 403。
- 幂等：重复添加不会产生重复项；写操作会清空该账号的目录列表缓存。

## GET /api/file/read-dir-size

统计目录总大小（异步任务）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 目录路径，1~2000 字符 |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 立即返回任务 key，进度通过 `POST /api/task/info` 读取（形如 `读取文件夹大小...12 (1.2 MB)`）。
- 结果按目录缓存 2 分钟，之后 `read-dir` 返回的目录 `size` 即为该值。

## POST /api/file/create-file

新建空文件。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 所在目录，1~2000 字符 |
| name | string | 是 | 文件名，1~255 字符，需通过文件名合法性校验 |

**响应 data**

`null`。

**说明**

- 名称含 `<>:"/\|?*`、控制字符或以空格/点结尾会被拒绝（403 `名称包含了不允许的特殊字符`）。
- 父目录必须存在且已存在同名项时报 403；不会覆盖已有文件。

## POST /api/file/create-link

创建符号链接或硬链接（仅管理员）。

**鉴权**：需要登录（且为管理员 `root`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 链接所在目录，1~2000 字符 |
| name | string | 是 | 链接名称，1~255 字符 |
| targetPath | string | 是 | 链接目标路径，1~2000 字符，必须存在 |
| isSymlink | number | 否 | `1` 符号链接（默认）、`0` 硬链接 |

**响应 data**

`null`。

**说明**

- 非管理员返回 403 `无权操作`。
- 目标不存在、同目录重名、或对目录建硬链接都会被拒绝。

## POST /api/file/share

创建文件/文件夹分享。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分享标题，1~200 字符 |
| expireTime | number | 是 | 有效期（天），`0` 表示永久，最大 99999 |
| pass | string | 否 | 提取码，默认 `''`，最长 20 字符 |
| data.name | string | 是 | 分享对象名称，最长 255 字符 |
| data.path | string | 是 | 分享对象所在目录，最长 2000 字符 |
| data.type | string | 是 | `dir` 或 `file` |
| data.size | number | 是 | 大小（字节），≥0，目录可传 0 |

**响应 data**

`null`。

**说明**

- 分享 ID 由服务端生成，前端通过 `get-share` 换取带权限的访问 token。
- 创建成功会推送 `updatedata`（`flag=sharelist`）。

## POST /api/file/save-file

保存文本文件内容。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 文件路径，1~2000 字符 |
| text | string | 否 | 文件内容，默认 `''`，UTF-8 字节数不能超过 10MB |

**响应 data**

`null`。

**说明**

- 目标不能是目录、回收站本身，路径必须存在且未越界。
- 已开启 `history-state` 且原文件非空时，先备份旧版本到 `.h_history`，备份失败只记日志不阻断保存。
- 保存成功会清除该文件的编辑草稿；若保存的是搜索引擎配置或快捷命令配置，会额外推送对应模块的更新事件。

## POST /api/file/editing

保存或清除文本编辑草稿（自动保存）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 文件路径，1~2000 字符 |
| text | string | 否 | 草稿内容，默认 `''`，最大 10MB |
| clear | number | 否 | `1` 删除草稿、`0` 保存草稿，默认 `0` |

**响应 data**

`null`。

**说明**

- 草稿按“文件路径的 hash”存于 `.h_config/file_editing`，与文件内容解耦，不会改动原文件。
- `read-file` 会返回未保存的草稿内容。

## POST /api/file/copy

复制文件/文件夹（异步任务）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 目标目录，1~2000 字符，必须存在且为目录 |
| rename | number | 是 | `1` 遇同名自动加随机后缀、`0` 不处理 |
| data | array | 是 | 待复制项，1~200 个，名称不能重复 |
| data[].name | string | 是 | 名称，最长 255 字符 |
| data[].path | string | 是 | 源所在目录，最长 2000 字符 |
| data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 目标不能是源自身或其子目录，否则该项被跳过。
- 并发 5 个任务复制，进度（数量 + 字节）写入任务文本；冲突且 `rename=0` 时该项失败。
- 目标为回收站路径时强制生成唯一文件名，避免覆盖回收站内容。

## POST /api/file/same-name

检查目标目录是否已存在同名文件/文件夹。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 目标目录，1~2000 字符 |
| data | array | 是 | 待检查项，1~200 个 |
| data[].name | string | 是 | 名称，最长 255 字符 |
| data[].path | string | 是 | 源目录，最长 2000 字符 |
| data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "hasSameName": true }
```

**说明**

- 只比较文件名，用于移动/复制前的冲突提示。

## POST /api/file/move

移动/重命名文件与文件夹（异步任务）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 目标目录，1~2000 字符，必须存在且为目录 |
| rename | number | 是 | `1` 遇同名自动加随机后缀、`0` 不处理 |
| data | array | 是 | 待移动项，1~200 个，名称不能重复 |
| data[].name | string | 是 | 名称，最长 255 字符 |
| data[].path | string | 是 | 源所在目录，最长 2000 字符 |
| data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 不能移动到自身或其子目录（会跳过），不能移动 `.h_config` 配置目录。
- 同分区为 `rename`，跨分区自动降级为复制+删除；并发 5 个。

## POST /api/file/zip

压缩单个文件/文件夹为 zip（异步任务）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| data.name | string | 是 | 待压缩项名称，最长 255 字符 |
| data.path | string | 是 | 待压缩项所在目录，最长 2000 字符 |
| data.type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 输出文件放在源文件所在目录，命名为 `原名去扩展名.zip`（`a.txt` → `a.zip`）；重名或与回收站冲突时自动加随机后缀。
- 只支持单个目标，批量压缩需多次调用。

## POST /api/file/unzip

解压 zip 文件（异步任务）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| data.name | string | 是 | zip 文件名，必须以 `.zip` 结尾，最长 255 字符 |
| data.path | string | 是 | zip 所在目录，最长 2000 字符 |
| data.type | string | 是 | 固定 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 解压到同目录下与 zip 同名的文件夹（`a.zip` → `a/`），已存在则加随机后缀。
- 非管理员解压时忽略压缩包内的符号链接，防止越权。

## POST /api/file/delete

删除文件/文件夹，默认放入回收站（异步任务）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| force | number | 是 | `1` 永久删除、`0` 移入回收站 |
| data | array | 是 | 待删除项，1~200 个 |
| data[].name | string | 是 | 名称，最长 255 字符 |
| data[].path | string | 是 | 所在目录，最长 2000 字符 |
| data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 回收站为 `.h_trash`；删除回收站内已有内容、或目标与回收站互为父子路径时直接物理删除。
- 移入回收站时保留原文件名，重名自动加随机后缀；`.h_config` 配置目录会被跳过。

## POST /api/file/clear-trash

清空回收站（异步任务）。

**鉴权**：需要登录

**Body**

无参数。

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 逐个物理删除 `.h_trash` 下的所有条目（并发 5），不可恢复。

## POST /api/file/create-dir

新建文件夹。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 所在目录，1~2000 字符 |
| name | string | 是 | 文件夹名，1~255 字符 |

**响应 data**

`null`。

**说明**

- 名称合法性校验同 `create-file`；父目录不存在或同名已存在返回 403。

## POST /api/file/rename

重命名文件/文件夹（同步，不进入回收站）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 新名称，1~255 字符，需通过文件名合法性校验 |
| data.name | string | 是 | 原名称，最长 255 字符 |
| data.path | string | 是 | 所在目录，最长 2000 字符 |
| data.type | string | 是 | `dir` 或 `file` |

**响应 data**

`null`。

**说明**

- 原项必须存在；新名称已存在或指向回收站时报 403，不覆盖。
- 对 `.h_config` 目录本身不做改名（接口仍返回成功）。

## POST /api/file/mode

修改文件权限（仅管理员，异步任务）。

**鉴权**：需要登录（且为管理员 `root`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| mode | string | 是 | 三位八进制权限，正则 `^[0-7]{3}$`，如 `755` |
| r | number | 否 | `1` 递归子目录，默认 `0` |
| data | array | 是 | 目标项，1~200 个 |
| data[].name | string | 是 | 名称，最长 255 字符 |
| data[].path | string | 是 | 所在目录，最长 2000 字符 |
| data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 非管理员返回 403 `无权操作`；并发 5 个，进度写入任务文本。

## POST /api/file/chown

修改文件属主/属组（仅管理员，异步任务）。

**鉴权**：需要登录（且为管理员 `root`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| uid | number | 否 | 用户 ID，默认 `0`，≥0 |
| gid | number | 否 | 用户组 ID，默认 `0`，≥0 |
| r | number | 否 | `1` 递归，默认 `0` |
| data | array | 是 | 目标项，1~200 个 |
| data[].name | string | 是 | 名称，最长 255 字符 |
| data[].path | string | 是 | 所在目录，最长 2000 字符 |
| data[].type | string | 是 | `dir` 或 `file` |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

## POST /api/file/up

上传单个分片（断点续传协议的一步）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| HASH | string | 是 | 整个文件的哈希，字母数字，1~50 字符，同时作为临时会话目录名 |
| name | string | 是 | 分片序号文件名，必须匹配 `^_[0-9]+$`，最长 20 字符 |

**Multipart**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `attrname` | file | 是 | 分片文件；服务端只取**第一个文件字段**，字段名实际不限，官方客户端固定用 `attrname` |

**响应 data**

`null`。

**说明**

- 分片保存在 `app_data/appFiles/tem/<account>_<HASH>/` 下，文件名即 `name`（`_0`、`_1`……），同名分片直接覆盖，因此失败可重传。
- 单片上限 **50MB**（`fieldLength.maxFileChunk`），由 formidable `maxFileSize` 强制；超限返回 500 `code=0`。单次请求超时 10 分钟。
- 服务端不会逐片校验 HASH，HASH 仅用于隔离上传会话；合并时才校验整体哈希。
- 完整协议：`breakpoint`（查询已传分片）→ 循环 `up` → `merge`（合并成目标文件）。

## POST /api/file/merge

合并已上传分片为目标文件。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| HASH | string | 是 | 文件哈希，字母数字，1~50 字符，须与上传时一致 |
| count | number | 是 | 分片总数，1~400 |
| path | string | 是 | 目标文件完整路径（含文件名），1~2000 字符 |

**响应 data**

`null`。

**说明**

- 分片按 `_` 后的数字升序拼接；实际分片数少于 `count` 时报错（分片目录保留，可继续补传）。
- 目标文件已存在会**先删除再写入**；目标为回收站路径时自动改名为随机后缀。
- 合并完成后重新计算文件哈希与 `HASH` 比对，不一致则删除文件并报错。
- 成功后清空分片目录；失败只清理半成品，保留分片以支持续传。
- 理论最大单文件 = 400 × 50MB = 20GB。整个合并请求的超时阈值 `operationTimeout`（10 秒）只用于决定是否额外推送全量刷新事件，不影响任务继续执行。

## POST /api/file/breakpoint

查询某个上传会话已上传的分片列表（断点续传）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| HASH | string | 是 | 文件哈希，字母数字，1~50 字符 |

**响应 data**

```json
["_0", "_1", "_2"]
```

**说明**

- 目录不存在时返回空数组；客户端据此跳过已上传分片。

## POST /api/file/repeat

判断目标路径是否已存在（上传前查重）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 待检查路径，1~2000 字符 |

**响应 data**

`null`（两种结果都为空）。

**说明**

- 路径已存在返回 `code=1`，不存在返回 `code=3`（无新数据），客户端以 `code` 区分而不是 `data`。
- 仅做存在性判断，不做路径越界拦截。

## POST /api/file/complete

路径自动补全。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 待补全路径，1~2000 字符 |
| type | string | 否 | 补全类型，默认 `all`，枚举 `dir` / `file` / `all` |

**响应 data**

```json
"/docs/2026/"
```

**说明**

- 在父目录中查找以输入片段开头的项，取最短匹配；目录结果以 `/` 结尾。
- `type=dir` 时会把符号链接解析为真实类型再判断；输入已以 `/` 结尾则原样返回。

## POST /api/file/download

离线下载 URL 到指定目录（异步任务）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| url | string | 是 | 下载地址，必须是 http/https，最长 2000 字符 |
| path | string | 是 | 目标目录，1~2000 字符，必须存在且为目录 |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 文件名取 URL pathname 的最后一段并做非法字符清洗，为空则用 `unknown`；已存在同名文件时加随机后缀，不覆盖。
- 断点续传：临时文件位于 `tem/<account>_<hash(url)>`，若已存在则带 `Range: bytes=N-` 续传；服务器不支持 206 时自动从头重下。
- 强制关闭响应解压（`decompress: false`），避免 gzip 导致续传错位；不限制文件大小，进度（字节）实时写入任务文本。
- 失败会写日志、推送 `errMsg` 并发送聊天通知。

## POST /api/file/add-file-to

扫描目录，把音乐/图片批量加入音乐库或壁纸库（仅管理员，异步任务）。

**鉴权**：需要登录（且为管理员 `root`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| type | string | 是 | `music` 加入音乐库、`bg` 加入壁纸库 |
| path | string | 是 | 目标目录，1~2000 字符，必须存在且为目录 |

**响应 data**

```json
{ "key": "root_xxxxxxxx" }
```

**说明**

- 递归遍历目录（并发 5）：音乐仅收 ≤50MB 的音频，壁纸仅收 ≤20MB 的图片，重复文件（按路径 hash）自动跳过。
- 任务文本形如 `添加音乐...12 (23 MB) 跳过 3`；完成后推送 `updatedata`（`flag=music` / `bg`）。

# 文件读取 /api/f

`/api/f` 不是独立路由文件，而是 `app.js` 中的兜底中间件调用 `getFile(req, res, filePath)`。**成功时直接返回文件二进制流，不使用 `{ code, codeText, data }` 信封**；失败时才返回 JSON 信封（`code=0/2`）。

## GET /api/f/<dir>/<path>

按目录白名单读取文件、生成缩略图或下载。

**鉴权**：公开 / 需要登录，取决于第一段路径（见下表）

**URL 规则**

- 形式一：`/api/f/<dir>/<path...>`，例如 `/api/f/file/docs/a.txt`。
- 形式二：`/api/f/任意?p=<dir>/<path...>`，当 query 带 `p` 时以其为准，路径前缀部分被忽略。
- 第一段 `<dir>` 必须是白名单目录，否则 403 `无权访问`；成功解析到目录或文件不存在时 404 `文件不存在`。
- 处理器挂在 `app.use` 上，任何 HTTP 方法都会进入，但语义上只应使用 `GET`。

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| w | number | 否 | 缩略图宽度，默认 `0`（不生成），≥0；实际归一到 256 / 512 / 1024，高度固定 1024 |
| d | number | 否 | `1` 作为附件下载（设置 `Content-Disposition`），默认 `0` |
| n | string | 否 | 下载时的重命名，默认 `''`，最长 255 字符且必须为合法文件名；不带扩展名时自动补原后缀 |
| token | string | 否 | 分享 token 或临时文件访问 token，默认 `''`，最长 2000 字符 |
| p | string | 否 | 文件路径，1~2000 字符；与 URL 形式二等价，优先于路径段 |

**目录白名单与映射**

| 第一段 | 鉴权 | 路径含义 | 解析来源 |
| --- | --- | --- | --- |
| `pic` | 公开 | `/pic/<id>` | 图片表 `pic.url`，按 `id` 查 |
| `sharemusic` | 公开 | `/sharemusic/<type>/<id>` | 已登录时等同 `music`；未登录需音乐分享 `token` 且 `id` 在分享列表内 |
| `sharefile` | 公开（需分享 token） | `/sharefile/<path...>` | 分享 token 有效（类型 `file`）后映射到分享者文件；分享的是文件则忽略后续路径，是目录则拼在其后 |
| `logo` | 公开 | `/logo/<account>/<path...>` | 该用户 `.h_config/logo` |
| `pub` | 公开 | `/pub/<account>/<path...>` | 该用户 `.h_config/pub`（公开目录） |
| `bg` | 需要登录 | `/bg/<id>` | 壁纸表 `bg.url`，按 `id` 查 |
| `upload` | 需要登录 | `/upload/<chatId>` | 聊天消息附件；仅群聊或本人收发的消息可访问，否则 403 |
| `file` | 需要登录 | `/file/<path...>` | 当前用户根目录下的真实文件路径 |
| `music` | 需要登录 | `/music/<type>/<id>` | 歌曲表字段，`type` 枚举 `pic` / `url` / `mv` |

**响应**

- 命中文件：直接返回文件流，响应头 `X-File-Size` 为实际字节数（生成缩略图时为缩略图大小）。
- `d=1` 时额外设置 `Content-Disposition: attachment; filename*=UTF-8''<编码后的名字>`、`Content-Type: application/octet-stream`，并暴露 `Content-Disposition` 供前端读取。
- 未命中或参数非法：JSON 信封，`code=0`（400/403/404）或 `code=2`（未登录）。

**说明**

- `token` 为 `temAccessFile` 类型 JWT 时，会以 token 内的 `account` 和 `p` 覆盖当前身份与路径，用于给未登录用户签发单文件临时访问权限（由 `GET /api/user/file-token` 签发，有效期 10 小时）。
- 缩略图仅对 `pic`、`music`、`bg`、`upload`、`file`、`sharefile`、`sharemusic` 下的图片生效，原图 >20MB 直接 403 `获取缩略图失败(图片过大)`；缩略图为 webp，缓存于缩略图目录，同名并发请求加锁只生成一次。
- 所有映射路径都经过 `isPathSafe` 校验（如 `file/` 需在用户根目录内、`logo/` 需在本人 logo 目录内），`id` 类参数要求字母数字且 ≤50 字符。
- 反代/压缩中间件对 `/api/f` 关闭 gzip，避免大文件传输产生额外 CPU 与首字节延迟。

# 异步任务 /api/task

## POST /api/task/info

查询异步任务进度。

**鉴权**：公开（需登录态，或提供有效分享 `token`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| key | string | 是 | 任务 key，字母数字，1~100 字符，必须以 `<accFlag>_` 开头 |
| token | string | 否 | 分享访问 token，默认 `''`，最长 2000 字符 |

**响应 data**

```json
{ "text": "复制文件...23 (12.4 MB)", "state": 0 }
```

**说明**

- `state`：`0` 进行中、`1` 已完成、`-1` 不存在（任务已清理）。读到 `state=1` 后服务端立即删除该任务，之后返回 `-1`。
- `key` 前缀校验：登录时 `accFlag` 为账号，分享模式为 `分享ID + 账号`（账号为空时用 `X-Tem-ID`），不匹配返回 400。
- `X-Tem-ID` 请求头必填（非空），否则 400。

## POST /api/task/cancel

取消异步任务（会中断底层文件操作）。

**鉴权**：公开（需登录态，或提供有效分享 `token`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| key | string | 是 | 任务 key，字母数字，1~100 字符，须以 `<accFlag>_` 开头 |
| token | string | 否 | 分享访问 token，默认 `''`，最长 2000 字符 |

**响应 data**

`null`。

**说明**

- 通过 `AbortController` 中断复制/移动/压缩/解压/删除/离线下载/扫描等操作，中断后任务被移除。
- 任务不存在时也返回成功（幂等）。
- `X-Tem-ID` 请求头必填（非空），否则 400。

## POST /api/task/list

获取当前账号进行中的任务 key 列表。

**鉴权**：需要登录

**Body**

无参数。

**响应 data**

```json
["root_ab12cd34", "root_ef56gh78"]
```

**说明**

- 只返回 `state=0`（进行中）的任务，已完成任务在 30 秒后被定时清理，不出现在列表中。

---

# 音乐、壁纸与图床

本部分覆盖 4 个模块，路由挂载点如下：

| 模块 | 挂载路径 | 说明 |
| --- | --- | --- |
| 音乐 | `/api/player` | 歌单、歌曲、歌词、播放记录、分享、上传 |
| 壁纸 | `/api/bg` | 壁纸库、收藏、随机壁纸、上传 |
| 图床 | `/api/pic` | 图片上传与列表（需登录） |
| 网站图标 | `/api/icon` | 抓取并缓存站点 favicon |

本部分通用约定：

- 上传接口均为 `multipart/form-data`，文件字段名使用 `attrname`（服务端实际取第一个文件字段）。上传参数（`name`、`HASH`、`type`、`id`）放在 **query string** 中，不放在表单字段里。
- `HASH` 是文件内容的抽样哈希，服务端接收后会重新计算并比对，不一致时直接失败（HTTP 500，`codeText` 含 `hash error`）。
- 图片格式白名单：`.jpg` `.jpeg` `.png` `.gif` `.webp` `.avif` `.svg`；歌曲仅接受 `.mp3`；MV 仅接受 `.mp4`。
- 写操作成功后一般会通过长连接推送 `updatedata` 事件，`flag` 取值见各接口说明。

## 歌曲对象

下文多个接口返回的歌曲结构（`/api/player/random-list` 例外，见该接口说明）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 歌曲 id |
| title | string | 标题 |
| artist | string | 歌手 |
| album | string | 专辑 |
| year | string | 年份（可能为空字符串） |
| duration | number | 时长（秒） |
| pic | boolean | 是否有封面 |
| lrc | boolean | 是否有歌词 |
| url | boolean | 是否有音频文件 |
| mv | boolean | 是否有 MV |
| collect_count | number | 被收藏次数 |
| play_count | number | 播放次数 |
| create_at | number | 上传时间戳（毫秒） |
| num | number | 在所属列表中的序号（仅列表类接口返回） |

## 歌单对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 歌单 id。内置：`history` 播放历史、`favorites` 收藏、`all` 所有歌曲；其余为自建歌单 |
| name | string | 歌单名称 |
| des | string | 歌单描述 |
| pic | string | 封面标识：`history`、`default`，或作为封面的歌曲 id |
| len | number | 歌曲数量；`all` 被选中时为全库总数 |
| num | number | 在返回数组中的序号 |
| item | array | 歌曲对象数组。仅「收藏」歌单和当前选中歌单返回该字段 |
| total | number | 全库歌曲总数，仅 `all` 被选中时返回 |
| totalPage | number | 总页数，仅 `all` 被选中时返回 |
| pageNo | number | 当前页码，仅 `all` 被选中时返回 |

## POST /api/player/lrc

读取歌曲歌词，按时间轴解析为数组。

**鉴权**：公开；未登录时必须携带有效的音乐分享 `token`

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌曲 id，1~50 位字母数字下划线 |
| token | body | string | 否 | 音乐分享 token，默认空串，最大 2000 字符 |

**响应**：`data` 为歌词行数组，每项结构如下

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| t | number | 时间点，单位秒（取整） |
| p | string | 该时间点的原文 |
| fy | string | 翻译，同一时间标签的后续行；无翻译为空串 |

数组首项固定为 `{ "t": 0, "p": "", "fy": "" }`。

**说明**

- 未登录且未带 `token` 返回 `400`，`codeText` 为 `token 不能为空`。
- 分享 token 失效（过期 / 已取消 / 类型不符）时不报错，返回 `code=1`，首项 `p` 为失败原因。
- 分享 token 中不包含该歌曲，或歌曲没有歌词文件时，返回 `[{ "t": 0, "p": "未找到歌词", "fy": "" }]`。
- 携带 `token` 时会将该歌曲 `play_count` 加 1。
- 歌词文件读取、解析异常同样以兜底数组返回，不抛错。

## POST /api/player/song-info

获取单曲完整信息。

**鉴权**：公开；未登录时必须携带有效的音乐分享 `token`

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌曲 id，1~50 位字母数字下划线 |
| token | body | string | 否 | 音乐分享 token，默认空串，最大 2000 字符 |

**响应**：`data` 为歌曲对象（字段见上方「歌曲对象」，不含 `num`）

**说明**

- 未登录且未带 `token` 返回 `400`；分享 token 无效或分享中不含该歌曲分别返回 `403` / `404`。
- 歌曲不存在返回 `404 歌曲不存在`。

## POST /api/player/get-share

读取音乐分享，返回分享内的歌曲列表与访问 token。

**鉴权**：公开

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 分享 id，1~50 位字母数字下划线 |
| pass | body | string | 否 | 提取码，默认空串，最大 20 字符 |
| captchaId | body | string | 否 | 图形验证码凭证，默认空串，最大 50 位字母数字下划线 |

**响应**：成功时 `data` 结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| username | string | 分享者用户名（访问者与分享者为好友时显示好友备注） |
| logo | string | 分享者头像路径 |
| exp_time | number | 过期时间戳（毫秒），`0` 表示永久 |
| account | string | 分享者账号 |
| data | array | 歌曲对象数组；已删除的歌曲会被剔除 |
| title | string | 分享标题 |
| token | string | 分享访问 token，有效期 10 小时，用于 `/api/player/lrc`、`/api/player/song-info` 等公开接口 |

**说明**

- 需要图形验证码时返回 `code=1`，`data` 为 `{ "id": "<分享id>", "needCaptcha": true }`，`codeText` 提示完成验证。
- 提取码错误返回 `code=3`（HTTP 200），`data` 为 `null`，`codeText` 为 `提取码错误`；首次提交空提取码不计入错误次数。
- 分享不存在 / 已取消 / 已过期返回 `404`。
- 分享内歌曲全部被删除时返回 `404 歌曲不存在`。

## GET /api/player/search

按关键词搜索音乐库（标题、歌手）。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| word | query | string | 是 | 搜索词，1~100 字符 |
| pageNo | query | number | 否 | 页码，默认 `1`，最小 `1` |

**响应**：分页结构 + 分词结果

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 命中总数 |
| totalPage | number | 总页数（至少 1） |
| pageNo | number | 实际页码 |
| data | array | 歌曲对象数组 |
| splitWord | array | 分词结果字符串数组，首项为完整搜索词 |

**说明**：每页固定 100 条，无 `pageSize` 参数；搜索对标题和歌手做模糊匹配并按相关度排序。

## GET /api/player/list

获取歌单列表及指定歌单的歌曲。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | query | string | 否 | 歌单 id，默认空串；为空时选中「收藏」歌单。`all` 表示所有歌曲 |
| pageNo | query | number | 否 | 页码，默认 `1`，最小 `1` |
| pageSize | query | number | 否 | 每页条数，默认 `50`，范围 `1~200` |
| sort | query | string | 否 | 排序，默认 `default`；可选 `default`、`artist`、`title`、`playCount`、`collectCount` |
| playId | query | string | 否 | 歌曲 id，默认空串；指定后自动定位到该歌曲所在页 |
| onlyMv | query | number | 否 | `1` 只返回带 MV 的歌曲，默认 `0`；仅对 `all` 生效 |

**响应**：`data` 为歌单对象数组（字段见上方「歌单对象」）

**说明**

- 返回的是数组而非分页信封，分页字段只挂在 `all` 歌单上。
- 数组顺序：`history`、`favorites`、`all`，之后为自建歌单。
- 排序映射：`default` → `serial` 倒序（新上传在前）、`artist` / `title` → 拼音升序、`playCount` / `collectCount` → 对应计数倒序。
- `id=all` 且带 `playId` 时忽略 `onlyMv`。
- 当前选中歌单中已被删除的歌曲会自动清理并回写数据库（`all` 直接读全库，不受影响）。

## GET /api/player/export

导出歌单文件。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | query | string | 是 | 歌单 id，1~50 位字母数字下划线 |
| type | query | string | 否 | 导出格式，默认 `default`；可选 `default`（JSON 歌曲 id 数组）、`navidrome`（m3u 文本） |

**响应**：直接返回文件内容，不套 JSON 信封；`Content-Type: application/octet-stream`，`Content-Disposition: attachment`，文件名为 `<歌单名>.json` 或 `<歌单名>.m3u`

**说明**：`navidrome` 格式中每首歌的路径以占位目录 `<Navidrome MusicFolder>` 开头，导入 Navidrome 前需替换为实际音乐目录。歌单不存在返回 `404 歌单不存在`。

## POST /api/player/import

向歌单导入歌曲 id 列表。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 目标歌单 id，1~50 位字母数字下划线 |
| list | body | string[] | 是 | 歌曲 id 数组，`1~2000` 项，每项 1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `导入歌曲成功`

**说明**：与歌单现有歌曲合并去重，导入后总数超过 2000 首返回 `403 歌单限制2000首`；歌单不存在返回 `403`。会推送 `flag: music`。

## POST /api/player/last-play

保存最后播放位置与播放进度。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| history | body | number | 是 | `1` 计入播放历史并增加播放次数；`0` 只记录进度 |
| lastplay | body | object | 是 | 固定结构 `{ "id": "<歌曲id>" }`，id 为 1~50 位字母数字下划线 |
| currentTime | body | number | 是 | 当前播放位置（秒），最小 `0` |
| duration | body | number | 是 | 歌曲总时长（秒），最小 `0` |

**响应**：`data` 为 `null`

**说明**：`history=1` 时把歌曲插入「播放历史」首位（去重、最多 2000 首）并推送 `flag: music`；否则推送 `flag: musicinfo`。

## GET /api/player/last-play

读取最后播放歌曲与进度。

**鉴权**：需要登录

**响应**：`data` 结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| currentTime | number | 上次播放位置（秒），无记录为 `0` |
| duration | number | 歌曲时长（秒），无记录为 `0` |
| lastplay | object | 歌曲对象；无记录或歌曲已删除时为 `{}` |

## GET /api/player/random-list

随机获取一批歌曲用于随机播放。

**鉴权**：需要登录

**响应**：`data` 为歌曲记录数组，最多 2000 首，已随机打乱

**说明**

- 音乐库为空返回 `404 音乐库为空`。
- 该接口返回数据库原始记录（`pic` / `lrc` / `url` / `mv` 仍为字符串，不做布尔转换），与「歌曲对象」略有差异。

## POST /api/player/playlist

保存当前播放列表。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| data | body | string[] | 是 | 歌曲 id 数组，最多 `2000` 项，可为空数组（清空播放列表） |

**响应**：`data` 为 `null`，`codeText` 为 `更新播放列表成功`

**说明**：按账号覆盖保存，推送 `flag: playinglist`。

## GET /api/player/playlist

读取当前播放列表。

**鉴权**：需要登录

**响应**：`data` 为歌曲对象数组；已删除的歌曲会被自动跳过

## POST /api/player/move-list

调整自建歌单的排列顺序。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| fromId | body | string | 是 | 被移动的歌单 id，1~50 位字母数字下划线 |
| toId | body | string | 是 | 目标位置的歌单 id，1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `歌单移动位置成功`

**说明**：仅自建歌单（索引大于 1）之间有效，内置歌单或非法 id 时静默不处理。推送 `flag: music`。

## POST /api/player/delete-list

删除自建歌单。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌单 id，1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `删除歌单成功`

**说明**：内置歌单（`history`、`favorites`、`all`）无法删除，返回 `403 无权删除默认歌单`。推送 `flag: music`。

## POST /api/player/edit-list

编辑歌单名称、描述，可同时调整位置。

**鉴权**：需要登录；编辑内置歌单需要管理员

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌单 id，1~50 位字母数字下划线 |
| name | body | string | 是 | 歌单名称，1~200 字符 |
| des | body | string | 否 | 歌单描述，默认空串，最大 500 字符 |
| toId | body | string | 否 | 目标位置的歌单 id，默认空串，表示不移动 |

**响应**：`data` 为 `null`，`codeText` 为 `更新歌单信息成功`

**说明**

- 内置歌单（`history`、`favorites`、`all`）的名称和描述保存在全局配置中，只有管理员可改。
- 非自建歌单且非管理员时返回 `403 无权更新当前歌单信息`。
- 自建歌单修改成功后会推送 `flag: music`。

## POST /api/player/edit-song

编辑歌曲元数据，并写回音频文件的 ID3 标签。

**鉴权**：需要登录；仅管理员

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌曲 id，1~50 位字母数字下划线 |
| title | body | string | 是 | 标题，1~200 字符 |
| artist | body | string | 是 | 歌手，1~200 字符 |
| album | body | string | 是 | 专辑，1~200 字符 |
| year | body | string | 否 | 年份，默认空串，最大 10 字符 |
| duration | body | number | 是 | 时长（秒），最小 `0` |
| collect_count | body | number | 是 | 收藏次数，整数，最小 `0` |
| play_count | body | number | 是 | 播放次数，整数，最小 `0` |

**响应**：`data` 为 `null`，`codeText` 为 `更新歌曲信息成功`

**说明**

- 非管理员返回 `403 无权更新歌曲信息`；歌曲不存在返回 `403 歌曲不存在`。
- 标签写入失败只记录日志，数据库仍会更新；写文件成功后重新计算并更新 `hash`。
- 推送 `flag: music`。

## POST /api/player/add-list

新建自建歌单。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| name | body | string | 是 | 歌单名称，1~200 字符 |
| des | body | string | 否 | 歌单描述，默认空串，最大 500 字符 |

**响应**：`data` 为 `null`，`codeText` 为 `添加歌单成功`

**说明**：自建歌单最多 50 个，超出返回 `403 歌单限制50个`。歌单 id 由服务端生成。推送 `flag: music`。

## POST /api/player/move-song

调整歌曲在歌单内的顺序。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| fromId | body | string | 是 | 被移动歌曲的 id，1~50 位字母数字下划线 |
| toId | body | string | 是 | 目标位置歌曲的 id，1~50 位字母数字下划线 |
| listId | body | string | 是 | 所在歌单 id，1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `歌曲移动位置成功`

**说明**：歌单或歌曲不存在、位置相同时静默不处理。推送 `flag: music`。

## POST /api/player/collect-song

收藏歌曲（加入「收藏」歌单）。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| ids | body | string[] | 是 | 歌曲 id 数组，`1~200` 项，每项 1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `收藏歌曲成功`

**说明**：与收藏歌单去重合并，超过 2000 首返回 `403`；同时把对应歌曲 `collect_count` 加 1。推送 `flag: music`。

## POST /api/player/close-collect-song

取消收藏。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌曲 id，1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `移除收藏歌曲成功`

**说明**：只从收藏歌单移除，不回退 `collect_count`。推送 `flag: music`。

## POST /api/player/delete-song

从歌单移除歌曲，或从音乐库彻底删除歌曲。

**鉴权**：需要登录；`listId=all` 时仅管理员

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| listId | body | string | 是 | 歌单 id，`all` 表示从音乐库删除；1~50 位字母数字下划线 |
| ids | body | string[] | 是 | 歌曲 id 数组，`1~2000` 项；`listId=all` 时最多 200 项 |

**响应**：`data` 为 `null`；`listId=all` 时 `codeText` 为 `删除歌曲成功`，否则为 `移除歌曲成功`

**说明**

- `listId=all` 会删除数据库记录及歌曲所在目录（含封面、歌词、MV），非管理员返回 `403 无权删除歌曲`，`ids` 超过 200 个返回 `400`。
- 其他歌单只从该歌单中移除歌曲，不影响音乐库。
- 推送 `flag: music`。

## POST /api/player/song-to-list

把歌曲移动到 / 添加到另一个歌单。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| fromId | body | string | 是 | 来源歌单 id，1~50 位字母数字下划线 |
| toId | body | string | 是 | 目标歌单 id，1~50 位字母数字下划线 |
| ids | body | string[] | 是 | 歌曲 id 数组，`1~200` 项，每项 1~50 位字母数字下划线 |

**响应**：`data` 为 `null`；添加时为 `添加歌曲成功`，移动时为 `移动歌曲成功`

**说明**

- 从 `all` 或内置歌单 → 自建歌单：追加到目标歌单（`codeText` 为 `添加歌曲成功`）。
- 自建歌单 → 另一个自建歌单：先从来源移除，再加入目标（`codeText` 为 `移动歌曲成功`）。
- 其他组合返回 `403 无权操作`；目标歌单超过 2000 首返回 `403`。推送 `flag: music`。

## POST /api/player/delete-mv

删除歌曲的 MV 文件。

**鉴权**：需要登录；仅管理员

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌曲 id，1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `删除MV成功`

**说明**：删除磁盘上的 MV 文件并把 `songs.mv` 置空；非管理员返回 `403 无权操作`。推送 `flag: music`。

## GET /api/player/read-lrc

读取歌词原始文本。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | query | string | 是 | 歌曲 id，1~50 位字母数字下划线 |

**响应**：`data` 为歌词文件内容字符串；文件不存在时创建一个空歌词文件并返回空串

**说明**：歌曲不存在返回 `404 歌曲不存在`。

## POST /api/player/edit-lrc

保存歌词文本，同时写入音频文件的 ID3 歌词标签。

**鉴权**：需要登录；仅管理员

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| id | body | string | 是 | 歌曲 id，1~50 位字母数字下划线 |
| text | body | string | 否 | 歌词全文，默认空串；字节数不超过 20 KB |

**响应**：`data` 为 `null`，`codeText` 为 `更新歌词成功`

**说明**

- 非管理员返回 `403 无权操作`；歌曲不存在返回 `403 歌曲不存在`。
- 标签写入失败只记录日志，歌词文件仍会保存；写文件成功后重新计算并更新 `hash`。

## POST /api/player/share

创建音乐分享。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| title | body | string | 是 | 分享标题，1~200 字符 |
| expireTime | body | number | 是 | 有效期（天），整数，`≤ 99999`；`0` 表示永久 |
| pass | body | string | 否 | 提取码，默认空串，最大 20 字符 |
| list | body | string[] | 是 | 歌曲 id 数组，`1~2000` 项 |

**响应**：`data` 为 `{ "id": "<分享id>" }`

**说明**：`exp_time` 由服务端按「当前时间 + 天数」计算；推送 `flag: sharelist`。分享内容通过 `POST /api/player/get-share` 读取。

## POST /api/player/up

上传歌曲、歌曲封面或 MV。

**鉴权**：需要登录；上传封面 / MV 仅管理员

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| name | query | string | 是 | 原始文件名（会被净化），1~255 字符 |
| HASH | query | string | 否 | 文件抽样哈希，默认空串，最大 50 位字母数字下划线；`type=song` 时必填 |
| type | query | string | 是 | 上传类型：`song` 歌曲 / `cover` 封面 / `mv` MV |
| id | query | string | 否 | 歌曲 id，默认空串；`type=cover` / `type=mv` 时必填 |

**Multipart**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| attrname | file | 是 | 上传的文件。`song` 仅 `.mp3` 且 ≤ 50 MB；`cover` 为图片且 ≤ 5 MB；`mv` 仅 `.mp4` 且 ≤ 200 MB |

**响应**：`data` 为 `null`；`codeText` 分别为 `上传歌曲成功` / `上传封面成功` / `上传MV成功`

**说明**

- `type=song`：`HASH` 为空返回 `400`；非 `.mp3` 返回 `403 歌曲格式错误`；哈希已存在返回 `403 歌曲已存在`。服务端会读取 ID3 元数据（标题、歌手、专辑、年份、时长），并把内嵌封面、歌词分别写入歌曲目录，文件名按 `年/月/日/歌曲id` 组织。
- `type=cover`：非管理员返回 `403 无权上传封面`；非图片返回 `403 封面图片格式不支持`；写入 ID3 封面并更新 `pic`、`hash`，推送 `flag: music`。
- `type=mv`：非管理员返回 `403 无权上传MV`；非 `.mp4` 返回 `403 MV格式错误`。
- 上传超时时间为 10 分钟；哈希校验不通过时返回 HTTP 500，`codeText` 含 `hash error`。

## POST /api/player/repeat

上传前的重复校验（秒传）。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| HASH | body | string | 是 | 文件抽样哈希，1~50 位字母数字下划线 |

**响应**

| 场景 | code | data | 说明 |
| --- | --- | --- | --- |
| 记录存在且文件存在 | 1 | null | 可直接秒传，跳过上传 |
| 记录存在但文件丢失 | 3 | null | 服务端已删除失效记录与目录，需要重新上传 |
| 记录不存在 | 3 | null | 需要上传 |

## POST /api/player/save-share

把音乐分享保存为自己的歌单。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| name | body | string | 是 | 新歌单名称，1~200 字符 |
| token | body | string | 是 | 音乐分享 token，1~2000 字符 |

**响应**：`data` 为 `null`，`codeText` 为 `保存歌单成功`

**说明**：分享 token 无效返回 `403`；最多保存分享中的前 2000 首，不校验自建歌单数量上限。推送 `flag: music`。

## GET /api/bg/r/:type

获取随机一张壁纸，直接返回图片。

**鉴权**：公开；需开启公开接口开关 `randomBgApi`，已登录用户不受开关限制

**Path/Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| type | path | string | 是 | `d` 桌面壁纸（横图） / `m` 移动壁纸（竖图） |
| w | query | number | 否 | 期望缩略图宽度，默认 `0` 表示原图；实际宽度会归一为 256 / 512 / 1024 |

**响应**：直接返回图片二进制流

**说明**

- 开关关闭且未登录返回 `403 接口未开放`；壁纸库为空返回 `404 壁纸库为空`。
- 缩略图仅对图片生效，原图大于 20 MB 时返回 `403 获取缩略图失败(图片过大)`。
- 命中缓存时直接输出 webp 缩略图，响应头带 `X-File-Size`。

## GET /api/bg/random

从壁纸库随机取一条记录（只返回 id，不返回图片）。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| type | query | string | 是 | `bg` 横图 / `bgxs` 竖图 |

**响应**：`data` 为 `{ "id": "<壁纸id>", "type": "bg" }`

**说明**：壁纸库为空返回 `404 壁纸库为空，请先上传壁纸`。拿到 id 后可通过 `GET /api/f/bg/<id>` 取图（需登录）。

## POST /api/bg/change

更换当前账号使用的壁纸。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| type | body | string | 是 | `bg` 桌面壁纸 / `bgxs` 移动壁纸 |
| id | body | string | 是 | 壁纸 id，1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `更换壁纸成功`

**说明**：写入用户配置并清理用户信息缓存，推送 `flag: userinfo`。

## POST /api/bg/collect

收藏壁纸。

**鉴权**：需要登录

**Body**：JSON 数组，直接作为请求体

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| （整个 body） | body | string[] | 是 | 壁纸 id 数组，`1~100` 项，每项 1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `收藏壁纸成功`

**说明**：与已有收藏去重合并，超过 2000 个返回 `403 收藏壁纸限制2000个`。推送 `flag: bg`。

## GET /api/bg/list

获取壁纸列表或收藏列表。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| type | query | string | 是 | `bg` 横图 / `bgxs` 竖图 |
| collect | query | number | 否 | `1` 返回收藏的壁纸，默认 `0` 返回壁纸库 |
| pageNo | query | number | 否 | 页码，默认 `1`，最小 `1` |
| pageSize | query | number | 否 | 每页条数，默认 `40`，范围 `1~100` |

**响应**：分页结构

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 总条数 |
| totalPage | number | 总页数（至少 1） |
| pageNo | number | 实际页码 |
| data | array | 壁纸项数组 |

壁纸项：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 壁纸 id |
| type | string | `bg` / `bgxs` |
| isCollect | boolean | 仅 `collect=0` 且已收藏时返回 `true` |

**说明**

- `collect=0`：按 `serial` 倒序（新上传在前）。
- `collect=1`：仅返回 `type` 匹配的收藏项，按收藏时间倒序（最新收藏在前）；已被删除的壁纸会自动从收藏列表清理。

## POST /api/bg/delete

删除壁纸，或取消收藏。

**鉴权**：需要登录；`collect=0` 时仅管理员

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| ids | body | string[] | 是 | 壁纸 id 数组，`1~100` 项，每项 1~50 位字母数字下划线 |
| collect | body | number | 否 | `1` 表示仅取消收藏，默认 `0` 表示删除壁纸文件 |

**响应**：`data` 为 `null`；取消收藏时 `codeText` 为 `删除收藏壁纸成功`，删除壁纸时为 `删除壁纸成功`

**说明**

- `collect=1`：只从当前账号的收藏列表移除，不删除文件。
- `collect=0`：删除数据库记录及磁盘文件，非管理员返回 `403 无权操作`；不会修改用户当前正在使用的壁纸。
- 两种情况都会推送 `flag: bg`。

## POST /api/bg/up

上传壁纸。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| HASH | query | string | 是 | 文件抽样哈希，1~50 位字母数字下划线，同时作为文件名 |
| name | query | string | 是 | 原始文件名（会被净化），1~255 字符，必须是受支持的图片格式 |

**Multipart**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| attrname | file | 是 | 壁纸文件，大小 ≤ 20 MB，仅支持 jpg / jpeg / png / gif / webp / avif / svg |

**响应**：`data` 为 `null`，`codeText` 为 `上传壁纸成功`

**说明**

- 哈希已存在返回 `403 壁纸已存在`。
- 上传后读取图片尺寸自动分类：宽 < 高记为 `bgxs`（竖图），否则记为 `bg`（横图）。
- 图片解析失败返回 `403 图片格式错误`；文件按 `年/月/日` 目录存放。

## POST /api/bg/repeat

壁纸上传前的重复校验。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| HASH | body | string | 是 | 文件抽样哈希，1~50 位字母数字下划线 |

**响应**

| 场景 | code | data | 说明 |
| --- | --- | --- | --- |
| 记录存在且文件存在 | 1 | null | 可直接秒传 |
| 记录存在但文件丢失 | 3 | null | 服务端已删除失效记录，需要重新上传 |
| 记录不存在 | 3 | null | 需要上传 |

## POST /api/pic/up

上传图片到图床。

**鉴权**：需要登录

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| name | query | string | 是 | 原始文件名（会被净化），1~255 字符，必须是受支持的图片格式 |
| HASH | query | string | 是 | 文件抽样哈希，1~50 位字母数字下划线，同时作为文件名 |

**Multipart**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| attrname | file | 是 | 图片文件，大小 ≤ 10 MB，仅支持 jpg / jpeg / png / gif / webp / avif / svg |

**响应**：`data` 为 `{ "id": "<图片id>" }`，`codeText` 为 `上传图片成功`

**说明**：哈希已存在返回 `403 图片已存在`；图片解析失败返回 `403 图片格式错误`；文件按 `年/月/日` 目录存放。图片可通过 `GET /api/f/pic/<id>` 访问。

## POST /api/pic/repeat

图片上传前的重复校验。

**鉴权**：需要登录

**Body**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| HASH | body | string | 是 | 文件抽样哈希，1~50 位字母数字下划线 |

**响应**

| 场景 | code | data | 说明 |
| --- | --- | --- | --- |
| 记录存在且文件存在 | 1 | `{ "id": "<图片id>" }` | 可直接秒传 |
| 记录存在但文件丢失 | 3 | null | 服务端已删除失效记录，需要重新上传 |
| 记录不存在 | 3 | null | 需要上传 |

## GET /api/pic/list

获取图床图片列表。

**鉴权**：需要登录；仅管理员

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| pageNo | query | number | 否 | 页码，默认 `1`，最小 `1` |
| pageSize | query | number | 否 | 每页条数，默认 `40`，范围 `1~100` |

**响应**：分页结构，`data` 为 `{ "id": "<图片id>" }` 数组，按上传顺序倒序

**说明**：非管理员返回 `403 无权操作`。

## POST /api/pic/delete

删除图床图片。

**鉴权**：需要登录；仅管理员

**Body**：JSON 数组，直接作为请求体

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| （整个 body） | body | string[] | 是 | 图片 id 数组，`1~100` 项，每项 1~50 位字母数字下划线 |

**响应**：`data` 为 `null`，`codeText` 为 `删除图片成功`

**说明**：同时删除数据库记录和磁盘文件；非管理员返回 `403 无权操作`。

## GET /api/icon

抓取并返回指定网站的 favicon（PNG）。

**鉴权**：公开；需开启公开接口开关 `faviconApi`，已登录用户不受开关限制

**Query**

| 字段 | 位置 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- | --- |
| u | query | string | 是 | 网站地址或域名，2~2000 字符；不带协议时默认补 `https://` |

**响应**：直接返回 PNG 图片二进制流（统一转换为 200×200）

**说明**

- 只取 `u` 的域名部分（路径会被忽略），请求站点根地址的 HTML 头部；`<link rel="icon">`、`apple-touch-icon`、`mask-icon`、`fluid-icon` 会按类型和尺寸打分取最优，找不到时回退到 `/favicon.ico`。
- 首次请求抓取并缓存，之后按域名直接命中缓存文件；`.ico` 会自动转换为 PNG。
- 抓取失败会在缓存目录写入 `.miss` 标记，60 秒内重复请求直接返回 `403`，`codeText` 形如 `获取图标失败(miss)`。
- 非 HTML 响应、HTML 头部超过 300 KB、图标文件超过 500 KB 均视为失败；配置了 `faviconSpareApi` 时会改用备用接口（模板中的 `{host}` 会替换为 URL 编码后的域名）。
- 开关关闭且未登录返回 `403 接口未开放`；参数不合法返回 `400 url 格式错误`。

---

# 书签 /api/bmk

## POST /api/bmk/get-share

通过分享 id 获取书签分组分享。

**鉴权**：公开

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分享 id，长度 1–50，仅字母、数字、下划线 |
| pass | string | 否 | 提取码，默认空串，≤20 |
| captchaId | string | 否 | 验证码 id，默认空串，≤50，字母数字下划线；需要验证码时必传 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| username | string | 分享者用户名；非本人分享且好友有备注时返回备注 |
| logo | string | 分享者头像 |
| exp_time | number | 过期时间戳，0 表示永久 |
| account | string | 分享者账号 |
| data | array | 分享的书签快照，元素 `{ title, link, des }` |
| title | string | 分享标题 |
| token | string | 分享访问令牌（JWT，有效期 10 小时），用于 `/api/bmk/save-share` |

**说明**：
- 分享不存在、已取消、已过期返回 404（code=0）。
- 未通过验证码校验时返回 code=1，data 为 `{ id, needCaptcha: true }`，需带 `captchaId` 重试。
- 提取码错误返回 code=3（HTTP 200），data 为 null。
- 同一分享首次进入（空提取码）不计入提取码错误次数。

## POST /api/bmk/search

搜索书签（跨分组分页检索）。

**鉴权**：公开（需传 `account`；既未传 `account` 又未登录时返回 401）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| word | string | 否 | 搜索词，默认空串，≤100；为空时按创建序号倒序 |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 20，1–200 |
| account | string | 否 | 目标账号，默认空串，≤50 字母数字；为空时使用当前登录账号 |
| category | string[] | 否 | 分组 id 过滤数组，默认 `[]`，最多 10 个，元素 1–50 字母数字 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 匹配总数 |
| totalPage | number | 总页数，至少 1 |
| pageNo | number | 规范化后的页码 |
| splitWord | string[] | 分词结果，首项为原搜索词 |
| data | array | 书签列表，元素 `{ group_title, id, group_id, title, link, des, logo }`；分组名缺失时 `group_title` 为「未知分组」 |

**说明**：仅返回未删除且所属分组存在、未删除的书签；查询他人书签时只返回 `share=1` 的公开分组内容。`word` 命中标题、链接、描述，首个分词权重更高。

## GET /api/bmk/list

获取分组列表，或指定分组的书签明细。

**鉴权**：公开（需传 `account`；既未传 `account` 又未登录时返回 401）

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 否 | 分组 id，默认空串，≤50 字母数字；传 `home` 表示主页书签 |
| account | string | 否 | 目标账号，默认空串，≤50 字母数字；为空时使用当前登录账号 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| list | array | 分组列表，元素 `{ id, title }`；所有者额外含 `share`（0 锁定 / 1 公开）；已传 `id` 且已登录时额外含 `num`（排序号），命中的分组还含 `item`（书签数组） |
| home | array | `id=home` 且为所有者时的主页书签，元素 `{ id, title, link, logo, des, group_id, num }`；其他情况为 `[]` |

**说明**：
- 未登录：只返回目标账号的公开分组（`share=1`），且不返回 `home` / 书签明细。
- 非所有者：只能读取公开分组的书签；`home` 分组仅所有者可见。
- 未传 `id` 或未登录时提前返回，`list` 不带 `num`。

## POST /api/bmk/move-group

调整分组排序位置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| fromId | string | 是 | 被移动的分组 id，1–50 字母数字 |
| toId | string | 是 | 目标位置的分组 id，1–50 字母数字 |

**响应 data**：无

**说明**：`fromId` 与 `toId` 相同或 id 不存在时不发生变更，仍返回成功。

## POST /api/bmk/move-bmk

调整分组内书签排序位置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 分组 id，1–50 字母数字 |
| fromId | string | 是 | 被移动的书签 id，1–50 字母数字 |
| toId | string | 是 | 目标位置的书签 id，1–50 字母数字 |

**响应 data**：无

## POST /api/bmk/add-group

新建书签分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分组标题，1–200 |

**响应 data**：无

**说明**：分组数量上限 200（`fieldLength.bmkGroup`），超出返回 403。

## POST /api/bmk/delete-group

删除分组（移入回收站）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 分组 id 数组，1–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：仅将分组 `state` 置 0，不级联删除分组内书签。

## POST /api/bmk/group-share-state

批量设置分组公开 / 锁定状态。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| share | number | 是 | 状态，枚举 `0` 锁定 / `1` 公开 |
| ids | string[] | 是 | 分组 id 数组，1–200 个，元素 1–50 字母数字 |

**响应 data**：无

## POST /api/bmk/delete-logo

清除书签自定义 LOGO。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 书签 id，1–50 字母数字 |

**响应 data**：无

**说明**：仅把该用户的对应书签 `logo` 置空，不校验书签是否存在。

## POST /api/bmk/edit-group

编辑分组标题，可选同时调整排序位置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分组 id，1–50 字母数字 |
| title | string | 是 | 新标题，1–200 |
| toId | string | 否 | 目标位置的分组 id，默认空串，≤50 字母数字；非空时移动到该位置 |

**响应 data**：无

## POST /api/bmk/add-bmk

批量添加书签。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 目标分组 id，1–50 字母数字；可为 `home` |
| bms | array | 是 | 书签数组，1–200 个 |
| bms[].title | string | 是 | 书签标题，1–200 |
| bms[].link | string | 是 | 链接，1–2000，必须为 http/https URL |
| bms[].des | string | 否 | 描述，默认空串，≤500 |

**响应 data**：无

**说明**：`groupId` 非 `home` 时必须存在，否则 400；单个分组书签上限 300（`fieldLength.bmk`），超出返回 403。

## POST /api/bmk/edit-bmk

编辑书签信息，可选同时移动到其他分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 书签当前所属分组 id，1–50 字母数字 |
| id | string | 是 | 书签 id，1–50 字母数字 |
| toId | string | 否 | 目标分组 id，默认空串，≤50 字母数字；非空时移动到该分组 |
| title | string | 是 | 标题，1–200 |
| link | string | 是 | 链接，1–2000，必须为 http/https URL |
| des | string | 否 | 描述，默认空串，≤500 |

**响应 data**：无

## POST /api/bmk/bmk-to-group

批量将书签移动到指定分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 是 | 目标分组 id，1–50 字母数字；可为 `home` |
| ids | string[] | 是 | 书签 id 数组，1–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：目标分组必须存在（`home` 除外）；移动后目标分组书签数不得超过 300。

## POST /api/bmk/delete-bmk

删除书签（移入回收站）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 书签 id 数组，0–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：`ids` 为空数组时清空当前用户全部书签；否则按 id 删除（`state` 置 0）。

## POST /api/bmk/share

分享一个分组内的书签。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分组 id，1–50 字母数字 |
| title | string | 是 | 分享标题，1–200 |
| expireTime | number | 是 | 过期天数，≤99999；`0` 表示永久 |
| pass | string | 否 | 提取码，默认空串，≤20 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 新生成的分享 id |

**说明**：分组内无书签时返回 403「当前分组为空」；快照仅保存书签的 `title`、`link`、`des`。

## POST /api/bmk/save-share

把他人分享的书签保存为自己的分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 新分组标题，1–200 |
| token | string | 是 | `/api/bmk/get-share` 返回的分享令牌，1–2000 |

**响应 data**：无

**说明**：令牌过期、失效或分享已取消 / 过期返回 403；分组数量达 200 上限返回 403。

## POST /api/bmk/import

批量导入书签（按分组）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| list | array | 是 | 分组数组，1–200 个 |
| list[].title | string | 是 | 分组标题，1–200 |
| list[].list | array | 是 | 该分组的书签数组，1–300 个 |
| list[].list[].title | string | 是 | 书签标题，1–200 |
| list[].list[].link | string | 是 | 链接，1–2000，必须为 http/https URL |
| list[].list[].des | string | 否 | 描述，默认空串，≤500 |

**响应 data**：无

**说明**：导入后分组总数不得超过 200，超出返回 403；导入不覆盖原有分组，均为新建。

## GET /api/bmk/export

导出全部书签。

**鉴权**：需要登录

**响应 data**：分组数组，元素 `{ title, children: [{ title, link, des }] }`，首项固定为 `{ title: '主页', ... }`（`home` 分组）。

# 笔记 /api/note

## GET /api/note/read

读取笔记内容。

**鉴权**：公开（未公开的笔记仅作者可读）

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| v | string | 是 | 笔记 id，1–50 字母数字 |
| download | number | 否 | 是否下载，默认 0；`0` 返回 JSON，`1` 直接返回 Markdown 文件 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| username | string | 作者用户名；非本人且有好友备注时返回备注 |
| title | string | 笔记标题 |
| content | string | Markdown 原文 |
| visit_count | number | 阅读量（本次自增前的值） |
| account | string | 作者账号 |
| create_at | number | 创建时间戳 |
| update_at | number | 更新时间戳 |
| logo | string | 作者头像 |
| category | string | 分类 id 串，多个以 `-` 连接 |
| editing | string \| null | 编辑草稿内容；仅作者本人有值，其他情况为 null |

**说明**：笔记不存在返回 404；未公开且非作者返回 403「笔记未公开」；每次读取会把 `visit_count` 加 1。`download=1` 时返回 `text/markdown` 附件（文件名为「标题.md」），不带 `{ code, codeText, data }` 信封。

## POST /api/note/search

搜索笔记列表。

**鉴权**：公开（需传 `account`；既未传 `account` 又未登录时返回 401）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 否 | 目标账号，默认空串，≤50 字母数字；为空时使用当前登录账号 |
| word | string | 否 | 搜索词，默认空串，≤100；为空时按置顶权重、创建时间倒序 |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 20，1–200 |
| category | string[] | 否 | 分类 id 过滤，默认 `[]`，最多 10 个，元素 1–50 字母数字；特殊值 `locked` 表示仅未公开笔记（仅本人有效） |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 匹配总数 |
| totalPage | number | 总页数，至少 1 |
| pageNo | number | 规范化后的页码 |
| splitWord | string[] | 分词结果，首项为原搜索词 |
| data | array | 笔记列表 |

`data` 元素：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 笔记 id |
| title | string | 标题 |
| share | number | 0 未公开 / 1 公开 |
| visit_count | number | 阅读量 |
| top | number | 置顶权重 |
| category | string | 分类 id 串（`-` 连接） |
| categoryArr | array | 命中的分类对象 `{ id, title }` |
| create_at | number | 创建时间戳 |
| update_at | number | 更新时间戳 |
| con | array | 正文摘要片段，元素 `{ type: 'text' \| 'word' \| 'icon', value }`；命中词为 `word`，截断标记为 `icon` |
| images | array | 正文前 6 张图片 `{ src, alt }` |

**说明**：查询他人笔记时只返回 `share=1` 且未删除的记录；未传 `word` 时按 `top` 降序、`create_at` 降序。

## GET /api/note/category

获取笔记分类列表。

**鉴权**：公开

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 否 | 目标账号，默认空串，≤50 字母数字；为空时使用当前登录账号 |

**响应 data**：分类数组，元素 `{ id, title }`，按 `serial` 倒序。未登录且未传 `account` 时返回空数组，不报 401。

## POST /api/note/history-state

开启 / 关闭笔记历史版本记录。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| state | number | 否 | 状态，默认 0，枚举 `0` 关闭 / `1` 开启 |

**响应 data**：无

**说明**：开启后每次编辑会保存旧内容的历史版本文件。

## GET /api/note/history-state

查询笔记历史记录开关。

**鉴权**：需要登录

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| note_history | number | 0 关闭 / 1 开启 |

## POST /api/note/state

批量设置笔记公开 / 锁定。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| share | number | 否 | 状态，默认 0，枚举 `0` 锁定 / `1` 公开 |
| ids | string[] | 是 | 笔记 id 数组，1–200 个，元素 1–50 字母数字 |

**响应 data**：无

## POST /api/note/delete

删除笔记（移入回收站）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 笔记 id 数组，0–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：`ids` 为空数组时清空全部笔记；「关于」「Tips」两个内置笔记（`aboutid`、`tipsid`）不会被删除。

## POST /api/note/up-note

新建笔记。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 标题，1–200 |
| content | string | 否 | Markdown 内容，默认空串，≤102400 字节（100KB） |

**响应 data**：无

**说明**：仅接收 JSON body，不是 multipart 上传；大小限制按字节计算。

## POST /api/note/edit

保存笔记（存在则更新，不存在则新建）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 笔记 id，1–50 字母数字；新建时可用 `new` 作为占位（会另行生成真实 id） |
| title | string | 是 | 标题，1–200 |
| content | string | 否 | Markdown 内容，默认空串，≤102400 字节（100KB） |

**响应 data**：

| 场景 | data |
| --- | --- |
| 更新已有笔记 | 无（null） |
| id 不存在而新建 | `{ id }`，新建笔记的 id |

**说明**：开启笔记历史时会把旧内容另存为历史版本；保存成功后会清除该 id 对应的编辑草稿。

## GET /api/note/editing

读取笔记编辑草稿。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 笔记 id，1–50 字母数字；新笔记可用 `new` |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| editing | string \| null | 草稿内容，不存在为 null |

## POST /api/note/editing

保存或清除笔记编辑草稿。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 笔记 id，1–50 字母数字；新笔记用 `new` 占位（不校验笔记存在） |
| content | string | 否 | 草稿内容，默认空串，≤102400 字节（100KB） |
| clear | number | 否 | 默认 0；`0` 保存草稿，`1` 清除草稿（此时忽略 content） |

**响应 data**：无

**说明**：`id` 不是 `new` 且笔记不属于当前用户时返回 404「笔记不存在」。

## POST /api/note/edit-info

编辑笔记的标题、创建 / 更新时间与阅读量。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 笔记 id，1–50 字母数字 |
| title | string | 是 | 标题，1–200 |
| create_at | string | 是 | 创建日期，格式 `YYYY-MM-DD` |
| update_at | string | 是 | 更新日期，格式 `YYYY-MM-DD` |
| visit_count | number | 是 | 阅读量，≥0 |

**响应 data**：无

**说明**：日期按本地时区 `00:00:00` 转为时间戳；`create_at` 大于 `update_at` 时返回 400。

## POST /api/note/top

设置笔记置顶权重。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 笔记 id，1–50 字母数字 |
| top | number | 是 | 权重，0–99999，越大越靠前 |

**响应 data**：无

## POST /api/note/set-category

设置笔记所属分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 笔记 id，1–50 字母数字 |
| category | string[] | 否 | 分类 id 数组，默认 `[]`，最多 10 个，元素 1–50 字母数字；空数组表示清空分类 |

**响应 data**：无

**说明**：多个分类以 `-` 连接后存入笔记的 `category` 字段。

## POST /api/note/edit-category

重命名笔记分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分类标题，1–30 |
| id | string | 是 | 分类 id，1–50 字母数字 |

**响应 data**：无

## POST /api/note/add-category

新增笔记分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分类标题，1–30 |

**响应 data**：无

**说明**：分类数量上限 200（`fieldLength.maxNoteCategory`），超出返回 403；计数为分类表全表总数。

## POST /api/note/delete-category

删除笔记分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分类 id，1–50 字母数字 |

**响应 data**：无

**说明**：物理删除分类记录，不会改动已使用该分类的笔记上的 `category` 字段。

# 待办 /api/todo

## GET /api/todo/list

分页获取待办列表。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 40，1–200 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 待办总数 |
| totalPage | number | 总页数，至少 1 |
| pageNo | number | 规范化后的页码 |
| data | array | 待办列表，元素 `{ id, content, state, update_at }` |
| undoneCount | number | 未完成数量（`state=1`）；总数为 0 时为 0 |

**说明**：排序为 `state` 降序、`update_at` 降序，未完成在前；`state` 取值为 `1` 未完成、`0` 已完成。

## POST /api/todo/add

添加待办。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| content | string | 是 | 待办内容，1–500 |

**响应 data**：无

**说明**：新增记录会同步写入聊天数据备份。

## POST /api/todo/delete

删除待办。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 待办 id 数组，0–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：`ids` 为空数组时清空当前用户全部待办；否则按 id 物理删除。

## POST /api/todo/state

批量修改待办完成状态。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 待办 id 数组，1–200 个，元素 1–50 字母数字 |
| state | number | 是 | 枚举 `1` 未完成 / `0` 已完成 |

**响应 data**：无

**说明**：同时刷新 `update_at`。

## POST /api/todo/edit

编辑待办内容。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 待办 id，1–50 字母数字 |
| content | string | 是 | 新内容，1–500 |

**响应 data**：无

# 倒计时 /api/count

## GET /api/count/list

分页获取倒计时列表。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 40，1–200 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 倒计时总数 |
| totalPage | number | 总页数，至少 1 |
| pageNo | number | 规范化后的页码 |
| data | array | 倒计时列表 |
| expireCount | number | 已到期或 2 天内到期的数量（`state=1` 且 `end` 小于当前时间 + 2 天） |

`data` 元素：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 倒计时 id |
| title | string | 标题 |
| link | string | 关联链接，可为空串 |
| start | number | 开始时间戳 |
| end | number | 结束时间戳 |
| state | number | 0 停用 / 1 启用 |
| top | number | 置顶权重 |
| total | number | 起止总时长（毫秒） |
| past | number | 已过去时长（毫秒），开始前为负值 |
| remain | number | 剩余时长（毫秒） |
| percent | number | 进度百分比（`parseInt(past / total * 100)`），未做 0–100 截断，可能为负或大于 100 |

**说明**：排序为 `top` 降序、`end` 升序。

## POST /api/count/add

添加倒计时。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 标题，1–200 |
| start | string | 是 | 开始日期，格式 `YYYY-MM-DD` |
| end | string | 是 | 结束日期，格式 `YYYY-MM-DD` |
| link | string | 否 | 关联链接，默认空串，≤2000，必须为 http/https URL |

**响应 data**：无

**说明**：日期按本地时区 `00:00:00` 转时间戳；`start` 必须小于 `end`，否则返回 400。新增记录会同步写入聊天数据备份。

## POST /api/count/delete

删除倒计时。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 倒计时 id 数组，0–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：`ids` 为空数组时清空当前用户全部倒计时；否则按 id 物理删除。

## POST /api/count/edit

编辑倒计时。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 倒计时 id，1–50 字母数字 |
| title | string | 是 | 标题，1–200 |
| start | string | 是 | 开始日期，格式 `YYYY-MM-DD` |
| end | string | 是 | 结束日期，格式 `YYYY-MM-DD` |
| link | string | 否 | 关联链接，默认空串，≤2000，必须为 http/https URL |

**响应 data**：无

**说明**：`start` 必须小于 `end`，否则返回 400。

## POST /api/count/top

设置倒计时置顶权重。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 倒计时 id，1–50 字母数字 |
| top | number | 是 | 权重，0–99999，越大越靠前 |

**响应 data**：无

## POST /api/count/state

批量修改倒计时启用状态。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 倒计时 id 数组，1–200 个，元素 1–50 字母数字 |
| state | number | 是 | 枚举 `0` 停用 / `1` 启用 |

**响应 data**：无

**说明**：`state=1` 的记录才会被计入到期通知与 `expireCount`。

# 搜索 /api/search

## GET /api/search/config

读取当前用户的搜索引擎与翻译接口配置。

**鉴权**：需要登录

**响应 data**：配置文件原文解析结果，常见结构：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| searchEngineData | array | 搜索引擎列表，元素 `{ id, title, color, link, logo }` |
| translatorData | array | 翻译接口列表，元素 `{ id, title, link, logo }` |
| searchengineid | string | 当前选中的搜索引擎 id |
| translatorid | string | 当前选中的翻译接口 id（切换接口时写入） |
| searchWordIdx | number | 当前搜索提示词下标 |

**说明**：配置以 `config.json` 形式按账号存储；文件不存在时返回 `{}`，未列出的字段原样保留。

## POST /api/search/add-engine

添加搜索引擎。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 名称，1–200 |
| link | string | 是 | 搜索地址，1–2000，http/https，且必须包含 `{{}}` 占位符 |
| color | string | 否 | 主题色，默认空串，需为 `#RRGGBB` 格式（空串放行） |

**响应 data**：无

**说明**：搜索引擎上限 100（`fieldLength.searchEngineLength`），超出返回 403。

## POST /api/search/edit-engine

编辑搜索引擎。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 名称，1–200 |
| link | string | 是 | 搜索地址，1–2000，http/https，且必须包含 `{{}}` |
| color | string | 否 | 主题色，默认空串；校验要求 `#RRGGBB` 格式，因此实际需传合法颜色值 |
| id | string | 是 | 搜索引擎 id，1–50 字母数字 |

**响应 data**：无

**说明**：`id` 不存在时不改动配置，仍返回成功。LOGO 不在本接口修改范围。

## POST /api/search/delete-engine

删除搜索引擎。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 搜索引擎 id，1–50 字母数字 |

**响应 data**：无

## POST /api/search/change-engine

切换当前搜索引擎。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 搜索引擎 id，1–50 字母数字，写入 `searchengineid` |

**响应 data**：无

## POST /api/search/change-search-word

切换搜索框提示词。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| idx | number | 是 | 提示词下标，0–100 |

**响应 data**：无

## POST /api/search/delete-engine-logo

清除搜索引擎自定义 LOGO。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 搜索引擎 id，1–50 字母数字 |

**响应 data**：无

## POST /api/search/add-translator

添加翻译接口。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 名称，1–200 |
| link | string | 是 | 翻译地址，1–2000，http/https，且必须包含 `{{}}` 占位符 |

**响应 data**：无

**说明**：翻译接口上限 100，超出返回 403。

## POST /api/search/edit-translator

编辑翻译接口。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 名称，1–200 |
| link | string | 是 | 翻译地址，1–2000，http/https，且必须包含 `{{}}` |
| id | string | 是 | 翻译接口 id，1–50 字母数字 |

**响应 data**：无

## POST /api/search/delete-translator

删除翻译接口。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 翻译接口 id，1–50 字母数字 |

**响应 data**：无

## POST /api/search/change-translator

切换当前翻译接口。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 翻译接口 id，1–50 字母数字，写入 `translatorid` |

**响应 data**：无

## POST /api/search/delete-translator-logo

清除翻译接口自定义 LOGO。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 翻译接口 id，1–50 字母数字 |

**响应 data**：无

## GET /api/search/split-word

对文本分词。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| word | string | 是 | 待分词文本，1–100 |

**响应 data**：字符串数组，首项为原文本，后续为分词结果（已去重）。

## GET /api/search/history-list

分页获取搜索历史。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| word | string | 否 | 搜索词，默认空串，≤100；为空时按序号倒序 |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 80，1–200 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| total | number | 匹配总数 |
| totalPage | number | 总页数，至少 1 |
| pageNo | number | 规范化后的页码 |
| splitWord | string[] | 分词结果，首项为原搜索词 |
| data | array | 历史记录，元素 `{ id, content }` |

## POST /api/search/save

保存一条搜索历史。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| content | string | 是 | 搜索内容，1–200 |

**响应 data**：无

**说明**：先删除同账号下的相同内容再插入，实现去重并把该记录排到最前。

## GET /api/search/list

综合搜索历史、笔记、书签。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| word | string | 否 | 搜索词，默认空串，≤100 |

**响应 data**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| list | array | 结果列表，按下文 `sNum` 降序 |
| splitWord | string[] | 分词结果；`word` 为空时返回 `[]` |

`list` 元素按类型区分：

| 类型 `type` | 字段 |
| --- | --- |
| `ss`（搜索历史） | `id`、`content`、`sNum` |
| `note`（笔记） | `id`、`title`、`sNum` |
| `bmk`（书签） | `id`、`title`、`link`、`des`、`group_title`、`sNum` |

**说明**：`word` 为空时直接返回最近 10 条搜索历史（全部 `type: 'ss'`，无 `sNum`）；有关键词时分别检索历史（最多 100 条）、书签（最多 100 条）、笔记标题（最多 100 条），`sNum` 为命中分词数（首词命中计 10）。

## POST /api/search/delete

删除搜索历史（移入回收站）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 历史记录 id 数组，0–200 个，元素 1–50 字母数字 |

**响应 data**：无

**说明**：`ids` 为空数组时清空全部搜索历史；删除为软删除（`state` 置 0）。

---

# 聊天 /api/chat

聊天模块挂载于 `/api/chat`，路由文件 `server/src/routes/chat/index.js`。整个路由在入口处统一校验登录态，因此**全部接口都需要登录**。

实时消息不通过接口返回，而是经长轮询通道下发：请求头 `x-tem-id`（字母数字，≤50）标识当前设备，`GET /api/user/real-time` 拉取推送，`POST /api/user/real-time` 上报指令。`x-tem-id` 在登录后会被服务端改写为「account + temid」，用于只把推送投递给本人。

消息文件保存在上传目录，由定时清理任务按 `cacheExp.uploadSaveDay` 天回收；转发消息、复用已存在文件时会刷新 `update_at`，从而延长文件寿命。

---

## POST /api/chat/dnd-mode

设置某个好友的免打扰标记（路由注释为「勿扰」）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 对方 account，字母数字，1–50，不能是自己 |
| notify | number | 否 | 1=接收通知（默认），0=免打扰；仅允许 0/1 |

说明：若双方还不是好友，会先自动建立好友关系再写入 `notify`。提示文案按 `notify` 值输出「开启/关闭免打扰」。

**响应 data**

```json
null
```

---

## POST /api/chat/setdes

设置好友备注。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 对方 account，字母数字，1–50，不能是自己，也不能是聊天室/助手账号 |
| des | string | 否 | 备注，默认空串，≤20 字符 |

说明：非好友关系会自动建立；备注只对当前账号生效。

**响应 data**

```json
null
```

---

## GET /api/chat/getdes

获取好友备注、在线状态与登录设备。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 对方 account，字母数字，1–50 |

说明：`account` 为聊天室、助手、自己时返回预置文案；其他用户若 `hide=1` 或 `update_at` 距今 ≥30 秒，`online` 为 `false`。`os` 为对方当前在线设备的系统标识数组。

**响应 data**

```json
{
  "username": "小明",
  "des": "同事",
  "online": true,
  "os": ["Windows (Chrome)"],
  "notify": 1
}
```

---

## GET /api/chat/draft

读取与指定好友的聊天草稿。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 对方 account，字母数字，1–50 |

**响应 data**

```json
{ "draft": "还没写完的内容" }
```

---

## POST /api/chat/draft

保存聊天草稿。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 对方 account，字母数字，1–50 |
| draft | string | 否 | 草稿内容，默认空串，≤3000 字符 |

**响应 data**

```json
null
```

---

## GET /api/chat/read-msg

读取聊天记录（分页/游标），并把该会话标记为已读。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| account | string | 是 | 对方 account；聊天室账号表示群聊 |
| type | number | 是 | 0=打开会话/取最新；1=向上取更早（serial 小于游标）；2=向下取更新（serial 大于游标） |
| flag | string | 否 | 游标消息 id，默认空串，≤50，字母数字 |
| word | string | 否 | 关键词搜索（最多取前 10 个分词，匹配用户名与消息内容），默认空串，≤100 |
| start | string | 否 | 起始日期 `YYYY-MM-DD`，默认空串；与 `end` 同时存在才生效 |
| end | string | 否 | 结束日期 `YYYY-MM-DD`（不含当天 00:00），默认空串 |

说明：单页固定返回 `chatPageSize = 50` 条，按 `serial` 升序排列；`type=0` 或无有效游标时取最新 50 条。读取即调用 `markAsRead`，同时把双方关系补建为好友。`des` 是当前账号给发送者设置的备注。

**响应 data**

```json
[
  {
    "logo": "logo/xxx.png",
    "username": "小明",
    "_from": "xiaoming",
    "_to": "me",
    "id": "msgId",
    "create_at": 1730000000000,
    "content": "你好",
    "hash": "",
    "size": 0,
    "type": "text",
    "des": "同事"
  }
]
```

---

## GET /api/chat/expired

检查聊天文件是否仍有效（是否已被清理）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| hash | string | 是 | 文件 id（即上传时使用的 HASH），字母数字，1–50 |

说明：文件存在时返回 `code=1` 与 `{ isText }`（是否文本文件）；上传记录或磁盘文件已不存在时返回 `code=3`（无新数据），`data` 为 `null`，前端据此展示「文件已过期」。

**响应 data**

```json
{ "isText": false }
```

---

## POST /api/chat/send-msg

发送文本消息。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| to | string | 是 | 接收方 account，字母数字，1–50；可为聊天室账号或助手账号 |
| content | string | 是 | 消息内容，1–3000 字符，首尾空格会被去除 |

说明：普通用户需存在且 `state=1`，否则返回 403。消息写入 `chat` 表后通过 `x-tem-id` 长轮询推送给收发双方在线终端（含未读、最后消息、好友关系补建）。发给助手账号时会触发助手逻辑（回复 `start` / `stop` / `update` 可开关或重置收信接口）。若对方配置了自定义转发地址，会异步转发。

**响应 data**

```json
null
```

---

## POST /api/chat/forward

转发一条已有消息（文本/图片/文件/语音）给其他会话。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| to | string | 是 | 目标 account，字母数字，1–50 |
| id | string | 是 | 被转发消息 id，字母数字，1–50 |

说明：只能转发群消息、自己发送或自己接收的消息（`flag` 包含当前账号），否则 403。转发文件消息时会刷新对应上传记录的 `update_at`，避免被过期清理。发给助手账号同样会触发助手回复。

**响应 data**

```json
null
```

---

## GET /api/chat/news

获取未读消息统计，或一键全部标为已读。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| clear | number | 否 | 0=查询（默认），1=把所有会话标记已读 |

说明：`clear=1` 时直接返回成功且无 `data`；查询时 `group` 为聊天室未读数，`friend` 为私聊未读会话数。

**响应 data**

```json
{ "group": 2, "friend": 5 }
```

---

## POST /api/chat/delete-msg

撤回单条消息，或清空整个会话。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 否 | 要撤回的消息 id，默认空串（≤50，字母数字）。为空表示清空会话 |
| to | string | 是 | 会话对方 account，字母数字，1–50 |

说明：撤回只删除 `_from` 为当前账号的消息，并推送 `del` 通知；清空私聊会删除双方会话全部消息并推送 `clear`。聊天室清空仅管理员（root）可执行。目标用户不存在时返回 403。

**响应 data**

```json
null
```

---

## POST /api/chat/shake-msg

抖动对方窗口（仅在线用户）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| to | string | 是 | 对方 account，字母数字，1–50；不能是聊天室/助手账号，也不能是自己 |

说明：对方需存在、`hide=0` 且 30 秒内有心跳，否则返回 403「对方已离线」。只向对方推送，不回推给自己。

**响应 data**

```json
null
```

---

## GET /api/chat/user-list

成员（好友/用户）列表，带最后一条消息、未读、在线设备。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 10，1–100 |
| word | string | 否 | 按用户名/账号/邮箱精确过滤，默认空串，≤100 |

说明：只列出 `state=1` 的用户；`account` 为自己的记录备注固定为「自己」，助手账号固定为助手名称。`online=0` 表示对方隐身或 30 秒无心跳。

**响应 data**

```json
{
  "total": 12,
  "totalPage": 2,
  "pageNo": 1,
  "data": [
    {
      "username": "小明",
      "account": "xiaoming",
      "logo": "logo/xiaoming.png",
      "online": 1,
      "des": "同事",
      "os": ["Windows (Chrome)"],
      "read": 1,
      "msg": "您：你好",
      "draft": ""
    }
  ]
}
```

---

## POST /api/chat/up

上传聊天文件的一个分片（multipart，边收边存）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 分片名，必须匹配 `^_[0-9]+$`（如 `_1`），长度 1–20 |
| HASH | string | 是 | 整个文件的 SHA 采样值，字母数字，1–50 |

**Body**：`multipart/form-data`，字段名任意，只处理第一个文件；单请求上限 `maxFileChunk = 50MB`，请求超时 10 分钟。

说明：分片落在临时目录 `<account>_<HASH>` 下，文件名即 `name`。上传完成后调用 `POST /api/chat/merge` 合并；合并时会校验整体 HASH。断点续传先用 `POST /api/chat/breakpoint` 询问已传分片。

**响应 data**

```json
null
```

---

## POST /api/chat/up-voice

上传并发送语音消息。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 文件名，必须以 `.wav` 结尾，≤255 |
| HASH | string | 是 | 文件 hash，字母数字，1–50；已存在则拒绝发送 |
| to | string | 是 | 接收方 account，字母数字，1–50 |

**Body**：`multipart/form-data`，字段名任意；单文件上限 `maxVoiceSize = 3MB`。

说明：文件写入上传目录，服务端读取音频时长作为 `size`（秒），随即生成 `voice` 类型消息并推送；HASH 校验不通过会删除文件并失败。

**响应 data**

```json
null
```

---

## POST /api/chat/merge

合并分片并发送文件/图片消息。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| HASH | string | 是 | 文件 hash，字母数字，1–50；已存在则拒绝 |
| count | number | 是 | 分片数量，1–400（`maxFileSlice`） |
| name | string | 是 | 原始文件名，1–255，会做文件名安全过滤 |
| to | string | 是 | 接收方 account，字母数字，1–50 |
| type | string | 是 | `image` 或 `file` |

说明：按 `_1.._n` 顺序拼接临时目录中的分片，整体做 SHA 采样校验，成功后清理分片目录；失败只清理半成品，保留分片以便续传。落盘文件名为 `<HASH>.<后缀>`，图片消息的 `content` 改写为该文件名。单文件理论最大 400 × 50MB。

**响应 data**

```json
null
```

---

## POST /api/chat/breakpoint

查询某文件已上传的分片（断点续传）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| HASH | string | 是 | 文件 hash，字母数字，1–50 |

**响应 data**

```json
["_1", "_2", "_3"]
```

---

## POST /api/chat/repeat

秒传检查：文件已存在则直接复用并发送消息。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| HASH | string | 是 | 文件 hash，字母数字，1–50 |
| type | string | 是 | `image` 或 `file` |
| to | string | 是 | 接收方 account，字母数字，1–50 |
| name | string | 是 | 原始文件名，1–255，会做安全过滤 |
| size | number | 是 | 文件字节数，0 到 `400 × 50 × 1024 × 1024` |

说明：返回 `code=3` 表示服务端没有可用文件、需要走正常上传；返回 `code=1` 表示已复用（刷新 `update_at`、生成消息并推送）。上传记录存在但磁盘文件大小不一致时同样返回 `code=1`，但提示「发送失败」，需前端重新上传。

**响应 data**

```json
null
```

---

## POST /api/chat/forward-msg-link

配置/关闭「消息转发到自定义 HTTP 地址」。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| state | number | 是 | 1=启用，0=关闭 |
| type | string | 是 | 请求方法：`get` 或 `post` |
| link | string | 否 | 目标地址，默认空串，≤2000；启用时必须是 http/https 合法地址 |
| contentType | string | 否 | 默认 `application/json`，可选 `application/json`、`application/x-www-form-urlencoded`、`text/plain` |
| header | object | 否 | 自定义请求头，默认 `{}`，只允许 1 层对象 |
| body | string | 否 | 请求体模板，默认空串，≤2000；启用时不能为空 |

说明：`link` 与 `body` 支持 `{{text}}`、`{{title}}` 占位（`get` 作为 query，`post` 作为 body）；`get` 或 `post + application/json` 时 `body` 必须是 JSON 对象/数组字符串。序列化后的配置超过 10KB 会被拒绝。启用（`state=1`）时会先发一条「测试消息」，发送失败则不保存配置。

**响应 data**

```json
null
```

---

# SSH /api/ssh

SSH 模块挂载于 `/api/ssh`，路由文件 `server/src/routes/ssh/index.js`，**全部接口都需要登录**。

会话模型：`POST /api/ssh/connect` 依据请求头 `x-tem-id`（字母数字，≤50，必填）异步建立 ssh2 连接，服务端按 temid 缓存「一个终端 + 一个 SFTP」；会话空闲 60 秒过期。终端输出通过长轮询 `GET /api/user/real-time?page=ssh` 以 `{ type: 'ssh', data }` 下发（40ms 合并、单次积压 64KB 立即发送），键盘输入通过 `POST /api/user/real-time` 上报 `{ type: 'ssh', data: { type: 'cmd' | 'size', text, cols, rows } }`；`page=ssh` 的轮询会同时给 SSH 会话续期。除 `sftp-down` 外，SFTP 接口都用 `x-tem-id` 找会话。

---

## POST /api/ssh/search

搜索/分页列出当前账号的 SSH 配置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| word | string | 否 | 关键词，默认空串，≤100；匹配 host/username/title/port |
| pageNo | number | 否 | 页码，默认 1，≥1 |
| pageSize | number | 否 | 每页条数，默认 20，1–200 |
| category | string[] | 否 | 分类 id 数组，默认 `[]`，最多 10 个；多个分类为「或」匹配 |

说明：只查 `state=1` 的记录；有关键词时按相关度排序，否则按 `top` 降序、`serial` 降序。返回项包含明文 `password` / `private_key` / `passphrase`，供编辑回填。

**响应 data**

```json
{
  "total": 3,
  "totalPage": 1,
  "pageNo": 1,
  "data": [
    {
      "id": "sshId",
      "title": "测试机",
      "port": 22,
      "host": "10.0.0.1",
      "username": "root",
      "category": "catId1-catId2",
      "top": 0,
      "auth_type": "password",
      "passphrase": "",
      "password": "******",
      "private_key": "",
      "categoryArr": [{ "id": "catId1", "title": "生产" }]
    }
  ],
  "splitWord": ["测试"]
}
```

---

## GET /api/ssh/category

获取当前账号的 SSH 分类列表。

**鉴权**：需要登录

**响应 data**

```json
[{ "id": "catId1", "title": "生产" }]
```

---

## POST /api/ssh/delete

删除（软删除）SSH 配置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| ids | string[] | 是 | 要删除的配置 id 数组，可为空数组，最多 200 个，单项 1–50 字母数字 |

说明：`ids` 为空时清空当前账号全部 SSH 配置；操作把 `state` 置 0（进入回收站），并推送 `ssh`、`trash` 数据更新。

**响应 data**

```json
null
```

---

## POST /api/ssh/add

新增 SSH 配置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| port | number | 否 | 端口，默认 22，1–65535 |
| username | string | 是 | 登录用户，1–255 |
| title | string | 是 | 显示名称，1–200 |
| password | string | 否 | 密码，默认空串，≤255 |
| passphrase | string | 否 | 私钥口令，默认空串，≤255 |
| host | string | 是 | 主机地址，1–255 |
| private_key | string | 否 | 私钥内容，默认空串，≤5000 |
| auth_type | string | 是 | `password` 或 `key` |

说明：保存前做 SSRF 校验，非 root 账号不允许保存内网/回环/保留地址（root 可保存）。`auth_type=password` 用 `password`，`auth_type=key` 用 `private_key + passphrase`。

**响应 data**

```json
null
```

---

## POST /api/ssh/edit

编辑 SSH 配置；`id=local` 时用于维护「本机」配置。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 配置 id，字母数字，1–50；`local` 为保留值 |
| port | number | 否 | 端口，默认 22，1–65535 |
| username | string | 是 | 登录用户，1–255 |
| title | string | 是 | 显示名称，1–200 |
| password | string | 否 | 密码，默认空串，≤255 |
| passphrase | string | 否 | 私钥口令，默认空串，≤255 |
| host | string | 是 | 主机地址，1–255 |
| private_key | string | 否 | 私钥内容，默认空串，≤5000 |
| auth_type | string | 是 | `password` 或 `key` |

说明：`id=local` 仅 root 可操作，记录不存在时按新增处理；`host` 同样经过 SSRF 校验。只更新当前账号名下的记录。

**响应 data**

```json
null
```

---

## GET /api/ssh/info

获取单条 SSH 配置详情（含凭据，用于编辑回填）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 配置 id，字母数字，1–50 |

说明：不存在或不属于当前账号时返回空对象 `{}`。

**响应 data**

```json
{
  "id": "sshId",
  "title": "测试机",
  "port": 22,
  "host": "10.0.0.1",
  "username": "root",
  "auth_type": "password",
  "passphrase": "",
  "password": "******",
  "private_key": ""
}
```

---

## POST /api/ssh/top

设置配置的置顶权重。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 配置 id，字母数字，1–50 |
| top | number | 是 | 权重，0–99999，越大越靠前 |

**响应 data**

```json
null
```

---

## POST /api/ssh/set-category

设置某条配置所属分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 配置 id，字母数字，1–50 |
| category | string[] | 否 | 分类 id 数组，默认 `[]`，最多 10 个；入库时用 `-` 连接 |

**响应 data**

```json
null
```

---

## POST /api/ssh/edit-category

重命名 SSH 分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 新分类名，1–200 |
| id | string | 是 | 分类 id，字母数字，1–50 |

**响应 data**

```json
null
```

---

## POST /api/ssh/add-category

新增 SSH 分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分类名，1–200 |

说明：分类表总条数达到 `maxNoteCategory = 200` 时返回 403。

**响应 data**

```json
null
```

---

## POST /api/ssh/delete-category

删除 SSH 分类。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分类 id，字母数字，1–50 |

说明：只删除分类本身，已引用该 id 的配置里会留下无效分类 id（读取时被过滤掉）。

**响应 data**

```json
null
```

---

## POST /api/ssh/connect

发起 SSH 连接（异步建立终端与 SFTP）。

**鉴权**：需要登录（并需携带非空 `x-tem-id`）

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 配置 id，字母数字，1–50 |
| defaultPath | string | 是 | 登录后自动 `cd` 的目录，可为空串，≤2000 |

说明：接口只负责创建会话并立即返回，连接结果通过长轮询推送（`SSH Error: ...` 或终端输出）。同一 temid 已有会话时先销毁旧会话；连接空闲 60 秒（无 `page=ssh` 轮询续期）后自动断开。非 root 连接前做 SSRF 解析校验，禁止内网/回环/保留地址。

**响应 data**

```json
{ "title": "测试机", "username": "root", "host": "10.0.0.1", "port": 22 }
```

---

## GET /api/ssh/quick-list

获取快捷命令（按分组）。

**鉴权**：需要登录

**响应 data**

```json
[
  {
    "id": "default",
    "title": "默认",
    "commands": [{ "id": "cmdId", "enter": 0, "title": "查看磁盘", "command": "df -h" }]
  }
]
```

---

## POST /api/ssh/add-quick

新增快捷命令。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 否 | 目标分组 id，默认 `default`，字母数字，1–50；分组不存在时追加到第一个分组 |
| title | string | 是 | 命令名称，1–200 |
| command | string | 是 | 命令内容，1–5000 |
| enter | number | 否 | 执行后是否回车，0=否（默认），1=是 |

说明：快捷命令存于账号目录下的 `quick.json`，单文件超过 5MB 时返回 403。

**响应 data**

```json
null
```

---

## POST /api/ssh/edit-quick

编辑快捷命令。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| groupId | string | 否 | 分组 id，默认 `default`，字母数字，1–50 |
| id | string | 是 | 命令 id，字母数字，1–50 |
| title | string | 是 | 命令名称，1–200 |
| command | string | 是 | 命令内容，1–5000 |
| enter | number | 否 | 0=不回车（默认），1=回车 |

**响应 data**

```json
null
```

---

## POST /api/ssh/delete-quick

删除快捷命令。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 命令 id，字母数字，1–50 |
| groupId | string | 是 | 分组 id，字母数字，1–50 |

**响应 data**

```json
null
```

---

## POST /api/ssh/move-quick

调整同组内快捷命令顺序。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| fromId | string | 是 | 被移动的命令 id，字母数字，1–50 |
| toId | string | 是 | 目标位置命令 id，字母数字，1–50 |
| groupId | string | 是 | 分组 id，字母数字，1–50 |

**响应 data**

```json
null
```

---

## POST /api/ssh/move-to-group

把快捷命令移动到另一个分组（追加到末尾）。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 命令 id，字母数字，1–50 |
| fromId | string | 是 | 源分组 id，字母数字，1–50 |
| toId | string | 是 | 目标分组 id，字母数字，1–50 |

**响应 data**

```json
null
```

---

## POST /api/ssh/add-quick-group

新增快捷命令分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| title | string | 是 | 分组名称，1–200 |

说明：`quick.json` 超过 5MB 时返回 403。

**响应 data**

```json
null
```

---

## POST /api/ssh/edit-quick-group

重命名快捷命令分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分组 id，字母数字，1–50 |
| title | string | 是 | 新名称，1–200 |

**响应 data**

```json
null
```

---

## POST /api/ssh/move-quick-group

调整分组顺序。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| fromId | string | 是 | 被移动的分组 id，字母数字，1–50 |
| toId | string | 是 | 目标位置分组 id，字母数字，1–50 |

说明：默认分组（首位）不参与移动。

**响应 data**

```json
null
```

---

## POST /api/ssh/delete-quick-group

删除快捷命令分组。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | 是 | 分组 id，字母数字，1–50，不能为 `default` |

说明：分组内的快捷命令随分组一起从配置中移除。

**响应 data**

```json
null
```

---

## GET /api/ssh/sftp-list

列出远端目录（SFTP）。

**鉴权**：需要登录（并需携带有效 `x-tem-id` 会话）

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 远端目录，1–2000，不能为空（会规范化为绝对路径） |

说明：会话不存在或 SFTP 未就绪时返回 403「已断开SSH连接」；读取失败按空数组返回。默认按 `mtime` 降序。

**响应 data**

```json
[
  { "type": "dir", "path": "/root", "name": "logs", "longname": "drwxr-xr-x ...", "mtime": 1730000000 },
  { "type": "file", "path": "/root", "name": "a.txt", "longname": "-rw-r--r-- ...", "mtime": 1729999999 }
]
```

---

## POST /api/ssh/sftp-up

上传文件到远端目录（multipart，流式直传）。

**鉴权**：需要登录（并需携带有效 `x-tem-id` 会话）

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 目标远端目录，1–2000 |
| name | string | 是 | 文件名，1–255，服务端会做文件名安全过滤 |

**Body**：`multipart/form-data`，字段名任意，只取第一个文件；字节流经 busboy 直接管道到 SFTP 写流，不落本地磁盘，因此没有额外分片协议与固定大小上限。

说明：远端路径为 `path/name`；上传中断会销毁写流并删除远端半成品文件，随后返回失败；请求里没有文件时返回 400「未接收到文件」。

**响应 data**

```json
null
```

---

## GET /api/ssh/sftp-down

从远端下载文件（流式响应，非 JSON 信封）。

**鉴权**：需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| path | string | 是 | 远端文件路径，1–2000 |
| id | string | 是 | 会话标识，1 起，不能为空（服务端用 `account + id` 查找会话） |

说明：响应为 `application/octet-stream` 文件流，带 `Content-Disposition: attachment`（文件名为路径 basename）与 `Access-Control-Expose-Headers`。会话不存在时返回 403「已断开SSH连接」。注意本接口的会话键是 `account + id`，与其他 SFTP 接口使用 `x-tem-id` 不同。

**响应 data**

文件二进制流，无 `data` 字段。

---

## GET /api/ssh/history-commands

读取历史命令。

**鉴权**：需要登录

**响应 data**

```json
["ls -al", "df -h"]
```

---

## POST /api/ssh/history-commands

追加一条历史命令。

**鉴权**：需要登录

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| command | string | 是 | 命令内容，1–5000 |

说明：重复命令会被移到末尾，最多保留最近 `sshHistoryCommandsLength = 100` 条，并推送 `historyCommands` 更新。

**响应 data**

```json
null
```

---

# 全局与公开接口

这些接口在 `server/src/app.js` 中直接定义，不经过 `/api/chat`、`/api/ssh` 的子路由。公共约定：跨域已全局放开（`Access-Control-Allow-Origin: *`）；请求头 `x-tem-id` 会先被全局校验（字母数字、≤50），非法时直接 400；同一 IP 10 秒内超过 500 次请求会被限流并返回 403。

`pubApi` 中的开关（默认均为关闭）决定匿名访问是否可用：`siteInfoApi`、`randomMusicApi`、`echoApi`。开关关闭时，只有已登录用户可调用。

---

## ALL /api/s/:chat_id

收信接口：把外部文本投递给指定用户（用于 webhook、脚本、IoT 等）。GET 与 POST 均可。

**鉴权**：公开

**Params**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| chat_id | string | 是 | 用户的收信标识，字母数字，1–50；对应用户表 `chat_id` |

**Query / Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| text | string | 是 | 消息内容，1–3000。GET 读 `query.text`；POST 优先读 `body.text`，为空时回退 `query.text` |

说明：目标用户需 `state=1` 且 `receive_chat_state=1`，否则返回 403「助手未开启收信接口」。消息以助手身份写入聊天记录并推送，同时按接收方的自定义转发配置继续转发。用户可在与助手的会话中回复 `start` / `stop` / `update` 开启、关闭或重置该接口。

**响应 data**

```json
null
```

---

## GET /api/site-info

抓取网页标题与描述（带缓存）。

**鉴权**：公开（`pubApi.siteInfoApi=true`）；开关关闭时需要登录

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| u | string | 是 | 目标地址，1–2000。不带协议时默认补 `https://`，失败再试 `http://` |

说明：只接受 `text/html` 响应，`<head>` 超过 300KB 视为失败；成功结果按 host+pathname 缓存到文件，失败会写 60 秒的 `.miss` 占位，期间直接返回空结果。任何抓取异常都不会报错，而是返回 `{ title: "", des: "" }`。

**响应 data**

```json
{ "title": "示例站点", "des": "站点描述" }
```

---

## GET /api/music

随机播放一首曲库歌曲（流式响应，非 JSON 信封）。

**鉴权**：公开（`pubApi.randomMusicApi=true`）；开关关闭时需要登录

说明：随机取 `songs` 表一条记录并把 `play_count` 加 1，然后复用文件网关 `/music/url/<id>` 输出音频流。曲库为空时返回 404「音乐库为空」。响应为音频二进制与 `X-File-Size` 等文件头。

**响应 data**

音频文件流，无 `data` 字段。

---

## 文件网关（详见文件管理）

统一文件网关（`/api/f/*`），支持两种写法：路径直接跟在 `/api/f/` 后，或用 `?p=` 指定。

**鉴权**：按目录区分

- 公开目录：`pic`、`sharemusic`、`sharefile`、`logo`、`pub`
- 需要登录：`bg`、`upload`、`file`、`music`

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| p | string | 否 | 文件路径，1–2000；与 `/api/f/` 后的路径二选一 |
| w | number | 否 | 图片缩略图宽度，默认 0（原图）；会归一到 256/512/1024 |
| d | number | 否 | 1=以附件下载（设置 `Content-Disposition`），默认 0 |
| n | string | 否 | 下载时的自定义文件名，≤255 |
| token | string | 否 | 分享/临时访问 token，≤2000；命中 `temAccessFile` 类型时以 token 内指定的账号与路径访问 |

说明：聊天文件（`upload/<消息id>`）只有群成员或会话双方可访问；`file` 目录限制在用户根目录内；所有路径都做越界校验。响应为文件流，带 `X-File-Size`，缩略图统一为 webp。详细目录语义、分享 token 与头像/公共目录规则见文件管理文档。

**响应 data**

文件二进制流，无 `data` 字段。

---

## ALL /api/echo

回显接口：把本次请求的方法、路径、查询、请求头与请求体原样返回，用于联调与排障。

**鉴权**：公开（`pubApi.echoApi=true`）；开关关闭时需要登录

**Query / Body**：任意，不做校验。`multipart/form-data` 请求不解析文件，`body` 返回 `null` 并附带提示；请求头 `x-debug: true` 时额外返回 `debug.rawBody`（若存在）。

**响应 data**

```json
{
  "timestamp": "2026-11-14 10:00:00",
  "method": "POST",
  "path": "/api/echo?a=1",
  "query": { "a": "1" },
  "headers": { "content-type": "application/json" },
  "body": { "hello": "world" },
  "message": "文件上传请求已略过（未处理 multipart/form-data）"
}
```

---

# 附录：接口速查表

共 257 个接口，按文档出现顺序排列，可配合编辑器的搜索快速定位。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/user/error` | 前端错误上报 |
| GET | `/api/user/custom-code` | 获取用户自定义的 HTML 代码 |
| POST | `/api/user/register` | 注册账号（需先完成滑块验证） |
| POST | `/api/user/allow-login-req` | 发起“免密登录”请求，通知目标账号的在线设备弹出批准框 |
| POST | `/api/user/code-login` | 免密登录轮询接口 |
| GET | `/api/user/captcha` | 获取滑块验证码图片（拼图背景 + 拼图块） |
| POST | `/api/user/captcha` | 提交滑块轨迹，验证拼图位置 |
| POST | `/api/user/login` | 账号密码登录 |
| POST | `/api/user/verify-login` | 两步验证（TOTP）完成登录 |
| GET | `/api/user/mail-code` | 发送“重置密码”邮箱验证码 |
| POST | `/api/user/reset-pass` | 通过邮箱验证码重置密码（重置为空密码并自动登录） |
| GET | `/api/user/file-token` | 为当前用户生成“指定文件”的临时访问 Token |
| GET | `/api/user/font-list` | 获取可用字体列表 |
| POST | `/api/user/bind-mail-code` | 向待绑定邮箱发送验证码 |
| POST | `/api/user/bind-email` | 绑定或解绑邮箱 |
| GET | `/api/user/verify` | 获取待绑定的两步验证密钥（用于生成二维码） |
| POST | `/api/user/verify` | 开启或关闭两步验证 |
| GET | `/api/user/tips` | 获取 tips 标记 |
| POST | `/api/user/allow-code-login` | 批准一次免密登录请求（在已登录设备上操作） |
| POST | `/api/user/change-pd` | 修改密码 |
| POST | `/api/user/create-token` | 生成长期认证 Token |
| POST | `/api/user/logout` | 退出登录 |
| POST | `/api/user/changename` | 修改用户名 |
| POST | `/api/user/delete-account` | 注销账号（不可恢复） |
| GET | `/api/user/userinfo` | 获取当前登录用户信息 |
| POST | `/api/user/delete-logo` | 删除头像 |
| POST | `/api/user/up-logo` | 上传图片，用作头像、书签图标、搜索引擎图标或翻译接口图标 |
| POST | `/api/user/daily-change-bg` | 切换“每日更换壁纸”开关 |
| POST | `/api/user/hide-state` | 切换隐身状态 |
| POST | `/api/user/remote-login-state` | 切换免密登录开关 |
| GET | `/api/user/real-time` | 长轮询接收推送指令（多端同步、聊天通知、远程播放、SSH 输出等） |
| POST | `/api/user/real-time` | 发送推送指令到本账号的其他设备（或指定设备） |
| POST | `/api/user/delete-share` | 删除分享记录 |
| POST | `/api/user/share-state` | 启用 / 停用分享 |
| GET | `/api/user/share-list` | 分页获取我的分享列表 |
| POST | `/api/user/edit-share` | 编辑分享标题、有效期和提取码 |
| GET | `/api/user/trash-list` | 分页获取回收站内容（书签、分组、笔记、历史、SSH） |
| POST | `/api/user/delete-trash` | 彻底删除回收站记录 |
| POST | `/api/user/recover-trash` | 从回收站恢复记录 |
| POST | `/api/user/clipboard` | 写入剪切板内容并同步到其他设备 |
| GET | `/api/user/clipboard` | 读取剪切板内容 |
| GET | `/api/user/online-clients` | 获取当前账号的在线客户端列表 |
| POST | `/api/root/email` | 配置系统发信邮箱 |
| GET | `/api/root/user-list` | 分页获取用户列表，并附带站点主要配置（注册、回收站、缓存过期、公开接口、邮箱、备用图… |
| POST | `/api/root/favicon-spare-api` | 设置图标获取失败时使用的备用接口地址 |
| POST | `/api/root/account-state` | 批量启用 / 关闭账号 |
| POST | `/api/root/delete-account` | 彻底销毁指定账号及其全部数据 |
| POST | `/api/root/clean-music-file` | 清理音乐库中的无效数据与孤儿文件 |
| POST | `/api/root/clean-bg-file` | 清理壁纸库中的无效数据与孤儿文件 |
| POST | `/api/root/clean-pic-file` | 清理图床中的无效数据与孤儿文件 |
| POST | `/api/root/clean-chat-file` | 清理聊天室上传记录与上传文件 |
| POST | `/api/root/register-state` | 切换注册开关（取反） |
| POST | `/api/root/update-tokenkey` | 重新生成用于签发登录令牌的 `tokenKey` |
| GET | `/api/root/log` | 读取指定日志文件内容 |
| GET | `/api/root/log-list` | 获取日志文件列表 |
| POST | `/api/root/delete-log` | 删除日志文件 |
| POST | `/api/root/trash-state` | 切换文件回收站开关（取反） |
| POST | `/api/root/pub-api-state` | 设置各公开接口的开放状态 |
| POST | `/api/root/change-cache-time` | 设置缓存 / 文件的过期天数 |
| POST | `/api/root/clean-database` | 整理数据库文件 |
| POST | `/api/root/custom-code` | 写入注入到页面 `<head>` 与 `<body>` 的自定义代码 |
| POST | `/api/root/tips` | 设置站点提示（更新提示）状态 |
| POST | `/api/root/test-email` | 发送一封测试邮件 |
| POST | `/api/root/test-tfa` | 校验两步验证验证码 |
| POST | `/api/root/create-account` | 由管理员创建新账号 |
| GET | `/api/root/sys-status` | 获取服务器实时资源占用 |
| POST | `/api/file/get-share` | 校验分享链接并换取分享访问 token。打开他人分享的文件/文件夹时调用 |
| POST | `/api/file/read-dir` | 读取目录列表（支持搜索、排序、分页、按分享 token 浏览） |
| POST | `/api/file/read-file` | 读取文本文件内容（用于在线编辑） |
| POST | `/api/file/history-state` | 开启/关闭文本文件保存历史版本 |
| GET | `/api/file/history-state` | 查询是否开启文件历史版本 |
| GET | `/api/file/cd-history` | 获取目录访问历史（最近进入过的路径） |
| GET | `/api/file/favorites` | 获取收藏的目录列表 |
| POST | `/api/file/favorites` | 添加或移除收藏目录 |
| GET | `/api/file/read-dir-size` | 统计目录总大小（异步任务） |
| POST | `/api/file/create-file` | 新建空文件 |
| POST | `/api/file/create-link` | 创建符号链接或硬链接（仅管理员） |
| POST | `/api/file/share` | 创建文件/文件夹分享 |
| POST | `/api/file/save-file` | 保存文本文件内容 |
| POST | `/api/file/editing` | 保存或清除文本编辑草稿（自动保存） |
| POST | `/api/file/copy` | 复制文件/文件夹（异步任务） |
| POST | `/api/file/same-name` | 检查目标目录是否已存在同名文件/文件夹 |
| POST | `/api/file/move` | 移动/重命名文件与文件夹（异步任务） |
| POST | `/api/file/zip` | 压缩单个文件/文件夹为 zip（异步任务） |
| POST | `/api/file/unzip` | 解压 zip 文件（异步任务） |
| POST | `/api/file/delete` | 删除文件/文件夹，默认放入回收站（异步任务） |
| POST | `/api/file/clear-trash` | 清空回收站（异步任务） |
| POST | `/api/file/create-dir` | 新建文件夹 |
| POST | `/api/file/rename` | 重命名文件/文件夹（同步，不进入回收站） |
| POST | `/api/file/mode` | 修改文件权限（仅管理员，异步任务） |
| POST | `/api/file/chown` | 修改文件属主/属组（仅管理员，异步任务） |
| POST | `/api/file/up` | 上传单个分片（断点续传协议的一步） |
| POST | `/api/file/merge` | 合并已上传分片为目标文件 |
| POST | `/api/file/breakpoint` | 查询某个上传会话已上传的分片列表（断点续传） |
| POST | `/api/file/repeat` | 判断目标路径是否已存在（上传前查重） |
| POST | `/api/file/complete` | 路径自动补全 |
| POST | `/api/file/download` | 离线下载 URL 到指定目录（异步任务） |
| POST | `/api/file/add-file-to` | 扫描目录，把音乐/图片批量加入音乐库或壁纸库（仅管理员，异步任务） |
| GET | `/api/f/<dir>/<path>` | 按目录白名单读取文件、生成缩略图或下载 |
| POST | `/api/task/info` | 查询异步任务进度 |
| POST | `/api/task/cancel` | 取消异步任务（会中断底层文件操作） |
| POST | `/api/task/list` | 获取当前账号进行中的任务 key 列表 |
| POST | `/api/player/lrc` | 读取歌曲歌词，按时间轴解析为数组 |
| POST | `/api/player/song-info` | 获取单曲完整信息 |
| POST | `/api/player/get-share` | 读取音乐分享，返回分享内的歌曲列表与访问 token |
| GET | `/api/player/search` | 按关键词搜索音乐库（标题、歌手） |
| GET | `/api/player/list` | 获取歌单列表及指定歌单的歌曲 |
| GET | `/api/player/export` | 导出歌单文件 |
| POST | `/api/player/import` | 向歌单导入歌曲 id 列表 |
| POST | `/api/player/last-play` | 保存最后播放位置与播放进度 |
| GET | `/api/player/last-play` | 读取最后播放歌曲与进度 |
| GET | `/api/player/random-list` | 随机获取一批歌曲用于随机播放 |
| POST | `/api/player/playlist` | 保存当前播放列表 |
| GET | `/api/player/playlist` | 读取当前播放列表 |
| POST | `/api/player/move-list` | 调整自建歌单的排列顺序 |
| POST | `/api/player/delete-list` | 删除自建歌单 |
| POST | `/api/player/edit-list` | 编辑歌单名称、描述，可同时调整位置 |
| POST | `/api/player/edit-song` | 编辑歌曲元数据，并写回音频文件的 ID3 标签 |
| POST | `/api/player/add-list` | 新建自建歌单 |
| POST | `/api/player/move-song` | 调整歌曲在歌单内的顺序 |
| POST | `/api/player/collect-song` | 收藏歌曲（加入「收藏」歌单） |
| POST | `/api/player/close-collect-song` | 取消收藏 |
| POST | `/api/player/delete-song` | 从歌单移除歌曲，或从音乐库彻底删除歌曲 |
| POST | `/api/player/song-to-list` | 把歌曲移动到 / 添加到另一个歌单 |
| POST | `/api/player/delete-mv` | 删除歌曲的 MV 文件 |
| GET | `/api/player/read-lrc` | 读取歌词原始文本 |
| POST | `/api/player/edit-lrc` | 保存歌词文本，同时写入音频文件的 ID3 歌词标签 |
| POST | `/api/player/share` | 创建音乐分享 |
| POST | `/api/player/up` | 上传歌曲、歌曲封面或 MV |
| POST | `/api/player/repeat` | 上传前的重复校验（秒传） |
| POST | `/api/player/save-share` | 把音乐分享保存为自己的歌单 |
| GET | `/api/bg/r/:type` | 获取随机一张壁纸，直接返回图片 |
| GET | `/api/bg/random` | 从壁纸库随机取一条记录（只返回 id，不返回图片） |
| POST | `/api/bg/change` | 更换当前账号使用的壁纸 |
| POST | `/api/bg/collect` | 收藏壁纸 |
| GET | `/api/bg/list` | 获取壁纸列表或收藏列表 |
| POST | `/api/bg/delete` | 删除壁纸，或取消收藏 |
| POST | `/api/bg/up` | 上传壁纸 |
| POST | `/api/bg/repeat` | 壁纸上传前的重复校验 |
| POST | `/api/pic/up` | 上传图片到图床 |
| POST | `/api/pic/repeat` | 图片上传前的重复校验 |
| GET | `/api/pic/list` | 获取图床图片列表 |
| POST | `/api/pic/delete` | 删除图床图片 |
| GET | `/api/icon` | 抓取并返回指定网站的 favicon（PNG） |
| POST | `/api/bmk/get-share` | 通过分享 id 获取书签分组分享 |
| POST | `/api/bmk/search` | 搜索书签（跨分组分页检索） |
| GET | `/api/bmk/list` | 获取分组列表，或指定分组的书签明细 |
| POST | `/api/bmk/move-group` | 调整分组排序位置 |
| POST | `/api/bmk/move-bmk` | 调整分组内书签排序位置 |
| POST | `/api/bmk/add-group` | 新建书签分组 |
| POST | `/api/bmk/delete-group` | 删除分组（移入回收站） |
| POST | `/api/bmk/group-share-state` | 批量设置分组公开 / 锁定状态 |
| POST | `/api/bmk/delete-logo` | 清除书签自定义 LOGO |
| POST | `/api/bmk/edit-group` | 编辑分组标题，可选同时调整排序位置 |
| POST | `/api/bmk/add-bmk` | 批量添加书签 |
| POST | `/api/bmk/edit-bmk` | 编辑书签信息，可选同时移动到其他分组 |
| POST | `/api/bmk/bmk-to-group` | 批量将书签移动到指定分组 |
| POST | `/api/bmk/delete-bmk` | 删除书签（移入回收站） |
| POST | `/api/bmk/share` | 分享一个分组内的书签 |
| POST | `/api/bmk/save-share` | 把他人分享的书签保存为自己的分组 |
| POST | `/api/bmk/import` | 批量导入书签（按分组） |
| GET | `/api/bmk/export` | 导出全部书签 |
| GET | `/api/note/read` | 读取笔记内容 |
| POST | `/api/note/search` | 搜索笔记列表 |
| GET | `/api/note/category` | 获取笔记分类列表 |
| POST | `/api/note/history-state` | 开启 / 关闭笔记历史版本记录 |
| GET | `/api/note/history-state` | 查询笔记历史记录开关 |
| POST | `/api/note/state` | 批量设置笔记公开 / 锁定 |
| POST | `/api/note/delete` | 删除笔记（移入回收站） |
| POST | `/api/note/up-note` | 新建笔记 |
| POST | `/api/note/edit` | 保存笔记（存在则更新，不存在则新建） |
| GET | `/api/note/editing` | 读取笔记编辑草稿 |
| POST | `/api/note/editing` | 保存或清除笔记编辑草稿 |
| POST | `/api/note/edit-info` | 编辑笔记的标题、创建 / 更新时间与阅读量 |
| POST | `/api/note/top` | 设置笔记置顶权重 |
| POST | `/api/note/set-category` | 设置笔记所属分类 |
| POST | `/api/note/edit-category` | 重命名笔记分类 |
| POST | `/api/note/add-category` | 新增笔记分类 |
| POST | `/api/note/delete-category` | 删除笔记分类 |
| GET | `/api/todo/list` | 分页获取待办列表 |
| POST | `/api/todo/add` | 添加待办 |
| POST | `/api/todo/delete` | 删除待办 |
| POST | `/api/todo/state` | 批量修改待办完成状态 |
| POST | `/api/todo/edit` | 编辑待办内容 |
| GET | `/api/count/list` | 分页获取倒计时列表 |
| POST | `/api/count/add` | 添加倒计时 |
| POST | `/api/count/delete` | 删除倒计时 |
| POST | `/api/count/edit` | 编辑倒计时 |
| POST | `/api/count/top` | 设置倒计时置顶权重 |
| POST | `/api/count/state` | 批量修改倒计时启用状态 |
| GET | `/api/search/config` | 读取当前用户的搜索引擎与翻译接口配置 |
| POST | `/api/search/add-engine` | 添加搜索引擎 |
| POST | `/api/search/edit-engine` | 编辑搜索引擎 |
| POST | `/api/search/delete-engine` | 删除搜索引擎 |
| POST | `/api/search/change-engine` | 切换当前搜索引擎 |
| POST | `/api/search/change-search-word` | 切换搜索框提示词 |
| POST | `/api/search/delete-engine-logo` | 清除搜索引擎自定义 LOGO |
| POST | `/api/search/add-translator` | 添加翻译接口 |
| POST | `/api/search/edit-translator` | 编辑翻译接口 |
| POST | `/api/search/delete-translator` | 删除翻译接口 |
| POST | `/api/search/change-translator` | 切换当前翻译接口 |
| POST | `/api/search/delete-translator-logo` | 清除翻译接口自定义 LOGO |
| GET | `/api/search/split-word` | 对文本分词 |
| GET | `/api/search/history-list` | 分页获取搜索历史 |
| POST | `/api/search/save` | 保存一条搜索历史 |
| GET | `/api/search/list` | 综合搜索历史、笔记、书签 |
| POST | `/api/search/delete` | 删除搜索历史（移入回收站） |
| POST | `/api/chat/dnd-mode` | 设置某个好友的免打扰标记（路由注释为「勿扰」） |
| POST | `/api/chat/setdes` | 设置好友备注 |
| GET | `/api/chat/getdes` | 获取好友备注、在线状态与登录设备 |
| GET | `/api/chat/draft` | 读取与指定好友的聊天草稿 |
| POST | `/api/chat/draft` | 保存聊天草稿 |
| GET | `/api/chat/read-msg` | 读取聊天记录（分页/游标），并把该会话标记为已读 |
| GET | `/api/chat/expired` | 检查聊天文件是否仍有效（是否已被清理） |
| POST | `/api/chat/send-msg` | 发送文本消息 |
| POST | `/api/chat/forward` | 转发一条已有消息（文本/图片/文件/语音）给其他会话 |
| GET | `/api/chat/news` | 获取未读消息统计，或一键全部标为已读 |
| POST | `/api/chat/delete-msg` | 撤回单条消息，或清空整个会话 |
| POST | `/api/chat/shake-msg` | 抖动对方窗口（仅在线用户） |
| GET | `/api/chat/user-list` | 成员（好友/用户）列表，带最后一条消息、未读、在线设备 |
| POST | `/api/chat/up` | 上传聊天文件的一个分片（multipart，边收边存） |
| POST | `/api/chat/up-voice` | 上传并发送语音消息 |
| POST | `/api/chat/merge` | 合并分片并发送文件/图片消息 |
| POST | `/api/chat/breakpoint` | 查询某文件已上传的分片（断点续传） |
| POST | `/api/chat/repeat` | 秒传检查：文件已存在则直接复用并发送消息 |
| POST | `/api/chat/forward-msg-link` | 配置/关闭「消息转发到自定义 HTTP 地址」 |
| POST | `/api/ssh/search` | 搜索/分页列出当前账号的 SSH 配置 |
| GET | `/api/ssh/category` | 获取当前账号的 SSH 分类列表 |
| POST | `/api/ssh/delete` | 删除（软删除）SSH 配置 |
| POST | `/api/ssh/add` | 新增 SSH 配置 |
| POST | `/api/ssh/edit` | 编辑 SSH 配置；`id=local` 时用于维护「本机」配置 |
| GET | `/api/ssh/info` | 获取单条 SSH 配置详情（含凭据，用于编辑回填） |
| POST | `/api/ssh/top` | 设置配置的置顶权重 |
| POST | `/api/ssh/set-category` | 设置某条配置所属分类 |
| POST | `/api/ssh/edit-category` | 重命名 SSH 分类 |
| POST | `/api/ssh/add-category` | 新增 SSH 分类 |
| POST | `/api/ssh/delete-category` | 删除 SSH 分类 |
| POST | `/api/ssh/connect` | 发起 SSH 连接（异步建立终端与 SFTP） |
| GET | `/api/ssh/quick-list` | 获取快捷命令（按分组） |
| POST | `/api/ssh/add-quick` | 新增快捷命令 |
| POST | `/api/ssh/edit-quick` | 编辑快捷命令 |
| POST | `/api/ssh/delete-quick` | 删除快捷命令 |
| POST | `/api/ssh/move-quick` | 调整同组内快捷命令顺序 |
| POST | `/api/ssh/move-to-group` | 把快捷命令移动到另一个分组（追加到末尾） |
| POST | `/api/ssh/add-quick-group` | 新增快捷命令分组 |
| POST | `/api/ssh/edit-quick-group` | 重命名快捷命令分组 |
| POST | `/api/ssh/move-quick-group` | 调整分组顺序 |
| POST | `/api/ssh/delete-quick-group` | 删除快捷命令分组 |
| GET | `/api/ssh/sftp-list` | 列出远端目录（SFTP） |
| POST | `/api/ssh/sftp-up` | 上传文件到远端目录（multipart，流式直传） |
| GET | `/api/ssh/sftp-down` | 从远端下载文件（流式响应，非 JSON 信封） |
| GET | `/api/ssh/history-commands` | 读取历史命令 |
| POST | `/api/ssh/history-commands` | 追加一条历史命令 |
| ALL | `/api/s/:chat_id` | 收信接口：把外部文本投递给指定用户（用于 webhook、脚本、IoT 等）。GET… |
| GET | `/api/site-info` | 抓取网页标题与描述（带缓存） |
| GET | `/api/music` | 随机播放一首曲库歌曲（流式响应，非 JSON 信封） |
| ALL | `/api/echo` | 回显接口：把本次请求的方法、路径、查询、请求头与请求体原样返回，用于联调与排障 |
