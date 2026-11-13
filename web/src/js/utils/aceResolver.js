import ace from 'ace-builds';

// 主题：只注册实际用到的两个，未使用的主题不再输出到构建产物
import 'ace-builds/src-noconflict/theme-github_light_default';
import 'ace-builds/src-noconflict/theme-github_dark';

// 语言模式（语法高亮）与代码片段：只打包常用的一批，避免把 ace 自带的 190+ 个模式全部输出。
// 正则同时匹配 ./mode-xxx.js 和 ./snippets/xxx.js；
// 需要新增语言时，在这里补上名字即可（名字对应 mode-<name>.js）。
const aceSrc = require.context(
  'file-loader?esModule=false&name=assets/ace/[name].[contenthash:8].[ext]!../../../node_modules/ace-builds/src-noconflict',
  true,
  /^\.\/(?:mode-|snippets\/)?(?:text|plain_text|markdown|latex|rst|javascript|typescript|jsx|tsx|html|css|scss|less|vue|xml|svg|json|json5|yaml|toml|ini|properties|csv|diff|sh|batchfile|powershell|dockerfile|makefile|gitignore|nginx|terraform|protobuf|graphqlschema|python|java|c_cpp|csharp|php|golang|rust|ruby|lua|perl|sql|mysql|pgsql|kotlin|swift|dart|scala|r)\.js$/,
);

// 产物统一放到 assets/ace/ 下：目录集中、带 hash，可长期强缓存
const supportedModes = new Set();
aceSrc.keys().forEach((key) => {
  const isSnippet = key.startsWith('./snippets/');
  const name = key
    .slice(2, -3)
    .replace(/^snippets\//, '')
    .replace(/^mode-/, '');
  // ./mode-javascript.js -> ace/mode/javascript
  // ./snippets/javascript.js -> ace/snippets/javascript
  const moduleName = `ace/${isSnippet ? 'snippets' : 'mode'}/${name}`;
  if (!isSnippet) supportedModes.add(moduleName);
  ace.config.setModuleUrl(moduleName, aceSrc(key));
});

// 当前构建里是否打包了该语言模式，用于过滤语言菜单和未知后缀回退
export const isModeSupported = (mode) => supportedModes.has(mode);
