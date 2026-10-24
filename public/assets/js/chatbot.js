const shell = document.querySelector(".chat-area");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-message");
const log = document.getElementById("chat-log");
const sendButton = document.getElementById("send-btn");

function addMessage(sender, text, image = null, sources = []) {
  const item = document.createElement("div");
  item.className = `message ${sender}`;

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "챗봇이 보낸 이미지";
    item.append(img);
  }

  const body = document.createElement("p");
  body.textContent = text;
  item.append(body);

  if (sources.length) {
    const reference = document.createElement("small");
    reference.className = "sources";
    reference.textContent = `참고 자료: ${sources.join(", ")}`;
    item.append(reference);
  }
  log.append(item);
  log.scrollTop = log.scrollHeight;
  return item;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || sendButton.disabled) return;

  addMessage("user", message);
  input.value = "";
  sendButton.disabled = true;
  const pending = addMessage("bot pending", "답변을 기다리는 중…");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, username: shell.dataset.username || "사용자" }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "답변을 받지 못했습니다.");
    }
    if (typeof data.reply !== "string") {
      throw new Error("서버 응답 형식이 올바르지 않습니다.");
    }
    pending.remove();
    addMessage("bot", data.reply, data.image, Array.isArray(data.sources) ? data.sources : []);
  } catch (error) {
    pending.remove();
    addMessage("bot error", error.message || "오류가 발생했습니다.");
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
});
