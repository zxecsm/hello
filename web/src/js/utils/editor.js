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
import { _getData, copyText } from './utils';

export default function createEditer(el) {
  const editor = ace.edit(el, {
    tabSize: 2,
  });
  // editor.getSession().setMode('ace/mode/javascript');
  editor.setOptions({
    // 补全
    enableBasicAutocompletion: true, // 启用基本自动完成功能。开启后，编辑器会根据已有的代码提供自动补全建议
    enableSnippets: true, // 简写方式快速插入常用的代码块
    enableLiveAutocompletion: true, // 实时自动完成会根据用户正在输入的内容，动态更新自动补全建议
  });
  // 未选中复制整行
  editor.setOption('copyWithEmptySelection', true);
  // 空格代替制表符
  editor.setOption('useSoftTabs', true);
  const editorOption = _getData('editorOption');
  // 启用滚动动画
  editor.setOption('animatedScroll', editorOption.animatedScroll);
  // 显示不可见字符（例如空格、制表符、换行符）。
  editor.setOption('showInvisibles', editorOption.showInvisibles);
  // 控制折叠部件（如代码折叠标记）是否淡入淡出
  editor.setOption('fadeFoldWidgets', editorOption.fadeFoldWidgets);
  // 控制换行符的模式
  editor.session.setOption('newLineMode', editorOption.newLineMode);
  // 关闭行号
  editor.setOption('showGutter', editorOption.showGutter);
  // 自动换行
  editor.session.setUseWrapMode(editorOption.useWrapMode);
  // 光标
  editor.setOption('cursorStyle', editorOption.cursorStyle); // 设置为平滑光标
  // 控制是否启用 Web Worker 来处理代码分析、语法检查等后台任务
  editor.session.setOption('useWorker', true);
  // 打印边距
  editor.setShowPrintMargin(false);
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
      if (!editor.selection.isEmpty()) {
        const selectionRange = editor.getSelectionRange();
        // 如果有选中内容，剪切选中的内容
        const selectedText = editor.getSelectedText();
        if (selectedText) {
          // 将选中内容复制到剪贴板
          await copyText(selectedText, { stopMsg: true });

          // 删除选中的内容
          editor.session.replace(selectionRange, '');
        }
      } else {
        // 如果没有选中内容，剪切当前行
        const cursorPosition = editor.getCursorPosition();
        const lineNumber = cursorPosition.row;

        // 获取当前行的内容
        const line = editor.session.getLine(lineNumber) || '\n';

        // 将当前行内容复制到剪贴板
        await copyText(line || '\n', { stopMsg: true });
        // 删除当前行
        editor.session.removeFullLines(lineNumber, lineNumber);
      }
    },
  });

  return editor;
}

createEditer.hasUndo = function (editor) {
  return editor.getSession().getUndoManager().hasUndo();
};
createEditer.hasRedo = function (editor) {
  return editor.getSession().getUndoManager().hasRedo();
};
createEditer.reset = function (editor) {
  editor.getSession().getUndoManager().reset();
};
