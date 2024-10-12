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
import { copyText, hdOnce } from './utils';

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
  // editor.session.setUseWrapMode(true);
  // 行高亮
  // editor.setHighlightActiveLine(false);
  // 语法检查
  editor.getSession().setUseWorker(false);
  // editor.setTheme('ace/theme/chrome');
  // editor.setTheme('ace/theme/github_dark');
  // 添加 Ctrl+D 快捷键绑定
  editor.commands.addCommand({
    name: 'selectMore',
    bindKey: { win: 'Ctrl-D', mac: 'Command-D' }, // 为 Windows 绑定 Ctrl+D，为 Mac 绑定 Command+D
    exec: function (editor) {
      editor.selectMore(1); // 选择下一个与当前选中内容相同的匹配项
    },
  });
  // 添加 Ctrl+X 快捷键绑定
  editor.commands.addCommand({
    name: 'cutCurrentLine',
    bindKey: { win: 'Ctrl-X', mac: 'Command-X' }, // Windows 使用 Ctrl-X，Mac 使用 Command-X
    exec: async function (editor) {
      const cursorPosition = editor.getCursorPosition();
      const lineNumber = cursorPosition.row;

      // 获取当前行的内容
      const line = editor.session.getLine(lineNumber);
      if (line) {
        // 将当前行内容剪切到剪贴板
        await copyText(line, { stopMsg: true });
      }
      // 删除当前行
      editor.session.removeFullLines(lineNumber, lineNumber);
    },
  });
  let initialContent = '';
  editor.getSession().on(
    'change',
    hdOnce(() => {
      initialContent = editor.getValue();
    })
  );
  // 监听撤销操作
  editor.commands.addCommand({
    name: 'undo',
    bindKey: { win: 'Ctrl-Z', mac: 'Command-Z' },
    exec: function (editor) {
      const currentContent = editor.getValue();

      // 如果当前内容等于初始内容，阻止进一步撤销
      if (currentContent === initialContent) return;

      // 否则，继续执行默认的撤销操作
      editor.undo();
    },
  });
  return editor;
}
