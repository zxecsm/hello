import { _getData } from '../utils/utils';

/* 鼠标特效 - 小星星拖尾 */
(function () {
  const possibleColors = ['#D61C59', '#E7D84B', '#1B8798'];
  const particles = [];

  function init() {
    bindEvents();
    loop();
  }

  // Bind events that are needed
  function bindEvents() {
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onMouseMove);
  }

  function onMouseMove(e) {
    if (!_getData('showStars')) return;

    let x = 0,
      y = 0;
    if (e.type === 'touchmove') {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else if (e.type === 'mousemove') {
      x = e.clientX;
      y = e.clientY;
    }

    addParticle(
      x,
      y,
      possibleColors[Math.floor(Math.random() * possibleColors.length)]
    );
  }

  function addParticle(x, y, color) {
    const particle = new Particle();
    particle.init(x, y, color);
    particles.push(particle);
  }

  function updateParticles() {
    // Updated
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
    }

    // Remove dead particles
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].lifeSpan < 0) {
        particles[i].die();
        particles.splice(i, 1);
      }
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    updateParticles();
  }

  /**
   * Particles
   */
  function Particle() {
    this.character = '*';
    this.lifeSpan = 120; //ms
    this.initialStyles = {
      position: 'fixed',
      display: 'inline-block',
      top: '0px',
      left: '0px',
      pointerEvents: 'none',
      'touch-action': 'none',
      'z-index': '10000000',
      fontSize: '25px',
      'will-change': 'transform',
    };

    // Init, and set properties
    this.init = function (x, y, color) {
      this.velocity = {
        x: (Math.random() < 0.5 ? -1 : 1) * (Math.random() / 2),
        y: 1,
      };

      this.position = { x: x + 10, y: y + 10 };
      this.initialStyles.color = color;

      this.element = document.createElement('span');
      this.element.innerHTML = this.character;
      applyProperties(this.element, this.initialStyles);
      this.update();

      document.body.appendChild(this.element);
    };

    this.update = function () {
      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;
      this.lifeSpan--;

      this.element.style.transform =
        'translate3d(' +
        this.position.x +
        'px,' +
        this.position.y +
        'px, 0) scale(' +
        this.lifeSpan / 120 +
        ')';
    };

    this.die = function () {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    };
  }

  /**
   * Utils
   */

  // Applies css `properties` to an element.
  function applyProperties(target, properties) {
    for (let key in properties) {
      target.style[key] = properties[key];
    }
  }

  init();
})();
