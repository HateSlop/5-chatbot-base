/* Presentation only: no story decisions, API calls or persistent state. */
window.DialogueStage = class {
  constructor(root) {
    this.root = root;
    this.background = root.querySelector('.dialogue-background');
    this.figure = root.querySelector('.dialogue-figure');
    this.tv = root.querySelector('.dialogue-tv');
    this.speaker = root.querySelector('.dialogue-speaker');
    this.text = root.querySelector('.dialogue-text');
    this.box = root.querySelector('.dialogue-box');
  }
  image(node, path, alt) {
    node.hidden = true;
    node.onload = () => { node.hidden = false; };
    node.onerror = () => { node.hidden = true; };
    node.alt = alt || '';
    if (path) node.src = path;
    else { node.onload = null; node.removeAttribute('src'); }
  }
  render({ background = null, image = null, object = null, speaker = '', text = '' }) {
    this.image(this.background, background, '현재 장소 배경');
    this.image(this.figure, image, object === 'tv' ? 'TV' : `${speaker}의 현재 모습`);
    this.tv.hidden = object !== 'tv' || !!image;
    // If a replacement TV asset fails, keep the CSS fallback available.
    this.figure.onerror = () => { this.figure.hidden = true; this.tv.hidden = object !== 'tv'; };
    this.speaker.textContent = speaker ? `${speaker}: ` : '';
    this.text.textContent = text;
    this.box.scrollTop = 0;
  }
};
