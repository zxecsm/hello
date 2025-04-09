export function getEventPoints(e) {
  const event = e.originalEvent || e;

  if (event.touches && event.touches.length > 0) {
    return Array.from(event.touches);
  }

  if (event.changedTouches && event.changedTouches.length > 0) {
    return Array.from(event.changedTouches);
  }

  return [event];
}

export function getPointElement(e) {
  e = getEventPoints(e)[0];
  return document.elementFromPoint(e.clientX, e.clientY);
}

export class BoxSelector {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.selectBox = null;
    this.startX = 0;
    this.startY = 0;
    this.animationFrameRequested = false;
    this.keyDownMap = {};
    this.isWorking = true;
    this.scroller = new AutoScroller(this.container, {
      scrollSpeed: options.scrollSpeed || 10,
      scrollThreshold: options.scrollThreshold || 30,
    });

    this.initEvents();
  }

  initEvents() {
    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    this.container.addEventListener('mousedown', this.onStart);
    this.container.addEventListener('touchstart', this.onStart, {
      passive: false,
    });
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onEnd);
    document.addEventListener('touchmove', this.onMove, {
      passive: false,
    });
    document.addEventListener('touchend', this.onEnd);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onKeyDown(e) {
    this.keyDownMap[e.key] = true;
  }

  onKeyUp(e) {
    this.keyDownMap[e.key] = false;
  }

  isKeepOld() {
    return (
      this.keyDownMap['Shift'] ||
      this.keyDownMap['Control'] ||
      this.keyDownMap['Meta']
    );
  }

  destroy() {
    this.container.removeEventListener('mousedown', this.onStart);
    this.container.removeEventListener('touchstart', this.onStart);
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onEnd);
    document.removeEventListener('touchmove', this.onMove);
    document.removeEventListener('touchend', this.onEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  stop() {
    this.isWorking = false;
  }

  start() {
    this.isWorking = true;
  }

  isDocument() {
    return (
      this.container === document ||
      this.container === document.body ||
      this.container === document.documentElement
    );
  }

  getEventPoint(e) {
    e = getEventPoints(e)[0];
    const { clientX, clientY } = e;

    let scrollLeft = 0;
    let scrollTop = 0;
    let rect = { left: 0, top: 0 };

    if (this.isDocument()) {
      scrollLeft = window.scrollX;
      scrollTop = window.scrollY;
    } else {
      rect = this.container.getBoundingClientRect();
      scrollLeft = this.container.scrollLeft;
      scrollTop = this.container.scrollTop;
    }

    return {
      x: clientX - rect.left + scrollLeft,
      y: clientY - rect.top + scrollTop,
      clientY,
      clientX,
    };
  }

  onStart(e) {
    if (!this.isWorking) return;

    let isStop = false;

    if (typeof this.options.onSelectStart === 'function') {
      isStop = this.options.onSelectStart({ e });
    }

    // if (e.type.startsWith('touch')) e.preventDefault();
    if (this.selectBox) {
      this.selectBox.remove();
      this.selectBox = null;
    }

    if (isStop) return;

    const { x, y } = this.getEventPoint(e);
    this.startX = x;
    this.startY = y;

    this.selectBox = this.createSelectBox();

    if (this.isDocument()) {
      document.body.appendChild(this.selectBox);
    } else {
      this.container.appendChild(this.selectBox);
    }
  }

  onMove(e) {
    if (!this.selectBox || !this.isWorking) return;

    if (e.type.startsWith('touch')) e.preventDefault();

    const {
      x: currentX,
      y: currentY,
      clientY,
      clientX,
    } = this.getEventPoint(e);

    const left = Math.min(this.startX, currentX);
    const top = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    Object.assign(this.selectBox.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    this.scroller.check(clientX, clientY);

    // 使用 requestAnimationFrame 来避免频繁操作 DOM
    if (!this.animationFrameRequested) {
      this.animationFrameRequested = true;
      requestAnimationFrame(() => {
        this.updateSelection();
        this.animationFrameRequested = false;
      });
    }
  }

  onEnd() {
    if (!this.selectBox) return;

    this.updateSelection(true);

    this.selectBox.remove();
    this.selectBox = null;
  }

  updateSelection(isEnd) {
    if (!this.selectBox || !this.isWorking) return;

    const boxRect = this.selectBox.getBoundingClientRect();

    if (boxRect.width < 5 || boxRect.height < 5) return;

    const selectedItems = [];
    let allItems = [];

    if (this.options.selectables) {
      allItems = Array.from(
        this.container.querySelectorAll(this.options.selectables)
      );

      allItems.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        if (this.isOverlap(boxRect, elRect)) {
          selectedItems.push(el);
        }
      });
    }

    const param = {
      selectedItems,
      rect: boxRect,
      allItems,
      isKeepOld: this.isKeepOld(),
    };

    if (isEnd) {
      if (typeof this.options.onSelectEnd === 'function') {
        this.options.onSelectEnd(param);
      }
    } else {
      if (typeof this.options.onSelectUpdate === 'function') {
        this.options.onSelectUpdate(param);
      }
    }
  }

  createSelectBox() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: 9999,
      border: '1px dashed var(--icon-color)',
      backgroundColor: 'var(--bg-color-o3)',
      ...this.options.style,
    });
    return el;
  }

  isOverlap(r1, r2) {
    return !(
      r2.left > r1.right ||
      r2.right < r1.left ||
      r2.top > r1.bottom ||
      r2.bottom < r1.top
    );
  }
}

export class AutoScroller {
  constructor(container = document, options = {}) {
    this.container = container;
    this.scrollSpeed = options.scrollSpeed || 10;
    this.scrollThreshold = options.scrollThreshold || 30;
    this.scrollTimer = null;
    this.inactiveTimer = null;
    this.inactiveDelay = options.inactiveDelay || 1000;
  }

  isDocument() {
    return (
      this.container === document ||
      this.container === document.body ||
      this.container === document.documentElement
    );
  }

  getContainerInfo() {
    if (this.isDocument()) {
      return {
        scrollTop: window.scrollY,
        scrollLeft: window.scrollX,
        clientHeight: window.innerHeight,
        clientWidth: window.innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        containerRect: { top: 0, left: 0 },
      };
    } else {
      return {
        scrollTop: this.container.scrollTop,
        scrollLeft: this.container.scrollLeft,
        clientHeight: this.container.clientHeight,
        clientWidth: this.container.clientWidth,
        scrollHeight: this.container.scrollHeight,
        scrollWidth: this.container.scrollWidth,
        containerRect: this.container.getBoundingClientRect(),
      };
    }
  }

  getDirection(clientX, clientY) {
    const { containerRect, clientHeight, clientWidth } =
      this.getContainerInfo();

    const offsetY = clientY - containerRect.top;
    const offsetX = clientX - containerRect.left;

    return {
      top: offsetY < this.scrollThreshold,
      bottom: offsetY > clientHeight - this.scrollThreshold,
      left: offsetX < this.scrollThreshold,
      right: offsetX > clientWidth - this.scrollThreshold,
    };
  }

  check(clientX, clientY) {
    clearTimeout(this.inactiveTimer);
    this.inactiveTimer = setTimeout(() => {
      this.clear(); // 无操作后自动停止
    }, this.inactiveDelay);

    const direction = this.getDirection(clientX, clientY);

    const {
      scrollTop,
      scrollLeft,
      clientHeight,
      clientWidth,
      scrollHeight,
      scrollWidth,
    } = this.getContainerInfo();

    const canScroll =
      direction.top || direction.bottom || direction.left || direction.right;

    if (canScroll) {
      if (!this.scrollTimer) {
        this.scrollTimer = setInterval(() => {
          if (direction.top && scrollTop > 0) {
            this.scrollBy(0, -this.scrollSpeed);
          } else if (
            direction.bottom &&
            scrollTop + clientHeight < scrollHeight
          ) {
            this.scrollBy(0, this.scrollSpeed);
          }

          if (direction.left && scrollLeft > 0) {
            this.scrollBy(-this.scrollSpeed, 0);
          } else if (
            direction.right &&
            scrollLeft + clientWidth < scrollWidth
          ) {
            this.scrollBy(this.scrollSpeed, 0);
          }
        }, 16);
      }
    } else {
      this.clear();
    }
  }

  scrollBy(x, y) {
    if (this.isDocument()) {
      window.scrollBy(x, y);
    } else {
      this.container.scrollLeft += x;
      this.container.scrollTop += y;
    }
  }

  clear() {
    if (this.scrollTimer) {
      clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
  }
}

export class MouseElementTracker {
  constructor(container, options = {}) {
    this.container = container;
    options.delay = options.delay || 0;
    this.options = options;
    this.infoBox = null;
    this.isWorking = true;
    this.content = '';
    this.timer = null;
    this.currentX = 0;
    this.currentY = 0;
    this.scroller = new AutoScroller(this.container, {
      scrollSpeed: options.scrollSpeed || 10,
      scrollThreshold: options.scrollThreshold || 30,
    });

    this.initEvents();
  }

  initEvents() {
    this.onStart = this.onStart.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onEnd = this.onEnd.bind(this);

    this.container.addEventListener('mousedown', this.onStart);
    this.container.addEventListener('touchstart', this.onStart, {
      passive: false,
    });
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onEnd);
    document.addEventListener('touchmove', this.onMove, {
      passive: false,
    });
    document.addEventListener('touchend', this.onEnd);
  }

  destroy() {
    this.container.removeEventListener('mousedown', this.onStart);
    this.container.removeEventListener('touchstart', this.onStart);
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onEnd);
    document.removeEventListener('touchmove', this.onMove);
    document.removeEventListener('touchend', this.onEnd);
    this.clear();
  }

  stop() {
    this.isWorking = false;
  }

  start() {
    this.isWorking = true;
  }

  isDocument() {
    return (
      this.container === document ||
      this.container === document.body ||
      this.container === document.documentElement
    );
  }

  clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  onStart(e) {
    if (!this.isWorking) return;
    this.clear();

    const { clientY, clientX } = getEventPoints(e)[0];
    this.currentX = clientX;
    this.currentY = clientY;

    this.timer = setTimeout(() => {
      let isStop = false;
      if (
        Math.abs(this.currentX - clientX) > 5 ||
        Math.abs(this.currentY - clientY) > 5
      )
        return;

      if (typeof this.options.onStart === 'function') {
        isStop = this.options.onStart({ e });
      }

      if (this.infoBox) {
        this.infoBox.remove();
        this.infoBox = null;
      }

      if (isStop) return;
      this.infoBox = this.createInfoBox();

      document.body.appendChild(this.infoBox);

      if (this.options.delay) {
        this.infoBox.clientHeight;
        this.updatePosition(clientX, clientY);
      }
    }, this.options.delay);
  }

  onMove(e) {
    if (!this.isWorking) return;
    const { clientY, clientX } = getEventPoints(e)[0];

    this.currentX = clientX;
    this.currentY = clientY;

    if (!this.infoBox) return;

    if (e.type.startsWith('touch')) e.preventDefault();

    this.updatePosition(clientX, clientY);

    this.scroller.check(clientX, clientY);

    if (typeof this.options.onMove === 'function') {
      this.options.onMove({ e });
    }
  }
  updatePosition(x, y) {
    if (this.infoBox) {
      Object.assign(this.infoBox.style, {
        left: `${x + 20}px`,
        top: `${y + 20}px`,
        padding: '10px',
        opacity: 1,
      });
    }
  }
  onEnd(e) {
    this.clear();
    if (!this.infoBox) return;

    if (typeof this.options.onEnd === 'function') {
      this.options.onEnd({ e, dropElement: getPointElement(e) });
    }

    this.infoBox.remove();
    this.infoBox = null;
  }
  get active() {
    return this.isWorking && this.infoBox;
  }
  changeInfo(content) {
    this.content = content;
  }
  createInfoBox() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: 9999999,
      border: '1px solid var(--text-hover-color)',
      transition: 'padding 0.3s ease-in-out',
      padding: '100px',
      borderRadius: '5px',
      color: 'var(--icon-color)',
      backgroundColor: 'var(--color10)',
      fontWeight: 'bold',
      fontSize: '20px',
      lineHeight: '1.5',
      opacity: 0,
    });
    el.innerText = this.content;
    return el;
  }
}
