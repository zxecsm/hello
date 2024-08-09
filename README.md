```bash
git clone https://github.com/zxecsm/hello.git /opt/hello/hello
```

```bash
vim /opt/hello/hello/server/data/config.js
```

```javascript
const filepath = '/opt/hello/data'; // 网站数据存放目录
const rootP = '/'; // 文件管理根目录
const configObj = {
  port: 55555,
  filepath,
  rootP,
  userFileP: `${filepath}/userFile`,
};
module.exports = configObj;
```

```bash
PROJECT_PATH="/opt/hello/hello"
SERVER_PATH="$PROJECT_PATH/server"
WEB_PATH="$PROJECT_PATH/web"

# 安装依赖
pnpm install --prefix "$SERVER_PATH"
pnpm install --prefix "$WEB_PATH"

# 打包
pnpm --prefix "$WEB_PATH" run build

# 启动服务
node "$SERVER_PATH/app.js"
```

- username：admin
- password：

![hello](https://raw.githubusercontent.com/zxecsm/hello/main/hello.png)
