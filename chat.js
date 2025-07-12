const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessageButton = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = document.querySelector("#file-cancel");

// For single user mode, use user_id = 1
const USER_ID = 1;
const API_KEY = 'AIzaSyCy3_zainvL-YR1QGWLoBBZNGIGonsE9L4';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;


let userData = {
    message: null,
    file: { data: null, mime_type: null }
};

// Function to create chat messages
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

// Fetch AI response
const generateBotResponse = async (incomingMessageDiv) => {
    const messageElement = incomingMessageDiv.querySelector(".message-text");

    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: userData.file }] : [])]
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

// Handle user message
const handleOutgoingMessage = async (e) => {
    e.preventDefault();
    userData.message = messageInput.value.trim();
    messageInput.value = "";
    fileUploadWrapper.classList.remove("file-uploaded");

    if (!userData.message && !userData.file.data) return;

    // Creating user message
    const messageContent = `
        <div class="message-text">${userData.message}</div>
        ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment"/>` : ""}
    `;

    const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
    chatBody.appendChild(outgoingMessageDiv);

    // Save user message to backend
    await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: USER_ID,
            sender: 'user',
            text: userData.message,
            file: userData.file.data ? userData.file : null
        })
    });

    // Simulate bot response
    setTimeout(async () => {
        const botMessageContent = `
            <svg class="bot-avatar" xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 1024 1024">
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5z"></path>
            </svg>
            <div class="message-text">
                <div class="thinking-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;

        const incomingMessageDiv = createMessageElement(botMessageContent, "bot-message", "thinking");
        chatBody.appendChild(incomingMessageDiv);
        await generateBotResponse(incomingMessageDiv);

        // Save bot message to backend
        const botText = incomingMessageDiv.querySelector('.message-text').innerText;
        await fetch('http://localhost:5000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: USER_ID,
                sender: 'bot',
                text: botText,
                file: null
            })
        });
    }, 600);
};

// Load chat history on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadChatHistory();
});

async function loadChatHistory() {
    const res = await fetch(`http://localhost:5000/api/chat/${USER_ID}`);
    const data = await res.json();
    chatBody.innerHTML = '';
    if (data.messages && data.messages.length) {
        data.messages.forEach(msg => {
            const messageContent = `
                <div class="message-text">${msg.text || ''}</div>
                ${msg.file && msg.file.data ? `<img src="data:${msg.file.mime_type};base64,${msg.file.data}" class="attachment"/>` : ''}
            `;
            const msgDiv = createMessageElement(messageContent, msg.sender === 'user' ? 'user-message' : 'bot-message');
            chatBody.appendChild(msgDiv);
        });
        chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    } else {
        chatBody.innerHTML = `<div class=\"message bot-message\"><svg class=\"bot-avatar\" xmlns=\"http://www.w3.org/2000/svg\" width=\"50\" height=\"50\" viewBox=\"0 0 1024 1024\"></svg><div class=\"message-text\">Hey there <br>How can i help you today?</div></div>`;
    }
}

// Delete chat history
const deleteBtn = document.getElementById('delete-chat');
if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete the chat history?')) {
            await fetch(`http://localhost:5000/api/chat/${USER_ID}`, { method: 'DELETE' });
            await loadChatHistory();
        }
    });
}

// View chat history (reload)
const viewBtn = document.getElementById('view-history');
if (viewBtn) {
    viewBtn.addEventListener('click', async () => {
        await loadChatHistory();
    });
}

// Send message on Enter key press
messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && messageInput.value.trim()) {
        handleOutgoingMessage(e);
    }
});

// Handle file input
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

// Handle file cancel
fileCancelButton.addEventListener("click", () => {
    userData.file = { data: null, mime_type: null };
    fileUploadWrapper.classList.remove("file-uploaded");
    const previewImg = fileUploadWrapper.querySelector("img");
    if (previewImg) previewImg.remove();
});


// Handle file upload button click
document.querySelector("#file-upload").addEventListener("click", () => {
    fileInput.click();
});

// Handle send button click
sendMessageButton.addEventListener("click", (e) => {
    handleOutgoingMessage(e);
});