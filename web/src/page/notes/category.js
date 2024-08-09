import $ from 'jquery';
import _d from '../../js/common/config';
import { debounce, encodeHtml, loadingImg, toHide } from '../../js/utils/utils';
import {
  reqNoteAddCategory,
  reqNoteCategory,
  reqNoteDeleteCategory,
  reqNoteEditCategory,
} from '../../api/note';
import _msg from '../../js/plugins/message';
import _pop from '../../js/plugins/popConfirm';
import { setNoteCategoryList } from '.';
import rMenu from '../../js/plugins/rightMenu';
const $categoryBox = $('.category_box');
export function isHideCategoryBox() {
  return $categoryBox.is(':hidden');
}
// 生成列表
export function renderCategoryList() {
  const $list = $categoryBox.find('.list');
  if ($list.children().length === 0) {
    loadingImg($list[0]);
  }
  reqNoteCategory()
    .then((res) => {
      if (res.code == 0) {
        let str = '';
        setNoteCategoryList(res.data);
        res.data.forEach((item) => {
          const { id, title } = item;
          str += `<div class="item" data-id="${id}">
        <span class="title">${encodeHtml(title)}</span
        ><i cursor class="set_btn iconfont icon-icon"></i>
      </div>`;
        });
        $list.html(str);
      }
    })
    .catch(() => {});
}
// 获取分类信息
function getCategoryInfo(id) {
  return setNoteCategoryList().find((item) => item.id === id);
}
// 显示分类设置
export function showCategoryBox() {
  $categoryBox.stop().fadeIn(_d.speed, renderCategoryList);
}
function hideCategoryBox() {
  toHide(
    $categoryBox[0],
    {
      to: 'bottom',
      scale: 'small',
    },
    () => {
      $categoryBox.find('.list').html('');
    }
  );
}
// 添加分类
function addCategory(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          placeholder: '标题',
          beforeText: '标题：',
          verify(val) {
            if (val.trim() == '') {
              return '请输入分类标题';
            } else if (val.trim().length > 30) {
              return '请输入30字以内';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const title = inp.text;
        reqNoteAddCategory({ title })
          .then((res) => {
            if (res.code == 0) {
              renderCategoryList();
              close();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '添加笔记分类'
  );
}
// 编辑分类
function editCategory(e, obj) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          placeholder: '标题',
          beforeText: '标题：',
          value: obj.title,
          verify(val) {
            if (val.trim() == '') {
              return '请输入分类标题';
            } else if (val.trim().length > 30) {
              return '请输入30字以内';
            }
          },
        },
      },
    },
    debounce(
      function ({ close, inp }) {
        const title = inp.text;
        if (obj.title === title) return;
        reqNoteEditCategory({ id: obj.id, title })
          .then((res) => {
            if (res.code == 0) {
              renderCategoryList();
              close(1);
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      },
      1000,
      true
    ),
    '编辑笔记分类'
  );
}
// 删除分类
function deleteCategory(e, obj, cb) {
  _pop(
    {
      e,
      text: `确认删除：${obj.title}？`,
      confirm: { text: '删除', type: 'danger' },
    },
    (t) => {
      if (t == 'confirm') {
        reqNoteDeleteCategory({ id: obj.id })
          .then((res) => {
            if (res.code == 0) {
              cb && cb();
              renderCategoryList();
              _msg.success(res.codeText);
            }
          })
          .catch(() => {});
      }
    }
  );
}
// 操作分类
function hdCategory(e) {
  const $this = $(this).parent();
  const obj = getCategoryInfo($this.data('id'));
  const data = [
    { id: 'edit', text: '编辑', beforeIcon: 'iconfont icon-bianji' },
    { id: 'delete', text: '删除', beforeIcon: 'iconfont icon-shanchu' },
  ];
  rMenu.selectMenu(
    e,
    data,
    ({ id, close, e }) => {
      if (id === 'edit') {
        editCategory(e, obj);
      } else if (id === 'delete') {
        deleteCategory(e, obj, close);
      }
    },
    obj.title
  );
}
$categoryBox
  .on('click', '.add_btn', addCategory)
  .on('click', '.close', hideCategoryBox)
  .on('click', '.set_btn', hdCategory);
