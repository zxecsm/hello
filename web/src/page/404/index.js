import '../../css/common/reset.css';
import '../../css/common/common.css';
import './index.less';
import '../../js/common/common';
import { randomNum } from '../../js/utils/utils';

// 随机字体效果
const fonts = ['Arial', 'Verdana', 'Georgia', 'Courier New', 'Comic Sans MS'];
const randomFont = fonts[randomNum(0, fonts.length - 1)];
document.body.style.fontFamily = randomFont;

// 随机动画效果
const animations = [
  {
    name: 'float',
    duration: '3s',
    keyframes: `
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
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
          50% { transform: scale(1.2); }
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

// 随机背景颜色
const colors = [
  'linear-gradient(135deg, #1a1a1a, #333)',
  'linear-gradient(135deg, #2c3e50, #34495e)',
  'linear-gradient(135deg, #232526, #414345)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #1e3c72, #2a5298)',
];
const randomColor = colors[randomNum(0, colors.length - 1)];
stars.style.background = randomColor;
