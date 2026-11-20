export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.edges = new Set();
    this.buttons = new Set();
    this.dx = this.dy = 0;
    this.lockRequested = false;
    const doc = canvas.ownerDocument;
    const win = doc.defaultView;
    win.addEventListener('keydown', (e) => {
      if (!e.repeat && !this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
    });
    win.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('mousedown', (e) => this.buttons.add(e.button));
    win.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    win.addEventListener('mousemove', (e) => {
      if (doc.pointerLockElement === canvas || e.target === canvas) {
        this.dx += e.movementX || 0;
        this.dy += e.movementY || 0;
      }
    });
    win.addEventListener('blur', () => {
      this.keys.clear();
      this.buttons.clear();
      this.endFrame();
    });
    doc.addEventListener('pointerlockchange', () => {
      this.dx = this.dy = 0;
      if (doc.pointerLockElement !== canvas) this.buttons.clear();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('click', () => {
      if (!this.lockRequested || doc.pointerLockElement === canvas) return;
      try {
        canvas.requestPointerLock?.()?.catch(() => {});
      } catch {
        // A browser policy can deny lock; the next click can retry.
      }
    });
  }

  isDown(code) { return this.keys.has(code); }
  pressed(code) { return this.edges.has(code); }
  mouseDelta() { return { dx: this.dx, dy: this.dy }; }
  mouseDown(btn) { return this.buttons.has(btn); }
  lockPointer() { this.lockRequested = true; }
  endFrame() {
    this.edges.clear();
    this.dx = this.dy = 0;
  }
}
