const startAction = document.getElementById('start-action');
const genderDialog = document.getElementById('gender-dialog');

startAction.addEventListener('click', () => {
  genderDialog.showModal();
  genderDialog.querySelector('.gender-option').focus();
});
genderDialog.addEventListener('close', () => startAction.focus());
if (typeof URLSearchParams !== 'undefined' && window.location?.search && new URLSearchParams(window.location.search).has('autostart')) {
  window.history.replaceState(null, '', '/');
  startAction.click();
}
