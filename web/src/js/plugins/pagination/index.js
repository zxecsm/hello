import './index.less';
import {
  _getTarget,
  _mySlide,
  _setTimeout,
  creatSelect,
  inputPageNo,
} from '../../utils/utils';
import { _tpl } from '../../utils/template';
/*
 *pageNo:当前页
 *pageSize:每页展示多少条
 *total:一共多少条
 *continuous:连续页码条数
 */
class Pagination {
  constructor(el, opt = {}) {
    this.el = el;
    const defaultOpt = {
      pageNo: 1,
      total: 0,
      totalPage: 1,
      continuous: 5,
      pageSize: 20,
      showTotal: true,
      small: false,
      select: [20, 40, 60, 80, 100, 200],
      toTop: false,
      change: false,
      changeSize: false,
    };
    this.opt = Object.assign(defaultOpt, opt);
    this.init();
  }
  init() {
    this.bindEvent();
    this.mySlide = _mySlide({
      el: this.el,
      left: (e) => {
        if (!_getTarget(this.el, e, '.paginationBox')) return;
        e.stopPropagation();
        // 避免影响绑定到当前元素的其他手势操作
        _setTimeout(() => {
          this.opt.pageNo++;
          this.hdChange();
        });
      },
      right: (e) => {
        if (!_getTarget(this.el, e, '.paginationBox')) return;
        e.stopPropagation();
        _setTimeout(() => {
          this.opt.pageNo--;
          this.hdChange();
        });
      },
    });
  }
  bindEvent() {
    this.hdClick = this.hdClick.bind(this);
    this.el.addEventListener('click', this.hdClick);
  }
  unBind() {
    this.el.removeEventListener('click', this.hdClick);
    this.mySlide();
  }
  hdChange() {
    this.opt.pageNo < 1
      ? (this.opt.pageNo = this.opt.totalPage)
      : this.opt.pageNo > this.opt.totalPage
      ? (this.opt.pageNo = 1)
      : null;
    this.opt.change && this.opt.change(this.opt.pageNo);
  }
  hdClick(e) {
    const target = e.target,
      flag = target.getAttribute('data-flag'),
      type = target.getAttribute('data-type');
    if (target.tagName.toLowerCase() === 'button' && type === 'paging') {
      if (flag === 'prev') {
        this.opt.pageNo--;
        this.hdChange();
      } else if (flag === 'next') {
        this.opt.pageNo++;
        this.hdChange();
      } else if (flag === 'go') {
        let val = this.el.querySelector('.paginationBox input').value.trim();
        val = parseInt(val);
        if (isNaN(val)) return;
        this.opt.pageNo = Math.abs(val);
        this.hdChange();
      } else if (flag === 'top') {
        this.opt.toTop && this.opt.toTop();
      } else if (flag === 'getvalue') {
        inputPageNo(e, { value: this.opt.pageNo }, (val) => {
          this.opt.pageNo = val;
          this.hdChange();
        });
      } else if (flag === 'select') {
        creatSelect(
          e,
          { active: this.opt.pageSize, data: this.opt.select },
          ({ value, close }) => {
            this.opt.changeSize && this.opt.changeSize(value);
            close();
          }
        );
      } else {
        this.opt.pageNo = +flag;
        this.hdChange();
      }
    }
  }
  render(opt) {
    _tpl.html(this.el, this.getHTML(opt));
  }
  getHTML(opt = {}) {
    this.opt = Object.assign(this.opt, opt);
    this.opt.totalPage = Math.ceil(this.opt.total / this.opt.pageSize);
    this.opt.pageNo <= 0
      ? (this.opt.pageNo = this.opt.totalPage)
      : this.opt.pageNo >= this.opt.totalPage
      ? (this.opt.pageNo = this.opt.totalPage)
      : null;
    if (this.opt.total === 0) {
      return '';
    }
    if (this.opt.small) {
      return _tpl(
        `
        <div class="paginationBox jzxz">
        <button data-type="paging" cursor="y" data-flag="prev" class="iconfont icon-zuo"></button>
        <button data-type="paging" cursor="y" data-flag="getvalue">{{pageNo}} / {{totalPage}}</button>
        <button data-type="paging" cursor="y" data-flag="next" class="iconfont icon-you"></button>
        <button v-if="select.length > 0" data-type="paging" cursor="y" data-flag="select">{{pageSize}}/页</button>
        <span v-if="showTotal">共 {{total}} 条</span>
        <button v-if="toTop" data-type="paging" cursor="y" data-flag="top" class="iconfont icon-shang"></button>
        </div>
        `,
        {
          ...this.opt,
        }
      );
    }
    let startPage = this.opt.pageNo - parseInt(this.opt.continuous / 2),
      endPage = this.opt.pageNo + parseInt(this.opt.continuous / 2);
    if (this.opt.totalPage > this.opt.continuous) {
      startPage < 1 ? ((startPage = 1), (endPage = this.opt.continuous)) : null;
      endPage > this.opt.totalPage
        ? ((endPage = this.opt.totalPage),
          (startPage = this.opt.totalPage - this.opt.continuous + 1))
        : null;
    } else {
      startPage = 1;
      endPage = this.opt.totalPage;
    }
    const continuousArr = [];
    for (let i = startPage; i <= endPage; i++) {
      continuousArr.push(i);
    }
    return _tpl(
      `
      <div class="paginationBox jzxz">
        <button v-if="pageNo>1" data-type="paging" cursor="y" data-flag="prev" class="iconfont icon-zuo"></button>
        <template v-if="totalPage > continuous">
          <button v-if="startPage>1" data-type="paging" cursor="y" data-flag="1">1</button>
          <button v-if="startPage==3" data-type="paging" cursor="y" data-flag="2">2</button>
          <button v-if="startPage>3" data-type="paging" cursor="y" :data-flag="startPage - 1">...</button>
        </template>
        <button v-for="flag in continuousArr" data-type="paging" cursor="y" :data-flag="flag" :class="pageNo === flag ? 'active' : ''">{{flag}}</button>
        <template v-if="totalPage > continuous">
          <button v-if="endPage < totalPage - 2" data-type="paging" cursor="y" :data-flag="endPage + 1">...</button>
          <button v-if="endPage === totalPage - 2" data-type="paging" cursor="y" :data-flag="totalPage - 1">{{totalPage - 1}}</button>
          <button v-if="endPage < totalPage" data-type="paging" cursor="y" :data-flag="totalPage">{{totalPage}}</button>
        </template>
        <button v-if="pageNo < totalPage" data-type="paging" cursor="y" data-flag="next" class="iconfont icon-you"></button>
        <button v-if="select.length > 0" data-type="paging" cursor="y" data-flag="select">{{pageSize}}/页</button>
        <span v-if="showTotal">共 {{total}} 条,</span>
        <input autocomplete="off" :value="pageNo" type="number"/>
        <button data-type="paging" cursor="y" data-flag="go" class="iconfont icon-huaban"></button>
        <button v-if="toTop" data-type="paging" cursor="y" data-flag="top" class="iconfont icon-shang"></button>
      </div>
      `,
      { ...this.opt, startPage, continuousArr, endPage }
    );
  }
}
function pagination(el, opt) {
  return new Pagination(el, opt);
}
export default pagination;
