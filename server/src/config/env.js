import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// 支持在程序目录放一个 hello.env，双击运行时自动读取，无需在命令行设置环境变量。
// 优先级：已存在的环境变量 > hello.env > 代码默认值（命令行设置仍然可以覆盖文件）。
const moduleDir = dirname(fileURLToPath(import.meta.url));
const appRootDir = process.pkg ? dirname(process.execPath) : resolve(moduleDir, '../..');
const envPath = process.env.HELLO_ENV_FILE
  ? resolve(process.env.HELLO_ENV_FILE)
  : resolve(appRootDir, 'hello.env');

const TEMPLATE = `# hello 配置文件，修改后重新双击程序即可生效
# 命令行环境变量优先级高于此文件

# 监听地址：:: 同时监听 IPv4 / IPv6；0.0.0.0 仅 IPv4；127.0.0.1 仅本机
HOST=::

# 服务端口
PORT=55555

# 通过 HTTP 访问时设为 false，否则浏览器可能不会保存登录 Cookie
COOKIE_SECURE=false

# 数据目录，留空则使用程序同目录下的 app_data
# HELLO_DATA_DIR=D:\\hello-data

# 反向代理时解析真实客户端 IP
# TRUST_PROXY=1
`;

function parseEnv(text) {
  const result = [];

  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/i, '');
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    result.push([key, value]);
  }

  return result;
}

if (existsSync(envPath)) {
  for (const [key, value] of parseEnv(readFileSync(envPath, 'utf8'))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
} else if (process.pkg) {
  // 单文件程序首次运行自动生成配置模板，之后直接编辑即可
  try {
    writeFileSync(envPath, TEMPLATE, { encoding: 'utf8', flag: 'wx' });
  } catch {
    // 目录不可写时忽略，使用默认配置
  }
}
