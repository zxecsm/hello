export default function bear(idx = 1) {
  const style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.innerHTML = `
  @keyframes bear-run {
    from {
      background-position: 0 0;
    }
    to {
      background-position: -40rem 0;
    }
  }

  @keyframes bear-move {
    0% {
      left: -5rem;
    }
    100% {
      left: 100%;
    }
  }
  `;
  document.head.appendChild(style);
  const bear = document.createElement('div');
  bear.style.cssText = `
  display: none;
  position: fixed;
  left: -5rem;
  bottom: -0.2rem;
  width: 5rem;
  height: 2.5rem;
  background-image: url(data:image/png;base64,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);
  background-repeat: repeat-x;
  background-size: 40rem 2.5rem;
  pointer-events: none;
  z-index: ${idx};
  `;
  document.body.appendChild(bear);

  function startBearRun() {
    bear.style.display = 'block'; // 显示熊
    bear.style.left = '-5rem'; // 重置位置

    const speed = bear.offsetWidth * 2;
    const duration = window.innerWidth / speed;

    // 设置动画时长
    bear.style.animation = `bear-run 1s steps(8) infinite, bear-move ${duration}s linear forwards`;

    // 添加动画
    bear.style.animationPlayState = 'running';

    // 自动隐藏熊在动画结束后
    setTimeout(() => {
      bear.style.display = 'none';
      setTimeout(startBearRun, Math.random() * 100 * 1000);
    }, duration * 1000);
  }

  startBearRun();
}
