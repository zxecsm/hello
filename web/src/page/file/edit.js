import $ from 'jquery';
import aceEditor from '../../js/utils/editor';
import {
  ContentScroll,
  _myOpen,
  debounce,
  getTextSize,
  isDarkMode,
  percentToValue,
} from '../../js/utils/utils';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import { reqFileSaveFile } from '../../api/file';
import bus from '../../js/utils/bus';
import rMenu from '../../js/plugins/rightMenu';
import _path from '../../js/utils/path';
import { setEditor } from '../edit/setEditor';
import _d from '../../js/common/config';
import { percentBar } from '../../js/plugins/percentBar';
import cacheFile from '../../js/utils/cacheFile';
import localData from '../../js/common/localData';
const $editFile = $('.edit_file');
const $container = $('#app .container');
let oText = '';
let originText = '';
let readOnly = false;
const editor = aceEditor.createEditor($editFile.find('.editor')[0]);
let fileFontSize = localData.get('fileFontSize');
export function editFileIsHiden() {
  return $editFile.is(':hidden');
}
// 切换黑暗模式
function changeTheme(dark) {
  if (dark === 'y') {
    editor.setTheme('ace/theme/github_dark');
  } else if (dark === 'n') {
    editor.setTheme('ace/theme/chrome');
  } else if (dark === 's') {
    if (isDarkMode()) {
      editor.setTheme('ace/theme/github_dark');
    } else {
      editor.setTheme('ace/theme/chrome');
    }
  }
}
let filePath = '';
window.changeTheme = changeTheme;
changeTheme(localData.get('dark'));

export function setReadOnly(val) {
  readOnly = val;
  // editor.setReadOnly(readOnly);
}
// 编辑文件
export function openFile(text, path) {
  path = _path.normalize(path);
  hideContainer();
  filePath = path;
  $editFile.css('display', 'flex');
  document.documentElement.classList.add('notScroll');
  renderTitle(path);
  setTextType(_path.extname(path)[2]);
  originText = oText = text;
  editor.setValue(text);
  editor.gotoLine(1);
  aceEditor.reset(editor);
  switchUndoState();
  if (text === '') {
    editor.focus();
  }
}
// 生成标题
function renderTitle(path) {
  editTitleContentScroll.init(path);
}

const typeMappings = {
  abap: 'abap',
  abc: 'abc',
  as: 'actionscript',
  ada: 'ada',
  apache: 'apache_conf',
  apex: 'apex',
  applescript: 'applescript',
  adoc: 'asciidoc',
  asciidoc: 'asciidoc',
  asm: 'assembly_x86',
  s: 'assembly_x86',
  ahk: 'autohotkey',
  bat: 'batchfile',
  cmd: 'batchfile',
  c: 'c_cpp',
  cpp: 'c_cpp',
  h: 'c_cpp',
  hpp: 'c_cpp',
  cc: 'c_cpp',
  hh: 'c_cpp',
  m: 'objectivec', // Objective-C
  mm: 'objectivec', // Objective-C++
  clj: 'clojure',
  cljs: 'clojure',
  cljc: 'clojure',
  cob: 'cobol',
  cbl: 'cobol',
  coffee: 'coffee',
  litcoffee: 'coffee',
  cr: 'crystal',
  cs: 'csharp',
  css: 'css',
  d: 'd',
  dart: 'dart',
  diff: 'diff',
  patch: 'diff',
  dockerfile: 'dockerfile',
  ex: 'elixir',
  exs: 'elixir',
  elm: 'elm',
  erl: 'erlang',
  hrl: 'erlang',
  f90: 'fortran',
  f95: 'fortran',
  f: 'fortran',
  fs: 'fsharp',
  gitignore: 'gitignore',
  glsl: 'glsl',
  go: 'golang',
  groovy: 'groovy',
  haml: 'haml',
  hbs: 'handlebars',
  handlebars: 'handlebars',
  hs: 'haskell',
  hx: 'haxe',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  ini: 'ini',
  cfg: 'ini',
  io: 'io',
  java: 'java',
  jsp: 'jsp',
  js: 'javascript',
  jsx: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  jl: 'julia',
  tex: 'latex',
  bib: 'bibtex',
  less: 'less',
  liquid: 'liquid',
  lisp: 'lisp',
  cl: 'lisp',
  el: 'lisp',
  log: 'text',
  lua: 'lua',
  mk: 'makefile',
  makefile: 'makefile',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
  nginx: 'nginx',
  nginxconf: 'nginx',
  nim: 'nim',
  nix: 'nix',
  ocaml: 'ocaml',
  ml: 'ocaml',
  pas: 'pascal',
  pp: 'pascal',
  pl: 'perl',
  pm: 'perl',
  php: 'php',
  phtml: 'php',
  powershell: 'powershell',
  ps1: 'powershell',
  prisma: 'prisma',
  properties: 'properties',
  proto: 'protobuf',
  py: 'python',
  pyw: 'python',
  r: 'r',
  raku: 'perl6',
  perl6: 'perl6',
  rake: 'ruby',
  rb: 'ruby',
  erb: 'rhtml',
  rs: 'rust',
  sass: 'sass',
  scss: 'scss',
  scala: 'scala',
  scheme: 'scheme',
  sh: 'sh',
  bash: 'sh',
  zsh: 'sh',
  fish: 'sh',
  slim: 'slim',
  styl: 'stylus',
  stylus: 'stylus',
  sql: 'sql',
  sqlite: 'sql',
  tcl: 'tcl',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'typescript',
  txt: 'text',
  text: 'text',
  csv: 'text',
  tsv: 'text',
  vb: 'vbscript',
  vbs: 'vbscript',
  v: 'verilog',
  vhd: 'vhdl',
  vim: 'vim',
  vue: 'html',
  wasm: 'wasm',
  xml: 'xml',
  svg: 'xml',
  rss: 'xml',
  atom: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zig: 'zig',

  // config files
  dotenv: 'sh',
  env: 'sh',
  babelrc: 'json',
  eslintrc: 'json',
  prettierrc: 'json',
  stylelintrc: 'json',
  npmignore: 'gitignore',
  gitattributes: 'gitignore',
  hgignore: 'gitignore',
  editorconfig: 'ini',
};

function setTextType(type) {
  const normalizedType = type.toLowerCase();
  aceEditor.setMode(editor, typeMappings[normalizedType] || normalizedType);
}
// 初始化
function init() {
  editor.setValue('');
  oText = '';
  saveState();
}
$editFile.on('keydown', function (e) {
  let key = e.key,
    ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && key === 's') {
    e.preventDefault();
    hdSave();
  }
});
// 切换保存状态
function saveState() {
  if (readOnly) return;
  if (oText === editor.getValue()) {
    $editFile.find('.head_btn .save').css('display', 'none');
  } else {
    $editFile.find('.head_btn .save').css('display', 'block');
  }
}
function switchUndoState() {
  if (aceEditor.hasUndo(editor)) {
    $editFile.find('.head_btn .undo').removeClass('deactive');
  } else {
    $editFile.find('.head_btn .undo').addClass('deactive');
  }
  if (aceEditor.hasRedo(editor)) {
    $editFile.find('.head_btn .redo').removeClass('deactive');
  } else {
    $editFile.find('.head_btn .redo').addClass('deactive');
  }
}
editor.getSession().on('change', saveState);
editor.getSession().on('change', debounce(switchUndoState, 1000));
$editFile.find('.editor').css({
  'font-size': percentToValue(12, 30, fileFontSize),
});
// 文件列表显示/隐藏
function hideContainer() {
  $container.css('visibility', 'hidden');
}
function showContainer() {
  $container.css('visibility', 'visible');
}
const editTitleContentScroll = new ContentScroll(
  $editFile.find('.head_btn .text .scroll_text')[0]
);
// 设置
function settingMenu(e) {
  const data = [
    { id: 'size', text: '字体大小', beforeIcon: 'iconfont icon-font-size' },
    {
      id: 'setEditor',
      text: '编辑器配置',
      beforeIcon: 'iconfont icon-liebiao',
    },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ e, id }) => {
      if (id === 'size') {
        percentBar(e, fileFontSize, (percent) => {
          $editFile.find('.editor').css({
            'font-size': percentToValue(12, 30, percent),
          });
          fileFontSize = percent;
          localData.set('fileFontSize', fileFontSize, 200);
        });
      } else if (id === 'setEditor') {
        setEditor(e, editor, () => {
          saveState();
        });
      }
    },
    '设置'
  );
}
$editFile
  .find('.head_btn')
  .on('click', '.setting', settingMenu)
  .on('click', '.to_note', async () => {
    const text = editor.getValue();
    if (text === '') {
      _msg.error('文本为空');
      return;
    }
    await cacheFile.setData('newNote', text);
    _myOpen('/edit#new', '新笔记');
  })
  .on('click', '.close', function (e) {
    if (readOnly) {
      hdClose();
      return;
    }
    if (editor.getValue() != oText) {
      _pop(
        {
          e,
          text: '文件未保存，确认关闭吗？',
        },
        (type) => {
          if (type === 'confirm') {
            hdClose();
          }
        }
      );
    } else {
      hdClose();
    }
  })
  .on('click', '.save', hdSave)
  .on('click', '.undo', () => {
    editor.undo();
  })
  .on('click', '.redo', () => {
    editor.redo();
  });
// 保存文件
async function hdSave() {
  if (readOnly) return;
  try {
    const text = editor.getValue();
    if (text === oText) return;
    if (getTextSize(text) > _d.fieldLenght.textFileSize) {
      _msg.error('文本内容过长');
      return;
    }
    const res = await reqFileSaveFile({ path: filePath, text });
    if (res.code === 1) {
      _msg.success(res.codeText);
      oText = text;
      saveState();
    }
  } catch {}
}

function hdClose() {
  showContainer();
  editTitleContentScroll.close();
  if (originText != oText) {
    bus.emit('refreshList');
  }
  $editFile.hide();
  document.documentElement.classList.remove('notScroll');
  init();
}
