import ace from 'ace-builds';
import 'ace-builds/webpack-resolver';
import 'ace-builds/src-noconflict/ext-modelist';

// 获取 modelist
const modelist = ace.require('ace/ext/modelist');
// 皮肤
import 'ace-builds/src-noconflict/theme-chrome';
import 'ace-builds/src-noconflict/theme-github_dark';
// 自动补全
import 'ace-builds/src-noconflict/ext-language_tools';
// 搜索
import 'ace-builds/src-noconflict/ext-searchbox';
// 引用vscode的键盘绑定
import 'ace-builds/src-noconflict/keybinding-vscode.js';
// import { copyText } from './utils';
import localData from '../common/localData';
import _d from '../common/config';

function createEditor(el) {
  const editor = ace.edit(el);
  // 快捷键
  editor.setKeyboardHandler('ace/keyboard/vscode');
  // editor.getSession().setMode('ace/mode/javascript');
  editor.setOptions({
    // 补全
    enableBasicAutocompletion: true, // 启用基本自动完成功能。开启后，编辑器会根据已有的代码提供自动补全建议
    enableSnippets: true, // 简写方式快速插入常用的代码块
    enableLiveAutocompletion: true, // 实时自动完成会根据用户正在输入的内容，动态更新自动补全建议
    fontFamily: _d.codeFontFamily,
  });
  // 未选中复制整行
  editor.setOption('copyWithEmptySelection', true);
  // 空格代替制表符
  editor.setOption('useSoftTabs', true);
  const editorOption = localData.get('editorOption');
  editor.getSession().setTabSize(editorOption.tabSize);
  // 启用滚动动画
  editor.setOption('animatedScroll', editorOption.animatedScroll);
  // 显示不可见字符（例如空格、制表符、换行符）。
  editor.setOption('showInvisibles', editorOption.showInvisibles);
  // 控制折叠部件（如代码折叠标记）是否淡入淡出
  editor.setOption('fadeFoldWidgets', editorOption.fadeFoldWidgets);
  editor.session.setFoldStyle('markbeginend'); // 折叠箭头开始和结尾都显示
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
  editor.setHighlightActiveLine(editorOption.highlightActiveLine);
  // 语法检查
  editor.getSession().setUseWorker(false);
  const style = document.createElement('style');
  style.innerHTML = `
  .ace_editor .ace_marker-layer .ace_active-line {
    background: transparent;
    border: 0.1rem solid var(--color8);
    border-left: none;
    border-right: none;
    box-sizing: border-box;
  }`;
  document.head.appendChild(style);
  // editor.setTheme('ace/theme/github_light_default');
  // editor.setTheme('ace/theme/github_dark');
  // 添加 Ctrl+D 快捷键绑定
  // editor.commands.addCommand({
  //   name: 'selectMore',
  //   bindKey: { win: 'Ctrl-D', mac: 'Command-D' }, // 为 Windows 绑定 Ctrl+D，为 Mac 绑定 Command+D
  //   exec: function (editor) {
  //     editor.selectMore(1); // 选择下一个与当前选中内容相同的匹配项
  //   },
  // });
  // // 添加 Ctrl+X 快捷键绑定
  // editor.commands.addCommand({
  //   name: 'cutCurrentLine',
  //   bindKey: { win: 'Ctrl-X', mac: 'Command-X' }, // Windows 使用 Ctrl-X，Mac 使用 Command-X
  //   exec: async function (editor) {
  //     if (!editor.selection.isEmpty()) {
  //       const selectionRange = editor.getSelectionRange();
  //       // 如果有选中内容，剪切选中的内容
  //       const selectedText = editor.getSelectedText();
  //       if (selectedText) {
  //         // 将选中内容复制到剪贴板
  //         await copyText(selectedText, { stopMsg: true });

  //         // 删除选中的内容
  //         editor.session.replace(selectionRange, '');
  //       }
  //     } else {
  //       // 如果没有选中内容，剪切当前行
  //       const cursorPosition = editor.getCursorPosition();
  //       const lineNumber = cursorPosition.row;

  //       // 获取当前行的内容
  //       const line = editor.session.getLine(lineNumber) || '\n';

  //       // 将当前行内容复制到剪贴板
  //       await copyText(line || '\n', { stopMsg: true });
  //       // 删除当前行
  //       editor.session.removeFullLines(lineNumber, lineNumber);
  //     }
  //   },
  // });

  return editor;
}
const overrides = {
  conf: 'ace/mode/ini',
  cfg: 'ace/mode/ini',
  log: 'ace/mode/text',
  env: 'ace/mode/sh',
  dotenv: 'ace/mode/sh',
  editorconfig: 'ace/mode/ini',
  eslintrc: 'ace/mode/json',
  prettierrc: 'ace/mode/json',
  babelrc: 'ace/mode/json',
  stylelintrc: 'ace/mode/json',
  npmignore: 'ace/mode/gitignore',
  dockerignore: 'ace/mode/gitignore',
  gitattributes: 'ace/mode/ini',
  zshrc: 'ace/mode/sh',
  bashrc: 'ace/mode/sh',
  profile: 'ace/mode/sh',
  dockerfile: 'ace/mode/dockerfile',
};
const aceEditor = {
  modelist,
  createEditor,
  hasUndo(editor) {
    return editor.getSession().getUndoManager().hasUndo();
  },
  hasRedo(editor) {
    return editor.getSession().getUndoManager().hasRedo();
  },
  reset(editor) {
    editor.getSession().getUndoManager().reset();
  },
  setMode(editor, filePath) {
    const idx = filePath.lastIndexOf('.');
    const suffix = idx >= 0 ? filePath.slice(idx + 1) : '';
    editor.session.setMode(
      overrides[suffix.toLowerCase()] || modelist.getModeForPath(filePath).mode,
    );
  },
};

export default aceEditor;
