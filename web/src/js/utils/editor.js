import ace from 'ace-builds';
// import 'ace-builds/webpack-resolver';
// import 'ace-builds/src-min-noconflict/ext-language_tools';

// 皮肤
import 'ace-builds/src-noconflict/theme-chrome';
import 'ace-builds/src-noconflict/theme-github_dark';
// 自动补全
import 'ace-builds/src-noconflict/ext-language_tools';
// 搜索
import 'ace-builds/src-noconflict/ext-searchbox';
// 语法高亮
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/snippets/javascript.js';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/snippets/typescript.js';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/snippets/markdown.js';
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/snippets/yaml.js';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/snippets/html.js';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/snippets/json.js';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/snippets/text.js';
import 'ace-builds/src-noconflict/mode-less';
import 'ace-builds/src-noconflict/snippets/less.js';
import 'ace-builds/src-noconflict/mode-nginx';
import 'ace-builds/src-noconflict/snippets/nginx.js';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/snippets/sql.js';
import 'ace-builds/src-noconflict/mode-sh';
import 'ace-builds/src-noconflict/snippets/sh.js';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/snippets/css.js';

export default function createEditer(el) {
  const editor = ace.edit(el, {
    tabSize: 2,
  });
  // editor.getSession().setMode('ace/mode/javascript');
  editor.setOptions({
    // 补全
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true,
  });
  // 打印边距
  editor.setShowPrintMargin(false);
  // 关闭行号
  // editor.setOption('showGutter',false)
  // 自动换行
  editor.session.setUseWrapMode(true);
  // 行高亮
  // editor.setHighlightActiveLine(false);
  // 语法检查
  editor.getSession().setUseWorker(false);
  // editor.setTheme('ace/theme/chrome');
  // editor.setTheme('ace/theme/github_dark');
  // editor.commands.addCommand({
  //   name: 'myCommand',
  //   bindKey: { win: 'Ctrl-M', mac: 'Command-M' },
  //   exec: function (editor) {
  //     console.log(777);
  //   },
  // });
  return editor;
}
