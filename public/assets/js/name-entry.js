const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("username");
const nameSubmit = document.getElementById("name-submit");
const nameStatus = document.getElementById("name-status");
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
  submittingName = true;
  nameSubmit.disabled = true;
  nameInput.readOnly = true;
  nameForm.setAttribute("aria-busy", "true");
  nameStatus.textContent = "새 이야기를 준비하고 있습니다…";
  try {
    // Check storage access before requesting a new session. Merely opening this page writes nothing.
    const tokenKey = "new-village-state-v1";
    const transcriptKey = "new-village-transcript-v1";
    const oldToken = localStorage.getItem(tokenKey);
    const oldTranscript = localStorage.getItem(transcriptKey);
    const response = await fetch("/api/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_name: playerName }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "새 이야기를 시작하지 못했습니다.");
    if (typeof data.state_token !== "string" || !data.state_token || !Array.isArray(data.events) || !data.view) {
      throw new Error("시작 정보를 확인하지 못했습니다.");
    }
    const transcript = data.events.map(item => ({ speaker: item.speaker_id, text: item.text, image: item.image }));
    try {
      localStorage.setItem(transcriptKey, JSON.stringify(transcript));
      localStorage.setItem(tokenKey, data.state_token);
    } catch (error) {
      // Restore the previous pair if either storage write fails.
      if (oldTranscript === null) localStorage.removeItem(transcriptKey);
      else localStorage.setItem(transcriptKey, oldTranscript);
      if (oldToken === null) localStorage.removeItem(tokenKey);
      else localStorage.setItem(tokenKey, oldToken);
      throw error;
    }
    const next = new URL(nameForm.action, window.location.href);
    next.searchParams.set("username", playerName);
    // No start=new flag: the chat page resumes the session just created here.
    window.location.assign(next.href);
  } catch (error) {
    nameStatus.textContent = `${error.message || "요청을 처리하지 못했습니다."} 기존 진행은 유지됩니다. 다시 시도해 주세요.`;
    nameInput.focus();
  } finally {
    submittingName = false;
    nameSubmit.disabled = false;
    nameInput.readOnly = false;
    nameForm.setAttribute("aria-busy", "false");
  }
});
