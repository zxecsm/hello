import ace from 'ace-builds';

// 主题：只注册实际用到的两个，未使用的主题不再输出到构建产物
import 'ace-builds/src-noconflict/theme-github_light_default';
import 'ace-builds/src-noconflict/theme-github_dark';

// 语言模式（语法高亮）与代码片段：保持全量注册，仍然按需懒加载
// 用 require.context 代替 ace-builds/webpack-resolver，避免它把全部主题一起打进来
// 产物统一放到 assets/ace/ 下：目录集中、带 hash，可长期强缓存
const aceSrc = require.context(
  'file-loader?esModule=false&name=assets/ace/[name].[contenthash:8].[ext]!../../../node_modules/ace-builds/src-noconflict',
  false,
  /^\.\/mode-.*\.js$/,
);
const aceSnippets = require.context(
  'file-loader?esModule=false&name=assets/ace/snippets/[name].[contenthash:8].[ext]!../../../node_modules/ace-builds/src-noconflict/snippets',
  false,
  /^\.\/.*\.js$/,
);

const register = (ctx, nameOf) =>
  ctx.keys().forEach((key) => ace.config.setModuleUrl(nameOf(key), ctx(key)));

// ./mode-javascript.js -> ace/mode/javascript
register(aceSrc, (key) => `ace/mode/${key.slice(2, -3).replace(/^mode-/, '')}`);
// ./javascript.js -> ace/snippets/javascript
register(aceSnippets, (key) => `ace/snippets/${key.slice(2, -3)}`);
