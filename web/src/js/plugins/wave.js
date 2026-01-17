export default function wave(idx = 1) {
  const _0x1f03ad = document['createElement']('style');
  (_0x1f03ad['setAttribute']('type', 'text/css'),
    (_0x1f03ad['innerHTML'] = `
      .vh-bolang {
        pointer-events: none;
        position: fixed;
        left: 0px;
        bottom: 0px;
        width: 100vw;
        height: 88px;
        z-index: ${idx};
      }
      .vh-bolang-main>use{
        animation:vh-bolang-item-move 12s linear infinite
      }
      .vh-bolang-main>use:nth-child(1){
        animation-delay:-2s
      }
      .vh-bolang-main>use:nth-child(2){
        animation-delay:-2s;
        animation-duration:5s
      }
      .vh-bolang-main>use:nth-child(3){
        animation-delay:-4s;
        animation-duration:3s
      }
      @keyframes rise {
        0% {
          transform: translateY(0);
          opacity: 0;
        }
        50% {
          opacity: 1;
        }
        100% {
          transform: translateY(-100vh);
          opacity: 0;
        }
      }
      @keyframes vh-bolang-item-move{
        0%{
          transform:translate(-90px,0)
        }
        100%{
          transform:translate(85px,0)
        }
      }`),
    document['querySelector']('head')['appendChild'](_0x1f03ad));
  const fillColor = 'rgb(153 205 239 / 10%)';
  const _0x29074d = `<svg class="vh-bolang" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 24 150 28" preserveAspectRatio="none">
        <defs>
          <path id="vh-bolang-item" d="M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v44h-352z"></path>
        </defs>
        <g class="vh-bolang-main">
          <use xlink:href="#vh-bolang-item" x="50" y="0" fill="${fillColor}"></use>
          <use xlink:href="#vh-bolang-item" x="50" y="3" fill="${fillColor}"></use>
          <use xlink:href="#vh-bolang-item" x="50" y="6" fill="${fillColor}"></use>
        </g>
      </svg>`,
    _0x319530 = new DOMParser(),
    _0x4d9451 = _0x319530['parseFromString'](_0x29074d, 'image/svg+xml')['querySelector']('svg');
  document['body']['appendChild'](_0x4d9451);

  function createBubble() {
    const bubble = document.createElement('div');
    bubble.style.cssText = `
    position: fixed;
    bottom: -60px;
    background-color: rgb(153 205 239 / 30%);
    border-radius: 50%;
    animation: rise 5s infinite ease-in-out;
    pointer-events: none;
    z-index: ${idx};
    `;

    // 随机大小和位置
    const size = Math.random() * 50 + 10 + 'px';
    bubble.style.width = size;
    bubble.style.height = size;
    bubble.style.left = Math.random() * 100 + '%';

    // 随机动画持续时间
    bubble.style.animationDuration = Math.random() * 10 + 30 + 's';

    document.body.appendChild(bubble);

    // 在动画结束后删除泡泡
    setTimeout(
      () => {
        bubble.remove();
      },
      parseFloat(bubble.style.animationDuration) * 1000,
    );
  }
  createBubble();
  // 定时生成泡泡
  setInterval(createBubble, 3000);
}
