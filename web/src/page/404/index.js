import '../../css/common/reset.css';
import '../../css/common/common.css';
import '../../font/iconfont.css';
import './index.less';
import '../../js/common/common';
import { randomNum } from '../../js/utils/utils';

// 随机动画效果
const animations = [
  {
    name: 'float',
    duration: '3s',
    keyframes: `
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2rem); }
      `,
  },
  {
    name: 'rotate',
    duration: '4s',
    keyframes: `
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(360deg); }
      `,
  },
  {
    name: 'scale',
    duration: '2s',
    keyframes: `
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
      `,
  },
];
const randomAnimation = animations[randomNum(0, animations.length - 1)];
const style = document.createElement('style');
style.innerHTML = `
      @keyframes ${randomAnimation.name} {
          ${randomAnimation.keyframes}
      }
      h1 {
          animation: ${randomAnimation.name} ${randomAnimation.duration} ease-in-out infinite;
      }
  `;
document.head.appendChild(style);

// 随机星星效果
const stars = document.createElement('div');
stars.className = 'stars';
document.body.appendChild(stars);

const numStars = 100; // 星星数量
for (let i = 0; i < numStars; i++) {
  const star = document.createElement('div');
  star.className = 'star';
  const size = Math.random() * 3 + 1; // 随机星星大小
  const positionX = Math.random() * 100; // 随机位置
  const positionY = Math.random() * 100;

  star.style.width = `${size}px`;
  star.style.height = `${size}px`;
  star.style.top = `${positionY}%`;
  star.style.left = `${positionX}%`;

  stars.appendChild(star);
}
