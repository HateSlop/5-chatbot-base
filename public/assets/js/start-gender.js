const startAction = document.getElementById('start-action');
const genderDialog = document.getElementById('gender-dialog');

startAction.addEventListener('click', () => {
  genderDialog.showModal();
  genderDialog.querySelector('.gender-option').focus();
});
document.getElementById('gender-back').addEventListener('click', () => genderDialog.close());
genderDialog.addEventListener('close', () => startAction.focus());
