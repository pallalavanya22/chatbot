const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = document.querySelector("#file-cancel");

// Define userId safely
const userId = localStorage.getItem("userId");

// Gemini API
const API_KEY = 'Your API KEY';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

let userData = {
  message: null,
  file: { data: null, mime_type: null }
};

// Create message div
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Fetch Gemini API response
const generateBotResponse = async (incomingMessageDiv) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");

  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: userData.message },
          ...(userData.file.data ? [{ inline_data: userData.file }] : [])
        ]
      }]
    })
  };

  try {
    const response = await fetch(API_URL, requestOptions);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    const apiResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1 ").trim();
    messageElement.innerText = apiResponseText;
  } catch (error) {
    console.error(error);
    messageElement.innerText = error.message;
    messageElement.style.color = "#ff0000";
  } finally {
    userData.file = { data: null, mime_type: null };
    incomingMessageDiv.classList.remove("thinking");
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }
};

// Handle sending message
const handleOutgoingMessage = async (e) => {
  e.preventDefault();
  userData.message = messageInput.value.trim();
  messageInput.value = "";
  fileUploadWrapper.classList.remove("file-uploaded");

  if (!userData.message && !userData.file.data) return;

  const messageContent = `
    <div class="message-text">${userData.message}</div>
    ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment"/>` : ""}
  `;

  const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
  chatBody.appendChild(outgoingMessageDiv);

  // Save user message to backend (optional: backend must be running)
  try {
    await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sender: 'user',
        text: userData.message,
        file: userData.file.data ? userData.file : null
      })
    });
  } catch (err) {
    console.warn("Backend not reachable:", err.message);
  }

  // Show thinking
  const botMessageContent = `
    <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
      <path d="..."></path>
    </svg>
    <div class="message-text">
      <div class="thinking-indicator">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
      </div>
    </div>
  `;
  const incomingMessageDiv = createMessageElement(botMessageContent, "bot-message", "thinking");
  chatBody.appendChild(incomingMessageDiv);

  await generateBotResponse(incomingMessageDiv);

  // Save bot response (optional)
  const botText = incomingMessageDiv.querySelector('.message-text').innerText;
  try {
    await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sender: 'bot',
        text: botText,
        file: null
      })
    });
  } catch (err) {
    console.warn("Backend not reachable for bot save:", err.message);
  }
};

// Load previous chat on load
window.addEventListener('DOMContentLoaded', async () => {
  if (!userId) return;
  try {
    const res = await fetch(`http://localhost:5000/api/chat/${userId}`);
    const data = await res.json();
    if (data.messages?.length) {
      data.messages.forEach(msg => {
        const messageContent = `
          <div class="message-text">${msg.text || ''}</div>
          ${msg.file?.data ? `<img src="data:${msg.file.mime_type};base64,${msg.file.data}" class="attachment"/>` : ''}
        `;
        const msgDiv = createMessageElement(messageContent, msg.sender === 'user' ? 'user-message' : 'bot-message');
        chatBody.appendChild(msgDiv);
      });
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }
  } catch (err) {
    console.warn("Chat history load failed:", err.message);
  }
});

// Send on Enter
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && messageInput.value.trim()) {
    handleOutgoingMessage(e);
  }
});

// Upload image
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    let previewImg = fileUploadWrapper.querySelector("img");
    if (!previewImg) {
      previewImg = document.createElement("img");
      fileUploadWrapper.appendChild(previewImg);
    }
    previewImg.src = e.target.result;
    fileUploadWrapper.classList.add("file-uploaded");

    const base64String = e.target.result.split(",")[1];
    userData.file = { data: base64String, mime_type: file.type };
    fileInput.value = "";
  };
  reader.readAsDataURL(file);
});

// Cancel file
fileCancelButton.addEventListener("click", () => {
  userData.file = { data: null, mime_type: null };
  fileUploadWrapper.classList.remove("file-uploaded");
  const previewImg = fileUploadWrapper.querySelector("img");
  if (previewImg) previewImg.remove();
});

// Trigger upload
document.querySelector("#file-upload").addEventListener("click", () => {
  fileInput.click();
});

// Send button
sendMessageButton.addEventListener("click", (e) => {
  handleOutgoingMessage(e);
});
