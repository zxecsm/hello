import _d from '../../common/config';
import './index.less';
import cacheFile from '../../utils/cacheFile';
import { _animate, imgjz } from '../../utils/utils';
import { _loadingBar } from '../loadingBar';
import _msg from '../message';

export default function imgPreview(arr, idx = 0) {
  let result, //图片宽高
    x, //偏移
    y,
    scale = 1, //缩放
    maxScale = 10, //最大缩放
    minScale = 0.5; //最小缩放//移动状态
  let pointers = [], // 触摸点数组
    point1 = { x: 0, y: 0 }, // 第一个点坐标
    point2 = { x: 0, y: 0 }, // 第二个点坐标
    diff = { x: 0, y: 0 }, // 相对于上一次pointermove移动差值
    lastPointermove = { x: 0, y: 0 }, // 用于计算diff
    lastPoint1 = { x: 0, y: 0 }, // 上一次第一个触摸点坐标
    lastPoint2 = { x: 0, y: 0 }, // 上一次第二个触摸点坐标
    lastCenter; // 上一次中心点坐标
  const box = document.createElement('div');
  box.className = 'img_preview';
  box.style.zIndex = _d.levelObj.imgPreview;
  const image = document.createElement('img');
  image.className = 'img';
  image.setAttribute('draggable', 'false');
  const image1 = document.createElement('img');
  image1.className = 'img1';
  image1.setAttribute('draggable', 'false');
  box.appendChild(image);
  box.appendChild(image1);
  const pre = document.createElement('div');
  const next = document.createElement('div');
  const close = document.createElement('div');
  const load = document.createElement('div');
  load.className = 'load';
  close.className = 'iconfont icon-close-bold close';
  pre.className = 'iconfont icon-zuo pre';
  next.className = 'iconfont icon-you next';
  pre.setAttribute('cursor', '');
  next.setAttribute('cursor', '');
  close.setAttribute('cursor', '');
  box.appendChild(pre);
  box.appendChild(next);
  box.appendChild(close);
  box.appendChild(load);
  document.body.appendChild(box);
  _animate(box, {
    to: { transform: 'translateY(100%) scale(0)', opacity: 0 },
    direction: 'reverse',
  });
  if (arr.length > 1) {
    pre.style.display = 'block';
    next.style.display = 'block';
  }
  function cut(idx) {
    scale = 1;
    image.style.opacity = 0;
    image1.style.display = 'none';
    _loadingBar.end();
    load.style.opacity = 1;
    let { u1, u2 } = arr[idx];
    _loadingBar.start();
    if (u2) {
      const ca = cacheFile.hasUrl(u2, 'image');
      if (ca) u2 = ca;
      image1.src = u2;
      image1.style.display = 'block';
    }
    imgjz(u1)
      .then((cache) => {
        image.src = cache;
      })
      .catch(() => {
        hdError();
      });
  }
  cut(idx);
  function hdLoad() {
    load.style.opacity = 0;
    result = getImgSize(
      image.naturalWidth,
      image.naturalHeight,
      window.innerWidth,
      window.innerHeight
    );
    image.style.width = result.width + 'px';
    image.style.height = result.height + 'px';
    x = (window.innerWidth - result.width) * 0.5;
    y = (window.innerHeight - result.height) * 0.5;
    image.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) scale(1)';
    image1.style.display = 'none';
    image.style.opacity = 1;
    _loadingBar.end();
  }
  function hdError() {
    _loadingBar.end();
    load.style.opacity = 0;
    image.style.opacity = 0;
    _msg.error('图片加载失败');
  }
  function hdMove(e) {
    if (e.target !== image) return;
    handlePointers(e);
    const current1 = { x: pointers[0].clientX, y: pointers[0].clientY };
    if (pointers.length === 1) {
      diff.x = current1.x - lastPointermove.x;
      diff.y = current1.y - lastPointermove.y;
      lastPointermove = { x: current1.x, y: current1.y };
      x += diff.x;
      y += diff.y;
      image.style.transform =
        'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
    } else if (pointers.length === 2) {
      const current2 = { x: pointers[1].clientX, y: pointers[1].clientY };
      // 计算相对于上一次移动距离比例 ratio > 1放大，ratio < 1缩小
      let ratio =
        getDistance(current1, current2) / getDistance(lastPoint1, lastPoint2);
      // 缩放比例
      const _scale = scale * ratio;
      if (_scale > maxScale) {
        scale = maxScale;
        ratio = maxScale / scale;
      } else if (_scale < minScale) {
        scale = minScale;
        ratio = minScale / scale;
      } else {
        scale = _scale;
      }
      // 计算当前双指中心点坐标
      const center = getCenter(current1, current2);
      // 计算图片中心偏移量，默认transform-origin: 50% 50%
      // 如果transform-origin: 0% 0%，那origin.x = (ratio - 1) * result.width * 0
      // origin.y = (ratio - 1) * result.height * 0
      // 如果transform-origin: 30% 40%，那origin.x = (ratio - 1) * result.width * 0.3
      // origin.y = (ratio - 1) * result.height * 0.4
      const origin = {
        x: (ratio - 1) * result.width * 0.5,
        y: (ratio - 1) * result.height * 0.5,
      };
      // 计算偏移量
      x -= (ratio - 1) * (center.x - x) - origin.x - (center.x - lastCenter.x);
      y -= (ratio - 1) * (center.y - y) - origin.y - (center.y - lastCenter.y);
      image.style.transform =
        'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
      lastCenter = { x: center.x, y: center.y };
      lastPoint1 = { x: current1.x, y: current1.y };
      lastPoint2 = { x: current2.x, y: current2.y };
    }
    e.preventDefault();
  }
  function hdUp() {
    pointers = [];
    box.removeEventListener('pointermove', hdMove);
    box.removeEventListener('pointerup', hdUp);
  }
  function hdClick(e) {
    const target = e.target;
    if (target === pre) {
      idx -= 1;
      idx < 0 ? (idx = arr.length - 1) : null;
      cut(idx);
      return;
    } else if (target === next) {
      idx += 1;
      idx >= arr.length ? (idx = 0) : null;
      cut(idx);
      return;
    } else if (target === close || target === box) {
      closeBox();
    }
  }
  function closeBox() {
    box.removeEventListener('click', hdClick);
    box.removeEventListener('pointerdown', hdDown);
    image.removeEventListener('wheel', hdWheel);
    image.removeEventListener('load', hdLoad);
    image.removeEventListener('error', hdError);
    _animate(
      box,
      {
        to: { transform: 'translateY(100%) scale(0)', opacity: 0 },
      },
      () => {
        box.remove();
      }
    );
    _loadingBar.end();
  }
  box.addEventListener('click', hdClick);
  function hdWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    let ratio = 1.1;
    // 缩小
    if (e.deltaY > 0) {
      ratio = 1 / 1.1;
    }
    const _scale = scale * ratio;
    if (_scale > maxScale) {
      ratio = maxScale / scale;
      scale = maxScale;
    } else if (_scale < minScale) {
      ratio = minScale / scale;
      scale = minScale;
    } else {
      scale = _scale;
    }
    // 目标元素是img说明鼠标在img上，以鼠标位置为缩放中心，否则默认以图片中心点为缩放中心
    if (e.target.tagName === 'IMG') {
      const origin = {
        x: (ratio - 1) * result.width * 0.5,
        y: (ratio - 1) * result.height * 0.5,
      };
      // 计算偏移量
      x -= (ratio - 1) * (e.clientX - x) - origin.x;
      y -= (ratio - 1) * (e.clientY - y) - origin.y;
    }
    image.style.transform =
      'translate3d(' + x + 'px, ' + y + 'px, 0) scale(' + scale + ')';
    e.preventDefault();
  }
  function hdDown(e) {
    // 绑定 pointerup
    box.addEventListener('pointerup', hdUp);
    if (e.target !== image) return;
    pointers.push(e);
    point1 = { x: pointers[0].clientX, y: pointers[0].clientY };
    if (pointers.length === 1) {
      image.setPointerCapture(e.pointerId);
      lastPointermove = { x: pointers[0].clientX, y: pointers[0].clientY };
    } else if (pointers.length === 2) {
      point2 = { x: pointers[1].clientX, y: pointers[1].clientY };
      lastPoint2 = { x: pointers[1].clientX, y: pointers[1].clientY };
      lastCenter = getCenter(point1, point2);
    }
    lastPoint1 = { x: pointers[0].clientX, y: pointers[0].clientY };
    // 绑定 pointermove
    box.addEventListener('pointermove', hdMove);
  }
  // 图片加载完成后再操作，否则naturalWidth为0
  image.addEventListener('load', hdLoad);
  image.addEventListener('error', hdError);
  // 绑定 pointerdown
  box.addEventListener('pointerdown', hdDown);
  // 滚轮缩放
  image.addEventListener('wheel', hdWheel);

  /**
   * 更新指针
   * @param {PointerEvent} e
   * @param {string} type
   */
  function handlePointers(e) {
    for (let i = 0; i < pointers.length; i++) {
      if (pointers[i].pointerId === e.pointerId) {
        pointers[i] = e;
      }
    }
  }

  /**
   * 获取两点间距离
   * @param {object} a 第一个点坐标
   * @param {object} b 第二个点坐标
   * @returns
   */
  function getDistance(a, b) {
    const x = a.x - b.x;
    const y = a.y - b.y;
    return Math.hypot(x, y); // Math.sqrt(x * x + y * y);
  }
  /**
   * 获取中点坐标
   * @param {object} a 第一个点坐标
   * @param {object} b 第二个点坐标
   * @returns
   */
  function getCenter(a, b) {
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    return { x: x, y: y };
  }

  /**
   * 获取图片缩放尺寸
   * @param {number} naturalWidth
   * @param {number} naturalHeight
   * @param {number} maxWidth
   * @param {number} maxHeight
   * @returns
   */
  function getImgSize(naturalWidth, naturalHeight, maxWidth, maxHeight) {
    const imgRatio = naturalWidth / naturalHeight;
    const maxRatio = maxWidth / maxHeight;
    let width, height;
    // 如果图片实际宽高比例 >= 显示宽高比例
    if (imgRatio >= maxRatio) {
      if (naturalWidth > maxWidth) {
        width = maxWidth;
        height = (maxWidth / naturalWidth) * naturalHeight;
      } else {
        width = naturalWidth;
        height = naturalHeight;
      }
    } else {
      if (naturalHeight > maxHeight) {
        width = (maxHeight / naturalHeight) * naturalWidth;
        height = maxHeight;
      } else {
        width = naturalWidth;
        height = naturalHeight;
      }
    }
    return { width: width, height: height };
  }
}
