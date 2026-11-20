/** Menu callbacks are replaced on every show, never accumulated on buttons. */
export class Menus {
  constructor(doc = document) {
    this.doc = doc;
    this.root = doc.getElementById('menus');
    this.blocks = {
      title: doc.getElementById('menu-title'),
      pause: doc.getElementById('menu-pause'),
      end: doc.getElementById('menu-end'),
      results: doc.getElementById('menu-results'),
    };
    this.buttons = {
      start: doc.getElementById('btn-start'),
      continue: doc.getElementById('btn-continue'),
      resume: doc.getElementById('btn-resume'),
      restart: doc.getElementById('btn-restart'),
      retry: doc.getElementById('btn-retry'),
      close: doc.getElementById('btn-results-close'),
    };
    this.endTitle = doc.getElementById('end-title');
    this.endDetail = doc.getElementById('end-detail');
    this.resultsTitle = doc.getElementById('results-title');
    this.resultsDetail = doc.getElementById('results-detail');
    this.callbacks = {};
    this.active = null;
    this.listeners = [];
    this.bind('start');
    this.bind('continue');
    this.bind('resume');
    this.bind('restart');
    this.bind('retry');
    this.bind('close');
    this.configureAccessibility();
    this.hideAll();
  }

  configureAccessibility() {
    // Each visible block is an independent modal interaction surface.
    for (const [name, block] of Object.entries(this.blocks)) {
      if (!block) {
        throw new Error(`Missing menu block: ${name}`);
      }
      block.setAttribute('role', 'dialog');
      block.setAttribute('aria-modal', 'true');
      const heading = block.querySelector('h1, h2');
      if (heading) {
        if (!heading.id) {
          heading.id = `menu-heading-${name}`;
        }
        block.setAttribute('aria-labelledby', heading.id);
      }
    }
  }

  bind(name) {
    const button = this.buttons[name];
    if (!button) {
      throw new Error(`Missing menu button: ${name}`);
    }
    const listener = () => {
      const callback = this.callbacks[name];
      if (typeof callback !== 'function') {
        return;
      }
      // Hide first: a callback may synchronously open a different menu.
      this.hideAll();
      callback();
    };
    button.addEventListener('click', listener);
    this.listeners.push({ button, listener });
  }

  show(name) {
    this.hideAll();
    const block = this.blocks[name];
    if (!block) {
      throw new Error(`Unknown menu: ${name}`);
    }
    this.active = name;
    this.root.hidden = false;
    this.root.classList.add('on');
    block.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    // Pointer lock would swallow the first click on a menu button.
    if (this.doc.pointerLockElement) {
      this.doc.exitPointerLock?.();
    }
  }

  focus(name) {
    const button = this.buttons[name];
    if (button && !button.hidden) {
      button.focus({ preventScroll: true });
    }
  }

  showTitle({ hasSave = false, onStart, onContinue } = {}) {
    this.show('title');
    this.callbacks = {
      start: onStart,
      continue: hasSave ? onContinue : null,
    };
    this.buttons.continue.hidden = !hasSave;
    this.buttons.continue.disabled = !hasSave;
    this.focus(hasSave ? 'continue' : 'start');
  }

  showPause({ onResume, onRestart } = {}) {
    this.show('pause');
    this.callbacks = {
      resume: onResume,
      restart: onRestart,
    };
    this.focus('resume');
  }

  showEnd(kind, detail, { onRetry } = {}) {
    this.show('end');
    const title = kind === 'BUSTED' ? 'BUSTED' : 'WASTED';
    this.endTitle.textContent = title;
    this.endDetail.textContent = detail || '';
    this.blocks.end.dataset.kind = title.toLowerCase();
    this.callbacks = {
      retry: onRetry,
    };
    this.focus('retry');
  }

  showResults({ title, cash = 0, rp = 0 } = {}, { onClose } = {}) {
    this.show('results');
    this.resultsTitle.textContent = title || 'JOB COMPLETE';
    const cashAmount = Math.round(Number(cash) || 0).toLocaleString('en-US');
    const rpAmount = Math.round(Number(rp) || 0).toLocaleString('en-US');
    this.resultsDetail.textContent = `+$${cashAmount} · +${rpAmount} RP`;
    this.callbacks = {
      close: onClose,
    };
    this.focus('close');
  }

  hideAll() {
    for (const block of Object.values(this.blocks)) {
      if (block) {
        block.hidden = true;
      }
    }
    if (this.root) {
      this.root.hidden = true;
      this.root.classList.remove('on');
      this.root.setAttribute('aria-hidden', 'true');
    }
    this.active = null;
    this.callbacks = {};
  }

  get anyOpen() {
    return this.active !== null;
  }

  get isTitle() {
    return this.active === 'title';
  }

  get isPause() {
    return this.active === 'pause';
  }

  get isEnd() {
    return this.active === 'end';
  }

  get isResults() {
    return this.active === 'results';
  }

  destroy() {
    // Useful when a host tears down the game without navigating away.
    for (const { button, listener } of this.listeners) {
      button.removeEventListener('click', listener);
    }
    this.listeners.length = 0;
    this.hideAll();
  }
}
