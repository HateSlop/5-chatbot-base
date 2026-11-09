const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("username");
const nameSubmit = document.getElementById("name-submit");
const nameStatus = document.getElementById("name-status");
const playerGender = new URLSearchParams(window.location.search).get("gender");
if (playerGender === "male" || playerGender === "female") {
  window.history.replaceState(null, "", window.location.pathname);
} else {
  const choice = document.createElement("dialog");
  choice.className = "gender-dialog";
  choice.setAttribute("aria-labelledby", "gender-heading");
  choice.innerHTML = `<h2 id="gender-heading">주인공을 선택하세요</h2>
    <div class="gender-options">
      <a class="gender-option" data-gender="male" href="/chat?gender=male" aria-label="남성 주인공 선택"><span class="gender-art" role="img" aria-label="남성 주인공 그림 준비 중">그림 준비 중</span><strong>남</strong></a>
      <a class="gender-option" data-gender="female" href="/chat?gender=female" aria-label="여성 주인공 선택"><span class="gender-art" role="img" aria-label="여성 주인공 그림 준비 중">그림 준비 중</span><strong>여</strong></a>
    </div>
    <a id="gender-back" href="/">뒤로</a>`;
  document.body.append(choice);
  choice.showModal();
  choice.querySelector('.gender-option').focus();
}
let submittingName = false;

nameInput.addEventListener("input", () => {
  nameInput.removeAttribute("aria-invalid");
  nameStatus.textContent = "";
});

nameForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submittingName) return;
  const playerName = nameInput.value.trim();
  if (!playerName || Array.from(playerName).length > 50) {
    nameStatus.textContent = "이름을 공백을 제외한 1~50자로 입력해 주세요.";
    nameInput.setAttribute("aria-invalid", "true");
    nameInput.focus();
    return;
  }
  if (playerGender !== "male" && playerGender !== "female") return;
  submittingName = true;
  nameSubmit.disabled = true;
  nameInput.readOnly = true;
  nameForm.setAttribute("aria-busy", "true");
  nameStatus.textContent = "새 이야기를 준비하고 있습니다…";
  try {
    const response = await fetch("/api/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName, gender: playerGender }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "새 이야기를 시작하지 못했습니다.");
    if (typeof data.state_token !== "string" || !data.state_token || !Array.isArray(data.events) || !data.view) {
      throw new Error("시작 정보를 확인하지 못했습니다.");
    }
    window.startStory(data, playerName);
  } catch (error) {
    nameStatus.textContent = error.message || "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
    nameInput.focus();
  } finally {
    submittingName = false;
    nameSubmit.disabled = false;
    nameInput.readOnly = false;
    nameForm.setAttribute("aria-busy", "false");
  }
});
