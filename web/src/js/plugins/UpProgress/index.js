import _d from '../../common/config';

// 上传进度
const upProgressbox = document.createElement('div');
upProgressbox.style.cssText = `
  position: fixed;
  top: 60px;
  right: 20px;
  transform: translateX(100%);
  width: 80%;
  max-width: 400px;
  pointer-events: none;
  transition: transform 0.5s ease-in-out;
  z-index: ${_d.levelObj.upProgressbox};
  `;
document.body.appendChild(upProgressbox);

export class UpProgress {
  constructor(name, iconfont = 'iconfont icon-upload') {
    this.name = name;
    this.iconfont = iconfont;
    this.create();
  }
  create() {
    this.box = document.createElement('div');
    this.box1 = document.createElement('div');
    this.icon = document.createElement('span');
    this.icon.className = this.iconfont;
    this.title = document.createElement('span');
    this.box2 = document.createElement('div');
    this.box.style.cssText = `
                  position: relative;
                  background-color: var(--color10);
                  margin-bottom: 5px;
                  border-radius: 5px;
                  opacity: 0.9;
                  border: 1px solid var(--color9);
                  overflow: hidden;`;
    this.box1.style.cssText = `
                  position: relative;
                  display: flex;
                  width: 100%;
                  height: 40px;
                  line-height: 40px;
                  `;
    this.icon.style.cssText = `
                  flex: none;
                  width: 30px;
                  text-align: center;
                  font-size: 20px;
                  color: var(--icon-color);
                  
    `;
    this.title.style.cssText = `
                  flex: auto;
                  text-overflow: ellipsis;
                  overflow: hidden;
                  white-space: nowrap;
    `;
    this.box2.style.cssText = `
                  position: absolute;
                  height: 100%;
                  line-height: 40px;
                  text-align: center;
                  width: 0;
                  transition: width 0.5s ease-in-out;
                  text-overflow: ellipsis;
                  overflow: hidden;
                  white-space: nowrap; 
                  color: #fff;
                  `;
    this.title.innerText = this.name;
    this.box1.append(this.icon);
    this.box1.append(this.title);
    this.box.appendChild(this.box2);
    this.box.appendChild(this.box1);
    upProgressbox.appendChild(this.box);
    upProgressbox.style.transform = 'none';
  }
  update(percent) {
    //上传进度
    this.title.innerText = this.name;
    this.box2.style.backgroundColor = 'var(--color7)';
    this.box2.style.width = percent * 100 + '%';
  }
  loading(percent) {
    this.title.innerText = `加载中...${parseInt(percent * 100)}%`;
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
    this.box.style.transition = `transform 0.5s ease-in-out,opacity 0.5s ease-in-out`;
    this.box.style.transform = `translateX(100%)`;
    this.box.style.opacity = 0;

    let timer = setTimeout(() => {
      clearTimeout(timer);
      timer = null;
      this.box.remove();
      if (upProgressbox.innerHTML === '') {
        upProgressbox.style.transform = `translateX(100%)`;
      }
    }, 500);
  }
}
