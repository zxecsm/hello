import localData from '../../js/common/localData';
import rMenu from '../../js/plugins/rightMenu';

export function setEditor(e, editor, cb) {
  let editorOption = {
    animatedScroll: editor.getAnimatedScroll(), // 获取是否启用滚动动画
    showInvisibles: editor.getShowInvisibles(), // 获取是否显示不可见字符
    fadeFoldWidgets: editor.getFadeFoldWidgets(), // 获取折叠部件是否淡入淡出
    newLineMode: editor.getSession().getNewLineMode(), // 获取换行符模式 ("unix", "windows" 或 "auto")
    showGutter: editor.renderer.getOption('showGutter'), // 获取是否显示行号边栏
    useWrapMode: editor.getSession().getUseWrapMode(), // 获取是否启用自动换行
    cursorStyle: editor.getOption('cursorStyle'), // "ace", "slim", "smooth", 或 "wide"
    tabSize: editor.getSession().getTabSize(),
    highlightActiveLine: editor.getOption('highlightActiveLine'),
  };
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        tabSize: {
          beforeText: 'Tab空格：',
          inputType: 'number',
          value: editorOption.tabSize,
          verify(val) {
            return rMenu.validInteger(val) || rMenu.validNumber(val, 1);
          },
        },
        useWrapMode: {
          beforeText: '自动换行：',
          type: 'select',
          value: editorOption.useWrapMode ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        showGutter: {
          beforeText: '显示行号：',
          type: 'select',
          value: editorOption.showGutter ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        highlightActiveLine: {
          beforeText: '高亮当前行：',
          type: 'select',
          value: editorOption.highlightActiveLine ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        fadeFoldWidgets: {
          beforeText: '折叠淡入淡出：',
          type: 'select',
          value: editorOption.fadeFoldWidgets ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        newLineMode: {
          beforeText: '换行符模式：',
          type: 'select',
          value: editorOption.newLineMode,
          selectItem: [
            { value: 'auto', text: '自动' },
            { value: 'windows', text: 'windows' },
            { value: 'unix', text: 'unix' },
          ],
        },
        cursorStyle: {
          beforeText: '光标样式：',
          type: 'select',
          value: editorOption.cursorStyle,
          selectItem: [
            { value: 'ace', text: '默认' },
            { value: 'slim', text: '细条光标' },
            { value: 'smooth', text: '平滑光标' },
            { value: 'wide', text: '宽条光标' },
          ],
        },
        animatedScroll: {
          beforeText: '滚动动画：',
          type: 'select',
          value: editorOption.animatedScroll ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
        showInvisibles: {
          beforeText: '显示不可见字符：',
          type: 'select',
          value: editorOption.showInvisibles ? 'y' : 'n',
          selectItem: [
            { value: 'y', text: '开启' },
            { value: 'n', text: '关闭' },
          ],
        },
      },
    },
    function ({ inp, close, isDiff }) {
      close(1);
      if (!isDiff()) return;
      editorOption = {
        animatedScroll: inp.animatedScroll === 'y',
        showInvisibles: inp.showInvisibles === 'y',
        fadeFoldWidgets: inp.fadeFoldWidgets === 'y',
        newLineMode: inp.newLineMode,
        cursorStyle: inp.cursorStyle,
        showGutter: inp.showGutter === 'y',
        useWrapMode: inp.useWrapMode === 'y',
        tabSize: +inp.tabSize,
        highlightActiveLine: inp.highlightActiveLine === 'y',
      };
      localData.set('editorOption', editorOption);
      // 启用滚动动画
      editor.setOption('animatedScroll', editorOption.animatedScroll);
      // 显示不可见字符（例如空格、制表符、换行符）。
      editor.setOption('showInvisibles', editorOption.showInvisibles);
      // 控制折叠部件（如代码折叠标记）是否淡入淡出
      editor.setOption('fadeFoldWidgets', editorOption.fadeFoldWidgets);
      // 控制换行符的模式
      editor.session.setOption('newLineMode', editorOption.newLineMode);
      // 控制是否启用 Web Worker 来处理代码分析、语法检查等后台任务
      // 关闭行号
      editor.setOption('showGutter', editorOption.showGutter);
      // 自动换行
      editor.session.setUseWrapMode(editorOption.useWrapMode);
      editor.setOption('cursorStyle', editorOption.cursorStyle); // 设置为平滑光标
      editor.getSession().setTabSize(editorOption.tabSize);
      editor.setHighlightActiveLine(editorOption.highlightActiveLine);
      cb && cb();
    },
    '编辑器配置'
  );
}
