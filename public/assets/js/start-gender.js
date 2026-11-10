const startAction = document.getElementById('start-action');
const genderDialog = document.getElementById('gender-dialog');

startAction.addEventListener('click', () => {
  genderDialog.showModal();
  genderDialog.querySelector('.gender-option').focus();
});
genderDialog.addEventListener('close', () => startAction.focus());
