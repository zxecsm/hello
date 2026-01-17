import './index.less';
import { _getTarget, unique } from '../../../js/utils/utils';
import { _tpl } from '../../../js/utils/template';

export class CreateTabs {
  constructor(opt = {}) {
    const defaultOpt = {
      el: null,
      data: [],
      add: null,
      change: null,
    };
    this.opt = Object.assign(defaultOpt, opt);
    if (typeof this.opt.el === 'string') {
      this.opt.el = document.querySelector(this.opt.el);
    }
    this.init();
  }
  init() {
    this.box = document.createElement('div');
    this.box.className = 'tabs_box';
    this.opt.el.appendChild(this.box);
    this.render();
    this.bindEvent();
  }
  hdChange() {
    this.opt.data = unique(this.opt.data, ['id']);
    this.opt.change && this.opt.change(this.opt.data);
  }
  render() {
    const html = _tpl(
      `
        <div v-for="{id,title} in data" class="tab" :title="title" :data-id="id">
          <span class="text">{{title}}</span>
          <i cursor="y" class="iconfont close icon-shibai"></i>
        </div>
        <div cursor="y" class="add_tab iconfont icon-tianjia"></div>
      `,
      {
        ...this.opt,
      },
    );
    _tpl.html(this.box, html);
  }
  bindEvent() {
    this.hdClick = this.hdClick.bind(this);
    this.box.addEventListener('click', this.hdClick);
  }
  unBindEvent() {
    this.box.removeEventListener('click', this.hdClick);
  }
  add(tab) {
    this.opt.data.push(tab);
    this.hdChange();
    this.render();
  }
  remove(id) {
    this.opt.data = this.opt.data.filter((item) => item.id !== id);
    this.hdChange();
    this.render();
  }
  hdClick(e) {
    const close = _getTarget(this.box, e, '.tab .close', 1);
    const addTab = _getTarget(this.box, e, '.add_tab', 1);
    if (close) {
      const id = close.parentNode.dataset.id;
      this.remove(id);
    } else if (addTab) {
      this.opt.add && this.opt.add({ e, add: this.add.bind(this), data: this.opt.data });
    }
  }
  get list() {
    return this.opt.data;
  }
  set list(val) {
    this.opt.data = val;
    this.hdChange();
    this.render();
  }
}
