// 탈출 장면의 트럭 문 조작과 시간 경과를 표시한다.
// The server owns the deadline and whether the door opens.
window.TruckEscape = class {
  constructor(root, onAction, stage) {
    this.root = root;
    this.onAction = onAction;
    this.stage = stage;
    this.door = document.getElementById('truck-door-hotspot');
    this.counter = document.getElementById('truck-escape-timer');
    this.count = this.counter.querySelector('strong');
    this.version = 0;
    this.door.addEventListener('click', () => this.act('open_truck_door'));
    window.addEventListener('pagehide', () => this.reset());
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.position()).observe(root);
  }
  position() {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    const scale = Math.max(width / 1448, height / 1086);
    Object.assign(this.door.style, {left:`${(width - 1448 * scale) / 2}px`, top:`${(height - 1086 * scale) / 2}px`, width:`${1448 * scale}px`, height:`${1086 * scale}px`});
  }
  reset() {
    clearTimeout(this.timer);
    this.timer = null;
    ++this.version;
    this.scene = null;
    this.pending = false;
    this.readAt = null;
    this.retryAt = 0;
    this.door.hidden = this.counter.hidden = true;
  }
  update(view, busy) {
    if (!['truck_escape', 'truck_escape_result'].includes(view.scene_id)) { this.reset(); return; }
    if (this.scene !== view.scene_id) this.reset();
    this.scene = view.scene_id;
    this.deadline = view.truck_deadline;
    this.busy = busy;
    this.door.hidden = this.counter.hidden = this.scene !== 'truck_escape';
    this.door.disabled = busy || this.pending || !Number.isFinite(this.deadline) || Date.now() >= this.deadline;
    this.position();
    if (!this.timer && !this.pending) this.poll();
  }
  async poll() {
    this.timer = null;
    const version = this.version;
    try {
      if (this.busy || this.pending || Date.now() < this.retryAt) return;
      if (this.scene === 'truck_escape') {
        if (!Number.isFinite(this.deadline)) {
          this.count.textContent = '10';
          this.pending = true;
          await (this.stage.backgroundReady || this.stage.ready);
          if (version !== this.version) return;
          this.pending = false;
          await this.act('begin_truck_escape');
        } else {
          const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
          this.count.textContent = String(remaining);
          this.door.disabled = remaining === 0;
          if (!remaining) await this.act('truck_timeout');
        }
      } else if (this.scene === 'truck_escape_result') {
        if (this.root.dataset.dialogueComplete === 'true') this.readAt ??= Date.now();
        else this.readAt = null;
        if (this.readAt !== null && Date.now() - this.readAt >= 1500) await this.act('finish_truck_escape');
      }
    } finally {
      if (version === this.version && this.scene) this.timer = setTimeout(() => this.poll(), 100);
    }
  }
  async act(action) {
    if (!this.scene || this.pending || this.busy) return;
    if (action === 'open_truck_door') {
      if (this.scene !== 'truck_escape' || !Number.isFinite(this.deadline)) return;
      if (Date.now() >= this.deadline) action = 'truck_timeout';
    }
    const version = this.version;
    this.pending = true;
    this.door.disabled = true;
    try {
      const ok = await this.onAction(action);
      if (!ok && version === this.version) this.retryAt = Date.now() + 1000;
    } finally {
      if (version === this.version) this.pending = false;
    }
  }
};
