// 지하실 지갑의 열기·사진 조사 화면을 관리한다.
// Each reveal is confirmed by the server; closing never advances the story.
window.WalletInspection = class {
  constructor(dialog, onAction) {
    this.dialog = dialog;
    this.onAction = onAction;
    this.button = dialog.querySelector('[data-wallet-object]');
    this.image = dialog.querySelector('[data-wallet-image]');
    this.photo = dialog.querySelector('[data-wallet-photo]');
    this.caption = dialog.querySelector('[data-wallet-caption]');
    this.hint = dialog.querySelector('[data-wallet-hint]');
    this.button.addEventListener('click', () => this.reveal('open_wallet', 'open'));
    this.photo.addEventListener('click', () => this.reveal('inspect_wallet_photo', 'photo'));
    dialog.querySelector('[data-wallet-close]').addEventListener('click', () => this.close());
    dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    window.addEventListener('pagehide', () => this.close());
  }
  async open() {
    if (this.pending) return;
    this.pending = true;
    const version = this.version;
    try {
      if (!await this.onAction('inspect_wallet')) return;
      if (version !== this.version) return;
      this.show('closed');
      this.dialog.showModal();
    } finally { this.pending = false; }
  }
  show(side) {
    this.side = side;
    this.dialog.dataset.side = side;
    this.image.src = `/assets/images/wallet_${side}.png`;
    this.image.alt = side === 'photo' ? '지미와 다른 남자가 함께 찍힌 오래된 사진' : side === 'open' ? '열린 낡은 지갑' : '낡은 가죽 지갑';
    this.button.disabled = side !== 'closed';
    this.photo.hidden = side !== 'open';
    this.caption.textContent = '';
    this.hint.textContent = side === 'closed' ? '지갑을 눌러 열어보자' : side === 'open' ? '지갑 속 사진을 살펴보자' : '';
    if (side === 'photo') {
      const text = '지미…랑 옆에는 누구지…?';
      let length = 0;
      const type = () => {
        this.caption.textContent = text.slice(0, ++length);
        if (length < text.length) this.timer = setTimeout(type, 45);
      };
      type();
    }
  }
  async reveal(action, side) {
    if (this.pending || !this.dialog.open || this.side === 'photo') return;
    this.pending = true;
    this.button.disabled = this.photo.disabled = true;
    try {
      if (await this.onAction(action) && this.dialog.open) this.show(side);
      else if (this.dialog.open) this.hint.textContent = '불러오지 못했어요. 다시 눌러주세요.';
    } finally {
      this.pending = false;
      this.button.disabled = this.side !== 'closed';
      this.photo.disabled = false;
    }
  }
  close() {
    this.version = (this.version || 0) + 1;
    clearTimeout(this.timer);
    if (this.dialog.open) this.dialog.close();
  }
};
