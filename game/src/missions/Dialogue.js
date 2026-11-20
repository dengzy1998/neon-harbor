export const CAST = {
  otto: { name: 'Otto Lindqvist', role: 'Fixer', color: '#f59e0b' },
  mara: { name: 'Mara Venn', role: 'Runner', color: '#22d3ee' },
  ilya: { name: 'Captain Ilya Sorin', role: 'Smuggler', color: '#34d399' },
  bea: { name: 'Bea Lark', role: 'Club owner', color: '#f471b5' },
  tomas: { name: 'Tomas Rhee', role: 'Rival driver', color: '#a78bfa' },
  dispatch: { name: 'NHPD Dispatch', role: 'Police radio', color: '#60a5fa' },
};

export const PORTRAITS = {
  otto: { skin: '#d8ae8b', hair: '#b6b1a4', hairStyle: 'bald', shirt: '#394c60' },
  mara: { skin: '#b98060', hair: '#24212b', hairStyle: 'bun', shirt: '#237681' },
  ilya: { skin: '#c79a78', hair: '#353844', hairStyle: 'cap', shirt: '#33584e' },
  bea: { skin: '#80543f', hair: '#34212e', hairStyle: 'long', shirt: '#983f70' },
  tomas: { skin: '#dfb28e', hair: '#232532', hairStyle: 'wave', shirt: '#635288' },
  dispatch: { skin: '#ba8b6e', hair: '#46352e', hairStyle: 'short', shirt: '#345477' },
};

export function portraitSvg(key) {
  const { skin, hair, hairStyle, shirt } = PORTRAITS[key] || PORTRAITS.mara;
  const styles = {
    cap: '<path d="M14 21Q13 8 27 8Q40 8 40 20H14ZM12 20H44V23H12Z"/>',
    bun: '<circle cx="36" cy="10" r="6"/><path d="M14 25V20Q14 8 27 9Q41 9 40 25L35 17Q24 22 18 17Z"/>',
    short: '<path d="M14 25V19Q15 8 27 9Q40 9 40 20V25L35 17L20 19L17 26Z"/>',
    long: '<path d="M12 40V22Q11 7 27 8Q43 7 42 23V40L36 36V18Q25 23 18 18V37Z"/>',
    bald: '<path d="M14 26V21L17 18V27ZM37 18L40 21V26L37 27Z"/>',
    wave: '<path d="M14 26V20Q11 12 21 10Q32 3 40 14L38 24L34 17Q26 23 19 18L17 26Z"/>',
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
    <path d="M5 54V48Q7 37 22 37H32Q47 37 49 48V54Z" fill="${shirt}"/>
    <path d="M22 33H32V41Q27 45 22 41Z" fill="${skin}"/>
    <circle cx="27" cy="25" r="13" fill="${skin}"/>
    <g fill="${hair}">${styles[hairStyle]}</g>
    <g fill="#202633"><circle cx="22" cy="26" r="1.3"/><circle cx="32" cy="26" r="1.3"/></g>
    <path d="M24 33Q27 35 30 33" fill="none" stroke="#795447" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

export class Dialogue {
  constructor(elements = {}) {
    this.box = elements.box;
    this.portrait = elements.portrait;
    this.name = elements.name;
    this.text = elements.text;
    this.queue = [];
    this.currentLine = null;
    this.cursor = 0;
    this.hold = 0;
    this.staged = false;
    this._active = false;
    if (this.portrait) this.portrait.innerHTML = portraitSvg('mara');
    if (this.box) this.box.style.display = 'none';
  }

  show(castKey, text) {
    this.queue.push([castKey, text]);
    if (!this.currentLine) this._next();
  }

  showInstant(castKey, text) {
    this.clear();
    this.show(castKey, text);
    this.cursor = text.length;
    this.staged = true;
    if (this.text) this.text.textContent = text;
  }

  _next() {
    this.currentLine = this.queue.shift() || null;
    this.cursor = 0;
    this.hold = 0;
    this.staged = false;
    this._active = Boolean(this.currentLine);
    if (!this._active) {
      if (this.box) this.box.style.display = 'none';
      return;
    }
    const cast = CAST[this.currentLine[0]] || CAST.mara;
    if (this.box) this.box.style.display = '';
    if (this.name) {
      this.name.textContent = cast.name;
      this.name.style.color = cast.color;
    }
    if (this.portrait) this.portrait.innerHTML = portraitSvg(this.currentLine[0]);
    if (this.text) this.text.textContent = '';
  }

  update(dt) {
    if (!this.currentLine || this.staged) return;
    const full = this.currentLine[1];
    if (this.cursor < full.length) {
      this.cursor = Math.min(full.length, this.cursor + dt * 45);
      if (this.text) this.text.textContent = full.slice(0, Math.floor(this.cursor));
    } else {
      this.hold += dt;
      if (this.hold >= 1.6) this._next();
    }
  }

  skip() {
    if (!this.currentLine) return;
    if (this.cursor < this.currentLine[1].length) {
      this.cursor = this.currentLine[1].length;
      if (this.text) this.text.textContent = this.currentLine[1];
    } else {
      this._next();
    }
  }

  get active() {
    return this._active;
  }

  clear() {
    this.queue.length = 0;
    this.currentLine = null;
    this.staged = false;
    this._active = false;
    if (this.box) this.box.style.display = 'none';
  }
}
