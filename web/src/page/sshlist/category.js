import $ from 'jquery';
import _d from '../../js/common/config';
import { _mySlide, loadingImg } from '../../js/utils/utils';
import _msg from '../../js/plugins/message';
import { renderList, setSSHCategoryList } from '.';
import rMenu from '../../js/plugins/rightMenu';
import { _tpl } from '../../js/utils/template';
import {
  reqSSHAddCategory,
  reqSSHCategory,
  reqSSHDeleteCategory,
  reqSSHEditCategory,
} from '../../api/ssh';
const $categoryBox = $('.category_box');
export function isHideCategoryBox() {
  return $categoryBox.is(':hidden');
}
// 生成列表
export function renderCategoryList(updateSSHList = false) {
  const $list = $categoryBox.find('.list');
  if ($list.children().length === 0) {
    loadingImg($list[0]);
  }
  reqSSHCategory()
    .then((res) => {
      if (res.code === 1) {
        setSSHCategoryList(res.data);
        if (updateSSHList) {
          renderList();
        }
        if (isHideCategoryBox()) return;
        const html = _tpl(
          `
          <div v-for="{id,title} in list" class="item" :data-id="id">
            <i class="logo iconfont icon-liebiao1"></i>
            <span class="title">{{title}}</span>
            <i cursor="y" class="set_btn iconfont icon-maohao"></i>
          </div>
          `,
          {
            list: res.data,
          }
        );
        $list.html(html);
      }
    })
    .catch(() => {});
}
// 获取分类信息
function getCategoryInfo(id) {
  return setSSHCategoryList().find((item) => item.id === id) || {};
}
// 显示分类设置
export function showCategoryBox() {
  document.documentElement.classList.add('notScroll');
  $categoryBox.stop().fadeIn(_d.speed, renderCategoryList);
}
function hideCategoryBox() {
  $categoryBox.hide();
  $categoryBox.find('.list').html('');
  document.documentElement.classList.remove('notScroll');
}
// 添加分类
function addCategory(e) {
  rMenu.inpMenu(
    e,
    {
      subText: '提交',
      items: {
        text: {
          beforeText: '标题：',
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.noteCategoryTitle);
          },
        },
      },
    },
    function ({ close, inp, loading }) {
      const title = inp.text;
      loading.start();
      reqSSHAddCategory({ title })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            renderCategoryList();
            close();
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '添加SSH分类'
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
          beforeText: '标题：',
          value: obj.title,
          verify(val) {
            return rMenu.validString(val, 1, _d.fieldLength.noteCategoryTitle);
          },
        },
      },
    },
    function ({ close, inp, loading, isDiff }) {
      if (!isDiff()) return;
      const title = inp.text;
      loading.start();
      reqSSHEditCategory({ id: obj.id, title })
        .then((res) => {
          loading.end();
          if (res.code === 1) {
            renderCategoryList(1);
            close(1);
            _msg.success(res.codeText);
          }
        })
        .catch(() => {
          loading.end();
        });
    },
    '编辑SSH分类'
  );
}
// 删除分类
function deleteCategory(e, obj, cb, loading = { start() {}, end() {} }) {
  rMenu.pop(
    {
      e,
      text: `确认删除：${obj.title}？`,
      confirm: { text: '删除', type: 'danger' },
    },
    (t) => {
      if (t === 'confirm') {
        loading.start();
        reqSSHDeleteCategory({ id: obj.id })
          .then((res) => {
            loading.end();
            if (res.code === 1) {
              cb && cb();
              renderCategoryList(1);
              _msg.success(res.codeText);
            }
          })
          .catch(() => {
            loading.end();
          });
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
    ({ id, close, e, loading }) => {
      if (id === 'edit') {
        editCategory(e, obj);
      } else if (id === 'delete') {
        deleteCategory(e, obj, close, loading);
      }
    },
    obj.title
  );
}
$categoryBox
  .on('click', '.add_btn', addCategory)
  .on('click', '.close', hideCategoryBox)
  .on('click', '.set_btn', hdCategory);

// 手势
_mySlide({
  el: $categoryBox[0],
  right() {
    hideCategoryBox();
  },
});
