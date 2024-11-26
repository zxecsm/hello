import './index.less';
// 页面加载动效
class LoadingPage {
  constructor() {}
  start() {
    this.loadingBox = document.createElement('div');
    this.loadingBox.id = 'loading_box';
    this.loadingBox.innerHTML = `
        <div class="left"></div>
        <div class="right"></div>
        <div class="center">
          <div class="logo"></div>
        </div>
  `;
    document.body.appendChild(this.loadingBox);
  }
  end(cb) {
    if (!this.loadingBox) return;
    this.loadingBox.classList.add('open');
    this.timer = setTimeout(() => {
      this.loadingBox.remove();
      cb && cb();
    }, 500);
  }
}
const loadingPage = new LoadingPage();
export default loadingPage;
