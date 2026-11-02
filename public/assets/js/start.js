const continueButton = document.getElementById("continue-story");
const saveStatus = document.getElementById("save-status");
function updateSavedStory() {
  try {
    const hasSave = !!localStorage.getItem("new-village-state-v1");
    continueButton.disabled = !hasSave;
    saveStatus.textContent = hasSave ? "" : "저장된 이야기가 없습니다";
  } catch {
    continueButton.disabled = true;
    saveStatus.textContent = "브라우저에서 저장 기록을 읽을 수 없습니다";
  }
}
continueButton.addEventListener("click", () => {
  if (!continueButton.disabled) window.location.assign(continueButton.dataset.href);
});
window.addEventListener("pageshow", updateSavedStory);
window.addEventListener("storage", updateSavedStory);
updateSavedStory();
