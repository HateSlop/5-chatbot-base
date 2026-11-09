// The server owns the deadline and ending; this dialog only displays and submits them.
window.FestivalChoice = class {
  constructor(dialog, onAction) {
    this.dialog = dialog;
    this.onAction = onAction;
    this.count = dialog.querySelector('[data-choice-count]');
    this.status = dialog.querySelector('[data-choice-status]');
    this.buttons = [...dialog.querySelectorAll('[data-choice-action]')];
    for (const button of this.buttons) button.addEventListener('click', () => this.choose(button.dataset.choiceAction));
    dialog.addEventListener('cancel', event => event.preventDefault());
    window.addEventListener('pagehide', () => this.reset());
  }
  reset() {
    clearTimeout(this.timer);
    this.phase = null;
    this.readAt = null;
    this.locked = false;
    if (this.dialog.open) this.dialog.close();
  }
  update({reading, ready, deadline, busy = false}) {
    this.busy = busy;
    if (Number.isFinite(deadline)) {
      if (this.phase === 'choice' && this.deadline === deadline) {
        for (const button of this.buttons) button.disabled = busy || this.locked || Date.now() >= deadline;
        return;
      }
      this.reset();
      this.phase = 'choice';
      this.deadline = deadline;
      this.status.textContent = '';
      this.dialog.showModal();
      this.tick();
      this.buttons[0].focus();
      return;
    }
    if (!reading) { this.reset(); return; }
    this.ready = ready;
    if (this.phase === 'reading') return;
    this.reset();
    this.phase = 'reading';
    this.poll();
  }
  poll() {
    if (this.phase !== 'reading') return;
    if (this.ready()) this.readAt ??= Date.now();
    else this.readAt = null;
    if (this.readAt !== null && Date.now() - this.readAt >= 1500) {
      const run = this.phase;
      this.onAction('begin_final_choice').then(() => {
        if (this.phase === run) { this.readAt = null; this.timer = setTimeout(() => this.poll(), 1000); }
      });
      return;
    }
    this.timer = setTimeout(() => this.poll(), 100);
  }
  tick() {
    if (this.phase !== 'choice') return;
    const remaining = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
    this.count.textContent = String(remaining);
    for (const button of this.buttons) button.disabled = this.busy || this.locked || remaining === 0;
    if (!remaining && !this.locked && !this.busy) { this.choose('choice_timeout'); return; }
    this.timer = setTimeout(() => this.tick(), 100);
  }
  async choose(action) {
    if (this.phase !== 'choice' || this.locked || this.busy) return;
    if (Date.now() >= this.deadline) action = 'choice_timeout';
    this.locked = true;
    clearTimeout(this.timer);
    for (const button of this.buttons) button.disabled = true;
    const deadline = this.deadline;
    const ok = await this.onAction(action);
    if (this.phase !== 'choice' || deadline !== this.deadline) return;
    if (!ok) {
      this.locked = false;
      this.status.textContent = '연결을 확인하고 다시 시도합니다…';
      this.timer = setTimeout(() => this.tick(), 1000);
    }
  }
};
