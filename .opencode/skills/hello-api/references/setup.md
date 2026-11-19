# 连接与登录配置

CLI 是零依赖脚本，路径固定为 `.opencode/skills/hello-api/scripts/hello.mjs`，Node 18+。
所有命令都在项目根目录执行。

## 1. 推荐方式：本地 `.env`

用户自己创建并填写，**智能体不要代填、不要读取**：

```powershell
Copy-Item .opencode\skills\hello-api\scripts\.env.example `
          .opencode\skills\hello-api\scripts\.env
```

`.env` 内容：

```dotenv
HELLO_BASE_URL=https://hello.example.com
HELLO_COOKIE=token=页面生成的token
```

生成 token 的两种方式：

1. 页面：登录 Hello →「账号管理」→「生成认证token」→ 输入有效期天数（`1–3650`）→
   弹窗显示 token 并自动全选，复制后填到 `HELLO_COOKIE=token=...`。
2. 接口：在 Hello 页面控制台执行：

```js
fetch('/api/user/create-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ days: 30 }),
})
  .then((r) => r.json())
  .then((r) => console.log(r.data));
```

已有可用 token 时，也可以用 CLI 续期：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs api POST /api/user/create-token --set days=30
```

浏览器登录 Cookie 默认 2 天，并在使用中自动续期；通过页面或接口生成的 token 不自动续期，
到期后重新生成。`.env` 已被 `.gitignore` 忽略。

检查配置（默认隐藏地址、不显示 Cookie 内容，只显示来源和长度）：

```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
node .opencode\skills\hello-api\scripts\hello.mjs config
```

排错时确实需要看完整地址，再加 `--show-url`（普通查询不要加）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs config --show-url
```

验证连接（只输出账号信息，不输出凭据）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs whoami
```

## 2. 配置优先级

```
地址：--url  >  HELLO_BASE_URL  >  .env  >  hello.config.json  >  本地登录态  >  默认 localhost:55555
Cookie：--cookie  >  --cookie-file  >  HELLO_COOKIE  >  HELLO_COOKIE_FILE  >  .env  >  hello.config.json  >  本地登录态
```

## 3. 其他连接方式

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

也可以保存并验证一次 Cookie（之后命令自动读取）：

```powershell
node .opencode\skills\hello-api\scripts\hello.mjs use-cookie --cookie "token=..."
```

> 只有拿不到 Cookie、但知道账号密码时，才用 `login`。正常远程操作优先 `.env` + Cookie。
> 命令行登录遇到图形/滑块验证码会以退出码 `3` 结束，此时改用 Cookie。

## 4. Token 失效情况

| 情况 | 说明 |
| --- | --- |
| 到达生成时的 `days` 天 | JWT 到期，接口返回 `未登录或登录态已过期`（code 2），重新生成 token |
| 修改密码 | `exp_token_time` 更新，之前签发的 token 全部失效 |
| 邮箱重置密码 | 同上，之前签发的 token 全部失效 |
| 退出其他设备 | `exp_token_time` 更新，之前签发的 token 全部失效 |
| 账号被禁用 / 删除（`state != 1`） | 加载不到用户信息，token 失效 |
| 重置或删除 `app_data` | `tokenKey` 重新生成，所有旧 token 无法解密 |
| 仅退出当前设备 | 只清除浏览器 Cookie，已导出的 token 仍有效，直到过期或被上述操作失效 |
| 服务重启 | 不影响 token；`tokenKey` 持久化在数据目录中 |

## 5. 连接排错

| 现象 | 原因 / 处理 |
| --- | --- |
| `请求失败 ... fetch failed` | 地址不对或无法访问；先跑 `config` 看 `baseUrl`，或检查 `.env` 里的 `HELLO_BASE_URL` |
| `未登录或登录态已过期`（code 2） | 让用户重新生成 token：`POST /api/user/create-token`（days 1–3650）或从浏览器重新复制 Cookie，更新 `.env` 里的 `HELLO_COOKIE`，不要改去调 `login` |
| `config` 显示 `cookieSet: false` | 用户还没填 `.env`，或键名写错（应为 `HELLO_COOKIE`） |
| `需要图形/滑块验证码`（退出码 3） | 走的是账号密码登录；远程场景改用 `.env` + Cookie |
| `Cookie 无效` | Cookie 已过期/复制不完整，或复制成了别的站点；重新复制完整的 `token=...` |
| 中文输出乱码 | 先执行 `[Console]::OutputEncoding = [Text.Encoding]::UTF8` |
| `code: 0` 且 `data: 1` | 参数校验失败，看 `codeText` 里的字段名和原因 |
