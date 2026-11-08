#!/usr/bin/env node
/**
 * hello 项目 API 命令行客户端（零依赖，Node 18+）
 *
 * 配置文件（可选）：hello.config.json（与本脚本同目录）
 *   { "baseUrl": "http://localhost:55555", "username": "admin", "password": "******" }
 *
 * 环境变量优先级高于配置文件：
 *   HELLO_BASE_URL / HELLO_USERNAME / HELLO_PASSWORD / HELLO_SESSION_FILE
 *
 * 登录态保存在本目录 .hello-session.json（已加入 .gitignore），不要提交。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(__dirname, 'hello.config.json');
const ENV_FILE = process.env.HELLO_ENV_FILE || path.join(__dirname, '.env');
const SESSION_FILE = process.env.HELLO_SESSION_FILE || path.join(__dirname, '.hello-session.json');
const DEFAULT_BASE_URL = 'http://localhost:55555';

function readJson(file, fallback) {
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// 解析 .env（支持 # 注释、export 前缀、单/双引号）
function loadEnvFile(file) {
  const result = {};
  try {
    const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    for (const line of text.split(/\r?\n/)) {
      const item = line.trim();
      if (!item || item.startsWith('#')) continue;
      const eq = item.indexOf('=');
      if (eq <= 0) continue;
      const key = item.slice(0, eq).trim().replace(/^export\s+/i, '');
      let value = item.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  } catch {
    /* 文件不存在时忽略 */
  }
  return result;
}

const fileConfig = readJson(CONFIG_FILE, {});
const envFile = loadEnvFile(ENV_FILE);

// 优先级：进程环境变量 > .env > hello.config.json
function pickValue(envKey, fileKey) {
  if (process.env[envKey]) return { value: process.env[envKey], source: `环境变量 ${envKey}` };
  if (envFile[envKey]) return { value: envFile[envKey], source: `.env 的 ${envKey}` };
  if (fileConfig[fileKey] !== undefined && fileConfig[fileKey] !== '') {
    return { value: fileConfig[fileKey], source: `hello.config.json 的 ${fileKey}` };
  }
  return { value: '', source: '' };
}

const urlCfg = pickValue('HELLO_BASE_URL', 'baseUrl');
const userCfg = pickValue('HELLO_USERNAME', 'username');
const passCfg = pickValue('HELLO_PASSWORD', 'password');
const cookieCfg = pickValue('HELLO_COOKIE', 'cookie');
const cookieFileCfg = pickValue('HELLO_COOKIE_FILE', 'cookieFile');

const config = {
  baseUrl: urlCfg.value,
  username: userCfg.value,
  password: passCfg.value,
  cookie: cookieCfg.value,
  cookieFile: cookieFileCfg.value,
  sources: {
    baseUrl: urlCfg.source,
    cookie: cookieCfg.source,
    cookieFile: cookieFileCfg.source,
  },
};

// 全局命令行选项
const argv = process.argv.slice(2);
const opts = {
  url: '',
  query: [],
  data: undefined,
  set: [],
  out: '',
  yes: false,
  full: false,
  json: false,
  page: 1,
  size: 0,
  word: '',
  group: '',
  type: '',
  path: '/',
  name: '',
  newName: '',
  title: '',
  content: '',
  text: '',
  file: '',
  link: '',
  des: '',
  id: [],
  start: '',
  end: '',
  key: '',
  cookie: '',
  cookieFile: '',
  showUrl: false,
  to: '',
  force: 0,
  sort: 'time',
  sub: 0,
  collect: 0,
};

const POSITIONAL = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (!arg.startsWith('--')) {
    POSITIONAL.push(arg);
    continue;
  }
  const raw = arg.slice(2);
  const eq = raw.indexOf('=');
  const key = eq === -1 ? raw : raw.slice(0, eq);
  let value = eq === -1 ? undefined : raw.slice(eq + 1);
  const take = () => {
    if (value !== undefined) return value;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) return true;
    i++;
    return next;
  };

  switch (key) {
    case 'url':
      opts.url = String(take());
      break;
    case 'query': {
      const v = String(take());
      const p = v.indexOf('=');
      if (p === -1) opts.query.push([v, '']);
      else opts.query.push([v.slice(0, p), v.slice(p + 1)]);
      break;
    }
    case 'data':
      opts.data = String(take());
      break;
    case 'set':
      opts.set.push(String(take()));
      break;
    case 'out':
      opts.out = String(take());
      break;
    case 'yes':
    case 'y':
      opts.yes = true;
      break;
    case 'full':
      opts.full = true;
      break;
    case 'json':
      opts.json = true;
      break;
    case 'page':
      opts.page = Number(take());
      break;
    case 'size':
      opts.size = Number(take());
      break;
    case 'word':
      opts.word = String(take());
      break;
    case 'group':
      opts.group = String(take());
      break;
    case 'type':
      opts.type = String(take());
      break;
    case 'path':
      opts.path = String(take());
      break;
    case 'name':
      opts.name = String(take());
      break;
    case 'new-name':
    case 'newName':
      opts.newName = String(take());
      break;
    case 'title':
      opts.title = String(take());
      break;
    case 'content':
      opts.content = String(take());
      break;
    case 'text':
      opts.text = String(take());
      break;
    case 'file':
      opts.file = String(take());
      break;
    case 'link':
      opts.link = String(take());
      break;
    case 'des':
      opts.des = String(take());
      break;
    case 'id':
      opts.id.push(String(take()));
      break;
    case 'start':
      opts.start = String(take());
      break;
    case 'end':
      opts.end = String(take());
      break;
    case 'key':
      opts.key = String(take());
      break;
    case 'cookie':
      opts.cookie = String(take());
      break;
    case 'cookie-file':
      opts.cookieFile = String(take());
      break;
    case 'show-url':
      opts.showUrl = true;
      break;
    case 'to':
      opts.to = String(take());
      break;
    case 'force':
      opts.force = 1;
      break;
    case 'sort':
      opts.sort = String(take());
      break;
    case 'sub':
      opts.sub = 1;
      break;
    case 'collect':
      opts.collect = 1;
      break;
    case 'help':
    case 'h':
      help();
      process.exit(0);
      break;
    default:
      fail(`未知参数 --${key}，用 --help 查看用法`);
  }
}

function fail(message, code = 1) {
  console.error(`✖ ${message}`);
  process.exit(code);
}

function baseUrl() {
  return (opts.url || config.baseUrl || loadSession().baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

// 默认隐藏主机名，避免地址被带进模型上下文；--show-url 可显示完整地址
function maskUrl(value) {
  if (opts.showUrl) return value;
  try {
    const url = new URL(value);
    const host = url.hostname;
    let masked;
    if (host.length <= 6) masked = `${host[0] || ''}***`;
    else masked = `${host.slice(0, 4)}***${host.slice(-3)}`;
    return `${url.protocol}//${masked}${url.port ? `:${url.port}` : ''}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return '(无效地址)';
  }
}

function loadSession() {
  return readJson(SESSION_FILE, {});
}

function saveSession(data) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// 支持直接粘贴浏览器里的 Cookie，也支持 "Cookie: token=..." 整行、curl 复制内容
function normalizeCookie(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (/^cookie\s*:/i.test(s)) s = s.replace(/^cookie\s*:/i, '').trim();
  s = s
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(' ');
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

function readCookieFile(file) {
  try {
    return normalizeCookie(fs.readFileSync(file, 'utf8'));
  } catch {
    fail(`无法读取 Cookie 文件：${file}`);
  }
}

// 返回 Cookie 值和来源，但绝不打印值本身
function cookieInfo() {
  if (opts.cookie) return { value: normalizeCookie(opts.cookie), source: '--cookie' };
  if (opts.cookieFile) return { value: readCookieFile(opts.cookieFile), source: '--cookie-file' };
  if (config.cookie) return { value: normalizeCookie(config.cookie), source: config.sources.cookie };
  if (config.cookieFile) return { value: readCookieFile(config.cookieFile), source: config.sources.cookieFile };
  return { value: '', source: '' };
}

function resolveCookie() {
  return cookieInfo().value;
}

function cookieFromSetCookie(setCookies) {
  if (!setCookies || setCookies.length === 0) return '';
  const jar = new Map();
  const old = loadSession().cookie || '';
  for (const item of old.split(';')) {
    const t = item.trim();
    if (!t) continue;
    const p = t.indexOf('=');
    if (p > 0) jar.set(t.slice(0, p), t.slice(p + 1));
  }
  for (const sc of setCookies) {
    const first = sc.split(';')[0];
    const p = first.indexOf('=');
    if (p <= 0) continue;
    const name = first.slice(0, p).trim();
    const value = first.slice(p + 1).trim();
    if (value === '' || /Expires=Thu, 01 Jan 1970/i.test(sc)) jar.delete(name);
    else jar.set(name, value);
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function request(method, apiPath, { query, body, binary = false, saveTo = '' } = {}) {
  const url = new URL(/^https?:\/\//.test(apiPath) ? apiPath : baseUrl() + apiPath);
  for (const [k, v] of query || []) url.searchParams.set(k, v);
  if (opts.query.length) for (const [k, v] of opts.query) url.searchParams.set(k, v);

  const headers = { Accept: 'application/json' };
  let session = loadSession();

  // 显式传入的 Cookie 优先，并记住它，后续命令无需重复传
  const suppliedCookie = resolveCookie();
  let changed = false;
  if (suppliedCookie && suppliedCookie !== session.cookie) {
    session = { ...session, cookie: suppliedCookie };
    changed = true;
  }
  if (!session.temid) {
    session = { ...session, temid: crypto.randomBytes(8).toString('hex') };
    changed = true;
  }
  if (changed) saveSession(session);

  headers['x-tem-id'] = session.temid;
  if (session.cookie) headers.Cookie = session.cookie;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: payload,
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    fail(
      `请求失败：${maskUrl(url.href)}\n${error.message}\n` +
        '请检查 .env 里的 HELLO_BASE_URL 是否正确；需要看完整地址时加 --show-url。',
    );
  }

  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (setCookies.length > 0) {
    const cookie = cookieFromSetCookie(setCookies);
    if (cookie) saveSession({ ...session, baseUrl: baseUrl(), cookie, updatedAt: new Date().toISOString() });
  }

  const contentType = res.headers.get('content-type') || '';
  if (binary || !contentType.includes('application/json')) {
    const buffer = Buffer.from(await res.arrayBuffer());
    if (saveTo) {
      fs.mkdirSync(path.dirname(path.resolve(saveTo)), { recursive: true });
      fs.writeFileSync(saveTo, buffer);
      console.log(`已保存 ${buffer.length} 字节 -> ${path.resolve(saveTo)}`);
      return null;
    }
    if (!res.ok) fail(`HTTP ${res.status} ${res.statusText}：${buffer.toString('utf8').slice(0, 500)}`);
    console.log(
      `二进制响应：HTTP ${res.status}，Content-Type: ${contentType || '(未知)'}，大小: ${buffer.length} 字节\n` +
        '如需保存请加 --out <文件路径>。',
    );
    return null;
  }

  const json = await res.json();
  if (json.code === 2) {
    fail(
      `未登录或登录态已过期（${json.codeText || 'unauthorized'}）。\n` +
        `请更新 ${ENV_FILE} 里的 HELLO_COOKIE，或执行 node ${relScript()} use-cookie 保存新 Cookie。`,
    );
  }
  return json;
}

function relScript() {
  return path.relative(process.cwd(), fileURLToPath(import.meta.url)) || 'hello.mjs';
}

function printResult(result) {
  if (result === null) return;
  if (result.code === 0) process.exitCode = 1;
  if (opts.json || opts.full || result.code !== 1) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(JSON.stringify(result.data, null, 2));
}

function requireLogin() {
  if (!loadSession().cookie && !resolveCookie()) {
    fail(
      `尚未配置登录 Cookie。\n` +
        `推荐：把地址和 Cookie 写进 ${ENV_FILE}（模板见 .env.example），然后执行 config 检查。\n` +
        `也可以临时用 --cookie "token=..." --url https://你的域名。`,
    );
  }
}

function destructive(desc) {
  if (opts.yes) return;
  console.error(`⚠ 这是删除/清空操作：${desc}`);
  console.error('确认后重试并加 --yes。智能体必须先向用户确认，不要自行加 --yes。');
  process.exit(2);
}

function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

function setDeep(target, key, rawValue) {
  let value = rawValue;
  if (rawValue === 'true') value = true;
  else if (rawValue === 'false') value = false;
  else if (rawValue === 'null') value = null;
  else if (/^[[{]/.test(rawValue)) {
    try {
      value = JSON.parse(rawValue);
    } catch {
      value = rawValue;
    }
  }

  const parts = key.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (cur[part] === undefined || typeof cur[part] !== 'object') {
      cur[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

function buildBody() {
  if (opts.set.length > 0) {
    const body = {};
    for (const pair of opts.set) {
      const p = pair.indexOf('=');
      if (p <= 0) fail(`--set 格式应为 key=value：${pair}`);
      setDeep(body, pair.slice(0, p), pair.slice(p + 1));
    }
    return body;
  }
  if (opts.data === undefined) return undefined;
  if (opts.data.startsWith('@')) {
    const body = readJson(opts.data.slice(1), undefined);
    if (body === undefined) fail(`无法读取或解析 --data 文件：${opts.data}`);
    return body;
  }
  try {
    return JSON.parse(opts.data);
  } catch (error) {
    fail(`--data 不是合法 JSON：${error.message}\nWindows PowerShell 建议改用 --file 或 --set key=value`);
  }
}

function pageQuery() {
  const q = [['pageNo', String(opts.page)]];
  if (opts.size) q.push(['pageSize', String(opts.size)]);
  return q;
}

function pageBody(extra = {}) {
  return { pageNo: opts.page, pageSize: opts.size || 20, ...extra };
}

/* ------------------------------ 命令实现 ------------------------------ */

const commands = {
  async login() {
    if (!config.username) fail('缺少用户名：设置 HELLO_USERNAME，或在 hello.config.json 写 username');
    if (!config.password) fail('缺少密码：设置 HELLO_PASSWORD，或在 hello.config.json 写 password');
    const result = await request('POST', '/api/user/login', {
      body: { username: config.username, password: config.password },
    });
    if (result.code === 1 && result.data && result.data.needCaptcha) {
      console.error('⚠ 需要图形/滑块验证码，命令行无法完成。');
      console.error('请在浏览器登录一次，或让管理员在页面完成验证后重试。');
      process.exit(3);
    }
    printResult(result);
    if (result.code === 1) {
      const session = loadSession();
      saveSession({ ...session, baseUrl: baseUrl(), username: config.username });
      console.error('登录成功，登录态已保存到 ' + SESSION_FILE);
    }
  },

  async logout() {
    const result = await request('POST', '/api/user/logout', { body: { other: 0 } });
    try {
      fs.rmSync(SESSION_FILE, { force: true });
    } catch {
      /* ignore */
    }
    printResult(result);
  },

  // 直接使用浏览器里复制出来的 Cookie（远程实例推荐）
  async 'use-cookie'() {
    const cookie = resolveCookie();
    if (!cookie) {
      fail(
        '缺少 Cookie。用法：node ' +
          relScript() +
          ' use-cookie --cookie "token=..."\n' +
          '也可以设置 HELLO_COOKIE，或用 --cookie-file 指定文件。',
      );
    }
    const previous = loadSession().cookie || '';
    saveSession({ ...loadSession(), baseUrl: baseUrl(), cookie, updatedAt: new Date().toISOString() });
    const result = await request('GET', '/api/user/userinfo');
    printResult(result);
    if (result.code !== 1) {
      saveSession({ ...loadSession(), cookie: previous });
      fail('Cookie 无效或已过期，请从浏览器重新复制 token Cookie');
    }
    console.error(`Cookie 已保存并通过验证：${SESSION_FILE}`);
    console.error(`远程地址：${maskUrl(baseUrl())}`);
  },

  // 查看连接配置状态：只显示来源和长度，不显示 Cookie 明文
  async config() {
    const info = cookieInfo();
    const session = loadSession();
    const effective = info.value || session.cookie || '';
    const output = {
      envFile: ENV_FILE,
      envFileExists: fs.existsSync(ENV_FILE),
      baseUrl: maskUrl(baseUrl()),
      baseUrlSource: opts.url
        ? '--url'
        : config.sources.baseUrl || (session.baseUrl ? '本地会话（上次保存）' : '默认值'),
      cookieSet: Boolean(effective),
      cookieSource: info.source || (session.cookie ? '本地会话（上次保存）' : ''),
      cookieLength: effective.length,
      sessionFile: SESSION_FILE,
      sessionHasCookie: Boolean(session.cookie),
      temid: session.temid || '',
    };
    console.log(JSON.stringify(output, null, 2));
  },

  async whoami() {
    requireLogin();
    printResult(await request('GET', '/api/user/userinfo'));
  },

  async api() {
    const [method, apiPath] = POSITIONAL.slice(1);
    if (!method || !apiPath) fail('用法：hello.mjs api GET /api/bmk/list [--query k=v] [--data JSON|@file] [--set k=v]');
    const body = buildBody();
    if (body !== undefined && ['GET', 'HEAD'].includes(method.toUpperCase())) {
      fail(`${method.toUpperCase()} 请求不能携带 body，改用 --query，或把接口方法改成 POST`);
    }
    printResult(await request(method.toUpperCase(), apiPath, { body, saveTo: opts.out, binary: Boolean(opts.out) }));
  },

  bmk: {
    async groups() {
      requireLogin();
      printResult(await request('GET', '/api/bmk/list'));
    },
    async list() {
      requireLogin();
      const q = opts.group ? [['id', opts.group]] : [];
      printResult(await request('GET', '/api/bmk/list', { query: q }));
    },
    async search() {
      requireLogin();
      if (!opts.word) fail('缺少 --word');
      printResult(
        await request('POST', '/api/bmk/search', {
          body: pageBody({
            word: opts.word,
            category: opts.group ? [opts.group] : [],
          }),
        }),
      );
    },
    async add() {
      requireLogin();
      if (!opts.title || !opts.link) fail('用法：bmk add --title 标题 --link https://... [--des 备注] [--group home]');
      printResult(
        await request('POST', '/api/bmk/add-bmk', {
          body: {
            groupId: opts.group || 'home',
            bms: [{ title: opts.title, link: opts.link, des: opts.des }],
          },
        }),
      );
    },
    async rm() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：bmk rm --id <书签id> [--id ...]');
      destructive(`删除 ${opts.id.length} 个书签（进入回收站）`);
      printResult(await request('POST', '/api/bmk/delete-bmk', { body: { ids: opts.id } }));
    },
    async 'add-group'() {
      requireLogin();
      if (!opts.title) fail('用法：bmk add-group --title 分组名');
      printResult(await request('POST', '/api/bmk/add-group', { body: { title: opts.title } }));
    },
    async 'rm-group'() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：bmk rm-group --id <分组id>');
      destructive(`删除 ${opts.id.length} 个书签分组（进入回收站）`);
      printResult(await request('POST', '/api/bmk/delete-group', { body: { ids: opts.id } }));
    },
  },

  note: {
    async list() {
      requireLogin();
      printResult(
        await request('POST', '/api/note/search', {
          body: pageBody({
            word: opts.word,
            category: opts.group ? [opts.group] : [],
          }),
        }),
      );
    },
    async get() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：note get --id <笔记id>');
      printResult(await request('GET', '/api/note/read', { query: [['v', opts.id[0]]] }));
    },
    async add() {
      requireLogin();
      if (!opts.title) fail('用法：note add --title 标题 [--content Markdown | --file 本地.md]');
      const content = opts.file ? fs.readFileSync(opts.file, 'utf8') : opts.content || '';
      printResult(
        await request('POST', '/api/note/edit', {
          body: { id: randomId(), title: opts.title, content },
        }),
      );
    },
    async set() {
      requireLogin();
      if (opts.id.length === 0 || !opts.title) fail('用法：note set --id <id> --title 标题 [--content ...]');
      const content = opts.file ? fs.readFileSync(opts.file, 'utf8') : opts.content;
      const body = { id: opts.id[0], title: opts.title };
      if (content !== undefined) body.content = content;
      printResult(await request('POST', '/api/note/edit', { body }));
    },
    async rm() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：note rm --id <笔记id> [--id ...]');
      destructive(`删除 ${opts.id.length} 篇笔记（进入回收站，about/tips 不可删）`);
      printResult(await request('POST', '/api/note/delete', { body: { ids: opts.id } }));
    },
    async categories() {
      requireLogin();
      printResult(await request('GET', '/api/note/category'));
    },
    async 'add-category'() {
      requireLogin();
      if (!opts.title) fail('用法：note add-category --title 分类名');
      printResult(await request('POST', '/api/note/add-category', { body: { title: opts.title } }));
    },
  },

  todo: {
    async list() {
      requireLogin();
      printResult(await request('GET', '/api/todo/list', { query: pageQuery() }));
    },
    async add() {
      requireLogin();
      if (!opts.content) fail('用法：todo add --content 内容');
      printResult(await request('POST', '/api/todo/add', { body: { content: opts.content } }));
    },
    async done() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：todo done --id <id> [--id ...]');
      printResult(await request('POST', '/api/todo/state', { body: { ids: opts.id, state: 0 } }));
    },
    async undo() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：todo undo --id <id> [--id ...]');
      printResult(await request('POST', '/api/todo/state', { body: { ids: opts.id, state: 1 } }));
    },
    async rm() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：todo rm --id <id> [--id ...]');
      destructive(`删除 ${opts.id.length} 条待办`);
      printResult(await request('POST', '/api/todo/delete', { body: { ids: opts.id } }));
    },
  },

  count: {
    async list() {
      requireLogin();
      printResult(await request('GET', '/api/count/list', { query: pageQuery() }));
    },
    async add() {
      requireLogin();
      if (!opts.title || !opts.start || !opts.end)
        fail('用法：count add --title 标题 --start 2026-01-01 --end 2026-12-31 [--link https://...]');
      printResult(
        await request('POST', '/api/count/add', {
          body: { title: opts.title, start: opts.start, end: opts.end, link: opts.link },
        }),
      );
    },
    async rm() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：count rm --id <id> [--id ...]');
      destructive(`删除 ${opts.id.length} 个倒计时`);
      printResult(await request('POST', '/api/count/delete', { body: { ids: opts.id } }));
    },
  },

  file: {
    async ls() {
      requireLogin();
      printResult(
        await request('POST', '/api/file/read-dir', {
          body: {
            path: opts.path,
            pageNo: opts.page,
            pageSize: opts.size || 50,
            sortType: opts.sort,
            word: opts.word,
            subDir: opts.sub,
          },
        }),
      );
    },
    async cat() {
      requireLogin();
      if (!opts.path || opts.path === '/') fail('用法：file cat --path /notes/a.md');
      printResult(await request('POST', '/api/file/read-file', { body: { path: opts.path } }));
    },
    async write() {
      requireLogin();
      if (!opts.path) fail('用法：file write --path /a.txt [--text 内容 | --file 本地文件]');
      const text = opts.file ? fs.readFileSync(opts.file, 'utf8') : opts.text;
      if (text === undefined) fail('缺少内容：--text 或 --file');
      printResult(await request('POST', '/api/file/save-file', { body: { path: opts.path, text } }));
    },
    async mkdir() {
      requireLogin();
      if (!opts.name) fail('用法：file mkdir --path /上级目录 --name 新目录');
      printResult(
        await request('POST', '/api/file/create-dir', {
          body: { path: opts.path, name: opts.name },
        }),
      );
    },
    async mv() {
      requireLogin();
      if (!opts.name || !opts.newName) fail('用法：file mv --path /目录 --name 旧名 --new-name 新名 --type file|dir');
      printResult(
        await request('POST', '/api/file/rename', {
          body: {
            name: opts.newName,
            data: {
              name: opts.name,
              path: opts.path,
              type: opts.type === 'dir' ? 'dir' : 'file',
            },
          },
        }),
      );
    },
    async rm() {
      requireLogin();
      if (!opts.name) fail('用法：file rm --path /目录 --name 名称 --type file|dir [--force]');
      destructive(`删除 ${opts.path}/${opts.name}${opts.force ? '（永久删除）' : '（移入回收站）'}`);
      printResult(
        await request('POST', '/api/file/delete', {
          body: {
            force: opts.force,
            data: [
              {
                name: opts.name,
                path: opts.path,
                type: opts.type === 'dir' ? 'dir' : 'file',
              },
            ],
          },
        }),
      );
    },
  },

  share: {
    async list() {
      requireLogin();
      printResult(await request('GET', '/api/user/share-list', { query: pageQuery() }));
    },
    async rm() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：share rm --id <分享id> [--id ...]');
      destructive(`删除 ${opts.id.length} 条分享记录`);
      printResult(await request('POST', '/api/user/delete-share', { body: { ids: opts.id } }));
    },
  },

  task: {
    async info() {
      requireLogin();
      if (!opts.key) fail('用法：task info --key <任务key>');
      printResult(await request('POST', '/api/task/info', { body: { key: opts.key } }));
    },
    async cancel() {
      requireLogin();
      if (!opts.key) fail('用法：task cancel --key <任务key>');
      printResult(await request('POST', '/api/task/cancel', { body: { key: opts.key } }));
    },
    async list() {
      requireLogin();
      printResult(await request('POST', '/api/task/list'));
    },
  },

  trash: {
    async list() {
      requireLogin();
      if (!opts.type) fail('用法：trash list --type bmk|bmk_group|note|history|ssh');
      printResult(
        await request('GET', '/api/user/trash-list', {
          query: [...pageQuery(), ['type', opts.type], ['word', opts.word]],
        }),
      );
    },
    async recover() {
      requireLogin();
      if (!opts.type || opts.id.length === 0) fail('用法：trash recover --type note --id <id>');
      printResult(
        await request('POST', '/api/user/recover-trash', {
          body: { type: opts.type, ids: opts.id },
        }),
      );
    },
    async rm() {
      requireLogin();
      if (!opts.type) fail('用法：trash rm --type note [--id ...]（不传 --id 表示全部清空）');
      destructive(`永久删除回收站中的 ${opts.type} ${opts.id.length ? opts.id.length + ' 条' : '全部'}`);
      printResult(
        await request('POST', '/api/user/delete-trash', {
          body: { type: opts.type, ids: opts.id },
        }),
      );
    },
  },

  bg: {
    async list() {
      requireLogin();
      printResult(
        await request('GET', '/api/bg/list', {
          query: [
            ['type', opts.type || 'bg'],
            ['collect', String(opts.collect)],
            ...pageQuery(),
          ],
        }),
      );
    },
    async set() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：bg set --type bg|bgxs --id <壁纸id>');
      printResult(
        await request('POST', '/api/bg/change', {
          body: { type: opts.type || 'bg', id: opts.id[0] },
        }),
      );
    },
    async collect() {
      requireLogin();
      if (opts.id.length === 0) fail('用法：bg collect --id <壁纸id> [--id ...]');
      printResult(await request('POST', '/api/bg/collect', { body: opts.id, query: [] }));
    },
  },

  music: {
    async list() {
      requireLogin();
      printResult(
        await request('GET', '/api/player/list', {
          query: [['id', opts.group], ...pageQuery()],
        }),
      );
    },
    async search() {
      requireLogin();
      if (!opts.word) fail('用法：music search --word 关键词');
      printResult(await request('GET', '/api/player/search', { query: [['word', opts.word], ['pageNo', String(opts.page)]] }));
    },
    async random() {
      printResult(await request('GET', '/api/music', { binary: true, saveTo: opts.out }));
    },
  },

  chat: {
    async users() {
      requireLogin();
      printResult(
        await request('GET', '/api/chat/user-list', {
          query: [...pageQuery(), ['word', opts.word]],
        }),
      );
    },
    async send() {
      requireLogin();
      if (!opts.to || !opts.content) fail('用法：chat send --to <账号> --content 内容');
      printResult(await request('POST', '/api/chat/send-msg', { body: { to: opts.to, content: opts.content } }));
    },
    async news() {
      requireLogin();
      printResult(await request('GET', '/api/chat/news'));
    },
  },

  admin: {
    async users() {
      requireLogin();
      printResult(
        await request('GET', '/api/root/user-list', {
          query: [...pageQuery(), ['word', opts.word]],
        }),
      );
    },
    async status() {
      requireLogin();
      printResult(await request('GET', '/api/root/sys-status'));
    },
    async logs() {
      requireLogin();
      printResult(await request('GET', '/api/root/log-list'));
    },
  },

  pub: {
    async echo() {
      const body = buildBody() || {};
      printResult(await request('POST', '/api/echo', { body }));
    },
    async icon() {
      if (!opts.link) fail('用法：pub icon --link google.com [--out icon.png]');
      printResult(
        await request('GET', '/api/icon', {
          query: [['u', opts.link]],
          binary: true,
          saveTo: opts.out,
        }),
      );
    },
    async 'site-info'() {
      if (!opts.link) fail('用法：pub site-info --link https://example.com');
      printResult(await request('GET', '/api/site-info', { query: [['u', opts.link]] }));
    },
  },
};

// 兼容别名：cookie = use-cookie
commands.cookie = commands['use-cookie'];

function help() {
  console.log(`hello API 客户端

用法:
  node ${relScript()} <命令> [选项]

连接配置（优先级从高到低）:
  --url <地址>           仅本次生效
  HELLO_BASE_URL         环境变量
  hello.config.json      与本脚本同目录，{"baseUrl":"https://hello.example.com"}
  默认                   ${DEFAULT_BASE_URL}

登录态（远程实例推荐直接用 Cookie）:
  --cookie "token=..."   直接传浏览器里的 Cookie；也可用 HELLO_COOKIE
  --cookie-file <文件>   从文件读取；也可用 HELLO_COOKIE_FILE
  use-cookie             保存并验证 Cookie（别名 cookie），之后命令无需再传
  config                 查看地址/Cookie 是否就绪（默认隐藏地址，不显示 Cookie）
  --show-url             显示完整地址（仅在排错时使用）
  login                  用 HELLO_USERNAME / HELLO_PASSWORD 登录（可选）
  logout                 退出并清除本地登录态
  whoami                 当前用户信息

环境变量文件:
  ${ENV_FILE}
  支持 HELLO_BASE_URL / HELLO_COOKIE / HELLO_COOKIE_FILE / HELLO_USERNAME / HELLO_PASSWORD
  优先级：进程环境变量 > .env > hello.config.json > 本地登录态

通用:
  api <METHOD> <PATH>    调用任意接口，如 api GET /api/bmk/list
                         --query k=v  可重复；--data JSON 或 @file.json
                         --set k=v    可重复，自动组装 JSON（推荐，免去 PowerShell 引号问题）
                         --out 文件   保存二进制响应
  --json / --full        输出完整响应信封
  --yes                  确认删除类操作（智能体须先征得用户同意）

书签:
  bmk groups | bmk list [--group home|<id>]
  bmk search --word <词> [--group <id>] [--page 1] [--size 20]
  bmk add --title <标题> --link <URL> [--des <备注>] [--group home|<id>]
  bmk rm --id <id> [--id ...]
  bmk add-group --title <名称> | bmk rm-group --id <id>

笔记:
  note list [--word <词>] [--group <分类id>] [--page 1] [--size 20]
  note get --id <id> | note add --title <标题> [--content <md> | --file <本地.md>]
  note set --id <id> --title <标题> [--content <md> | --file <本地.md>]
  note rm --id <id> [--id ...]
  note categories | note add-category --title <名称>

待办 / 倒计时:
  todo list | todo add --content <内容> | todo done --id <id> | todo undo --id <id>
  todo rm --id <id> [--id ...]
  count list | count add --title <标题> --start <开始 YYYY-MM-DD> --end <结束 YYYY-MM-DD> [--link URL]
  count rm --id <id> [--id ...]

文件（路径相对当前用户根目录，以 / 开头）:
  file ls [--path /] [--word <词>] [--sort name|time|size|type] [--page 1] [--size 50]
  file cat --path /a.txt
  file write --path /a.txt [--text <内容> | --file <本地文件>]
  file mkdir --path /父目录 --name <目录名>
  file mv --path /目录 --name <旧名> --new-name <新名> [--type dir|file]
  file rm --path /目录 --name <名称> [--type dir|file] [--force]

分享 / 回收站:
  share list | share rm --id <id> [--id ...]
  trash list --type bmk|bmk_group|note|history|ssh [--word <词>]
  trash recover --type <类型> --id <id> [--id ...]
  trash rm --type <类型> [--id ...]   # 不传 --id 表示清空
  task list | task info --key <key> | task cancel --key <key>

壁纸 / 音乐:
  bg list [--type bg|bgxs] [--collect] | bg set --type bg|bgxs --id <id>
  bg collect --id <id> [--id ...]
  music list [--group <歌单id>] | music search --word <词> | music random [--out x.mp3]

聊天 / 管理员 / 公开接口:
  chat users [--word <词>] | chat send --to <账号> --content <内容>
  admin users [--word <词>] | admin status | admin logs
  pub echo [--data '{"k":"v"}'] | pub icon --link <域名> [--out icon.png]
  pub site-info --link <URL>
`);
}

/* ------------------------------ 入口 ------------------------------ */

const command = POSITIONAL[0];
if (!command) {
  help();
  process.exit(0);
}

let node = commands[command];
if (node && typeof node === 'object') {
  const sub = POSITIONAL[1];
  const subNode = sub ? node[sub] : undefined;
  if (!subNode) fail(`未知子命令：${command} ${sub || ''}\n用 --help 查看可用命令`);
  node = subNode;
}
if (typeof node !== 'function') fail(`未知命令：${command}\n用 --help 查看可用命令`);

await node();
