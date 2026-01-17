export class CircularProgressBar {
  constructor(container, options = {}) {
    this.container = container;
    this.color = options.color || '#198754';
    this.bgColor = options.bgColor || '#888888';
    this.strokeWidth = options.strokeWidth || 10;
    this.max = options.max || 100;
    this.value = options.value || 0;
    this.title = options.title || '';

    this.createElements();
    this.setProgress(this.value);
  }

  createElements() {
    const wrapper = document.createElement('div');
    const circleRadius = 45;
    const circumference = 2 * Math.PI * circleRadius;

    Object.assign(wrapper.style, {
      position: 'relative',
      width: '100%',
      height: '100%',
    });

    wrapper.innerHTML = `
  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="width:100%; height:100%; display:block; transform:rotate(-90deg);">
    <circle
      cx="50" cy="50" r="${circleRadius}"
      stroke="${this.bgColor}"
      stroke-width="${this.strokeWidth}"
      fill="none"
    />
    <circle
      class="progress-ring"
      cx="50" cy="50" r="${circleRadius}"
      stroke="${this.color}"
      stroke-width="${this.strokeWidth}"
      fill="none"
      stroke-linecap="round"
      stroke-dasharray="${circumference}"
      stroke-dashoffset="${circumference}"
    />
  </svg>
  <div class="progress-text">
    <div class="progress-value">${this.value}</div>
    <div class="title">${this.title}</div>
  </div>
`;

    const textDiv = wrapper.querySelector('.progress-text');
    Object.assign(textDiv.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexFlow: 'column',
    });

    this.wrapper = wrapper;
    this.progressCircle = wrapper.querySelector('.progress-ring');
    this.progressCircle.style.transition = 'stroke-dashoffset 0.6s ease, stroke 0.3s ease';
    this.setColor(this.color);
    this.progressText = textDiv;
    this.titleDiv = wrapper.querySelector('.title');
    this.valueDiv = wrapper.querySelector('.progress-value');
    this.titleDiv.style.fontSize = '0.6em';
    this.circumference = circumference;

    this.container.appendChild(wrapper);
  }
  setColor(color) {
    this.color = color;
    this.progressCircle.style.stroke = color;
    return this;
  }
  setProgress(value = 0, title = '') {
    this.value = Math.min(Math.max(value, 0), this.max);
    const percent = this.value / this.max;
    const offset = this.circumference * (1 - percent);
    this.progressCircle.style.strokeDashoffset = offset;
    this.valueDiv.textContent = `${Math.round(percent * 100)}%`;
    this.titleDiv.textContent = title;
    return this;
  }
}
