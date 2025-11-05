import _d from '../../common/config';
import { _tpl } from '../../utils/template';
import { _mySlide } from '../../utils/utils';
import './index.less';

const progressBox = _tpl.getDom(
  `
<div id="progress_box" style="z-index: {{_d.levelObj.upProgressbox}};">
  <div cursor="y" class="left_btn iconfont icon-you"></div>
  <div class="list"></div>
</div>
`,
  { _d }
)[0];
document.body.appendChild(progressBox);

const oLeftBtn = progressBox.querySelector('.left_btn');
const oList = progressBox.querySelector('.list');

oLeftBtn.addEventListener('click', function () {
  if (oLeftBtn.classList.contains('icon-you')) {
    oLeftBtn.className = 'left_btn iconfont icon-zuo';
    progressBox.classList.add('hide');
  } else {
    oLeftBtn.className = 'left_btn iconfont icon-you';
    progressBox.classList.remove('hide');
  }
});

// 手势
_mySlide({
  el: progressBox,
  right() {
    oLeftBtn.className = 'left_btn iconfont icon-zuo';
    progressBox.classList.add('hide');
  },
});

class Progress {
  constructor(name, iconfont = 'iconfont icon-upload', upProgress) {
    this.name = name;
    this.upProgress = upProgress;
    this.iconfont = iconfont;
    this.create();
  }
  create() {
    this.box = document.createElement('div');
    this.box.className = 'pro_box';
    this.box1 = document.createElement('div');
    this.box1.className = 'box1';
    this.icon = document.createElement('span');
    this.icon.className = `icon ${this.iconfont}`;
    this.title = document.createElement('span');
    this.title.className = 'title';
    this.box2 = document.createElement('div');
    this.box2.className = 'box2';
    this.title.innerText = this.name;
    this.box1.appendChild(this.icon);
    this.box1.appendChild(this.title);
    this.box.appendChild(this.box2);
    this.box.appendChild(this.box1);
    this.upProgress.proList.appendChild(this.box);
  }
  update(percent) {
    //上传进度
    this.title.innerText = this.name;
    this.box2.style.backgroundColor = 'var(--color7)';
    this.box2.style.width = percent * 100 + '%';
  }
  loading(percent) {
    this.title.innerText = `校验文件...${parseInt(percent * 100)}%`;
  }
  close(title) {
    this.title.innerText = this.name;
    this.box2.style.width = 100 + '%';
    this.box2.style.backgroundColor = 'green';
    this.box2.style.opacity = '0.8';
    this.box2.style.zIndex = '2';
    this.box2.innerText = title || '上传成功';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(() => {
      clearTimeout(this.timer);
      this.timer = null;
      this.animate();
    }, 3000);
  }
  fail(title) {
    this.title.innerText = this.name;
    this.box2.style.width = 100 + '%';
    this.box2.style.backgroundColor = 'red';
    this.box2.style.opacity = '0.8';
    this.box2.style.zIndex = '2';
    this.box2.innerText = title || '上传失败';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.timer = setTimeout(() => {
      clearTimeout(this.timer);
      this.timer = null;
      this.animate();
    }, 6000);
  }
  animate() {
    this.box.style.transition = `transform 0.3s ease-in-out,opacity 0.3s ease-in-out`;
    this.box.style.transform = `translateX(100%)`;
    this.box.style.opacity = 0;

    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      this.box.remove();
      if (this.upProgress.proList.innerHTML === '') {
        this.upProgress.cancel();
      }
    }, 300);
  }
}
export class UpProgress {
  constructor(cb) {
    this.cb = cb;
    this.create();
    this.bindEvent();
  }
  create() {
    this.item = document.createElement('div');
    this.item.className = 'item';
    this.proList = document.createElement('div');
    this.proList.className = 'pro_list';
    this.closeBtn = document.createElement('div');
    this.closeBtn.className = `close_btn iconfont icon-close-bold`;
    this.closeBtn.setAttribute('cursor', 'y');

    this.item.appendChild(this.closeBtn);
    this.item.appendChild(this.proList);
    oList.appendChild(this.item);
  }
  cancel() {
    this.closeBtn.removeEventListener('click', this.cancel);
    this.item.remove();
    if (oList.innerHTML === '') {
      progressBox.style.display = 'none';
    }
    this.cb && this.cb();
  }
  bindEvent() {
    this.cancel = this.cancel.bind(this);
    this.closeBtn.addEventListener('click', this.cancel);
  }
  add(name, iconfont = 'iconfont icon-upload') {
    progressBox.style.display = 'block';
    return new Progress(name, iconfont, this);
  }
}
