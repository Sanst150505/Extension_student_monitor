const API_BASE = "http://localhost:8000";
const CAPTURE_INTERVAL = 1500;
const IDLE_THRESHOLD = 10000;
const IDLE_CHECK_INTERVAL = 3000;
const MAX_CANVAS_WIDTH = 640;

let video = null;
let requestInFlight = false;
let lastActive = Date.now();
let studentConfig = {
  session_id: "demo_session",
  student_id: "demo_user",
  name: "Student",
  subject: "General",
  batch: "General",
  meet_link: window.location.href,
};

const overlay = createOverlay();
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("Extension runtime unavailable"));
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown extension error"));
        return;
      }
      resolve(response);
    });
  });
}

function createOverlay() {
  const existing = document.getElementById("ai-live-overlay");
  if (existing) return existing;

  const panel = document.createElement("div");
  panel.id = "ai-live-overlay";
  panel.style.cssText = `
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 2147483647;
    width: 320px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(10, 16, 28, 0.92);
    color: #f7fbff;
    box-shadow: 0 18px 40px rgba(0,0,0,0.28);
    backdrop-filter: blur(14px);
    font-family: Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  `;

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;">
      <div>
        <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8ea0b8;">Class Monitor</div>
        <div id="ai-overlay-name" style="font-size:14px;font-weight:700;line-height:1.2;">Preparing monitor</div>
      </div>
      <div id="ai-overlay-connection" style="font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.08);">Idle</div>
    </div>
    <div style="display:grid;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:end;">
        <span style="color:#9fb2c7;font-size:12px;">Engagement score</span>
        <strong id="ai-overlay-score" style="font-size:30px;line-height:1;">--</strong>
      </div>
      <div style="height:8px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;">
        <div id="ai-overlay-meter" style="height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#24d18f,#f6c34a,#ef5c5c);"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#a9bdd1;">
        <span id="ai-overlay-attention">Attention: --</span>
        <span id="ai-overlay-emotion">Emotion: --</span>
        <span id="ai-overlay-head">Head: --</span>
        <span id="ai-overlay-phone">Phone: --</span>
      </div>
    </div>
  `;

  document.documentElement.appendChild(panel);
  return panel;
}

function updateOverlay(payload, connectionState = "Active") {
  const scoreNode = document.getElementById("ai-overlay-score");
  const meterNode = document.getElementById("ai-overlay-meter");
  const nameNode = document.getElementById("ai-overlay-name");
  const connectionNode = document.getElementById("ai-overlay-connection");
  const attentionNode = document.getElementById("ai-overlay-attention");
  const emotionNode = document.getElementById("ai-overlay-emotion");
  const headNode = document.getElementById("ai-overlay-head");
  const phoneNode = document.getElementById("ai-overlay-phone");

  if (nameNode) nameNode.textContent = `${studentConfig.name || "Student"} · ${studentConfig.subject || "General"}`;
  if (connectionNode) connectionNode.textContent = connectionState;

  if (!payload) {
    if (attentionNode) attentionNode.textContent = "Attention: waiting";
    if (emotionNode) emotionNode.textContent = `Emotion: ${studentConfig.batch || "General"}`;
    if (headNode) headNode.textContent = "Head: --";
    if (phoneNode) phoneNode.textContent = "Phone: --";
    return;
  }

  const score = Math.max(0, Math.min(100, Math.round(payload.engagement?.smooth_score ?? 0)));
  const attentionStatus = payload.attention?.status || payload.engagement?.attention_status || "Unknown";
  const emotion = payload.emotion || payload.engagement?.emotion || "Unknown";
  const headDirection = payload.pose?.head_direction || "Unknown";
  const phoneDetected = payload.phone?.phone_detected ? "Detected" : "Clear";

  if (scoreNode) scoreNode.textContent = `${score}`;
  if (meterNode) meterNode.style.width = `${score}%`;
  if (attentionNode) attentionNode.textContent = `Attention: ${attentionStatus}`;
  if (emotionNode) emotionNode.textContent = `Emotion: ${emotion}`;
  if (headNode) headNode.textContent = `Head: ${headDirection}`;
  if (phoneNode) phoneNode.textContent = `Phone: ${phoneDetected}`;
}

function loadSessionConfig() {
  sendRuntimeMessage({ type: "GET_CONFIG" })
    .then((response) => {
      const stored = response.profile || {};
      studentConfig = {
        session_id: stored.session_id || "demo_session",
        student_id: stored.student_id || "demo_user",
        name: stored.name || "Student",
        subject: stored.subject || "General",
        batch: stored.batch || "General",
        meet_link: stored.meet_link || window.location.href,
      };
      updateOverlay(null, "Ready");
    })
    .catch((error) => {
      console.error("[AI Monitor] Failed to load session config", error);
      updateOverlay(null, "Ready");
    });
}

if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "CONFIG_UPDATED") {
      return;
    }

    const next = message.profile || {};
    studentConfig = {
      session_id: next.session_id || studentConfig.session_id,
      student_id: next.student_id || studentConfig.student_id,
      name: next.name || studentConfig.name,
      subject: next.subject || studentConfig.subject,
      batch: next.batch || studentConfig.batch,
      meet_link: next.meet_link || studentConfig.meet_link,
    };
    updateOverlay(null, "Ready");
  });
}

function sendEvent(type, details = {}) {
  fetch(`${API_BASE}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      session_id: studentConfig.session_id,
      student_id: studentConfig.student_id,
      student_name: studentConfig.name,
      subject: studentConfig.subject,
      batch: studentConfig.batch,
      meet_link: studentConfig.meet_link,
      ...details,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  sendEvent(document.hidden ? "TAB_SWITCH" : "TAB_RETURN");
});

document.addEventListener("mousemove", () => { lastActive = Date.now(); });
document.addEventListener("keydown", () => { lastActive = Date.now(); });
document.addEventListener("click", () => { lastActive = Date.now(); });
document.addEventListener("scroll", () => { lastActive = Date.now(); });

setInterval(() => {
  if (Date.now() - lastActive > IDLE_THRESHOLD) {
    sendEvent("IDLE");
  }
}, IDLE_CHECK_INTERVAL);

function getVideo() {
  const videos = document.querySelectorAll("video");
  for (const element of videos) {
    if (element.videoWidth > 0 && element.videoHeight > 0 && !element.paused) {
      return element;
    }
  }
  return null;
}

const observer = new MutationObserver(() => {
  if (!video || video.videoWidth === 0) {
    video = getVideo();
  }
});

function startObserver() {
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    setTimeout(startObserver, 500);
  }
}

function fetchQuestion(difficulty) {
  const topic = studentConfig.subject || "General Science & Math";

  fetch(`${API_BASE}/generate-question?topic=${encodeURIComponent(topic)}&difficulty=${difficulty || "medium"}`)
    .then((response) => response.json())
    .then((questionData) => {
      if (questionData?.question) {
        showQuestionPopup(questionData);
      }
    })
    .catch(() => {});
}

function showQuestionPopup(data) {
  const existing = document.getElementById("ai-attention-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "ai-attention-popup";
  popup.dataset.questionId = data.question_id;
  popup.dataset.startedAt = String(Date.now());
  popup.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 360px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    padding: 20px;
    z-index: 999999;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
  `;

  if (!document.getElementById("ai-popup-styles")) {
    const style = document.createElement("style");
    style.id = "ai-popup-styles";
    style.innerHTML = `
      .ai-option-btn {
        display: block;
        width: 100%;
        padding: 12px;
        margin: 8px 0;
        border: 1px solid rgba(0,0,0,0.1);
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        font-size: 14px;
        color: #333;
      }
      .ai-option-btn:hover {
        background: #f0f7ff;
        border-color: #007bff;
      }
      .ai-option-btn.correct {
        background: #d4edda !important;
        border-color: #28a745 !important;
        color: #155724 !important;
      }
      .ai-option-btn.wrong {
        background: #f8d7da !important;
        border-color: #dc3545 !important;
        color: #721c24 !important;
      }
    `;
    document.head.appendChild(style);
  }

  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="color:#007bff;font-weight:700;">Quick Check</div>
      <div style="font-size:12px;color:#56657d;">${data.difficulty || "medium"} level</div>
    </div>
  `;

  const question = document.createElement("div");
  question.style.cssText = "font-weight: 600; margin: 12px 0 15px; line-height: 1.4; font-size: 15px;";
  question.innerText = data.question;
  popup.appendChild(question);

  const optionsContainer = document.createElement("div");
  data.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "ai-option-btn";
    button.innerText = option;
    button.onclick = () => handleAnswer(option, data, button, popup);
    optionsContainer.appendChild(button);
  });

  popup.appendChild(optionsContainer);
  document.body.appendChild(popup);
}

function handleAnswer(selected, questionData, selectedButton, popup) {
  const buttons = popup.querySelectorAll(".ai-option-btn");
  buttons.forEach((button) => {
    button.disabled = true;
  });

  const correctAnswer = questionData.answer;
  if (selected === correctAnswer) {
    selectedButton.classList.add("correct");
  } else {
    selectedButton.classList.add("wrong");
    buttons.forEach((button) => {
      if (button.innerText === correctAnswer) {
        button.classList.add("correct");
      }
    });
  }

  const startedAt = Number(popup.dataset.startedAt || Date.now());
  const responseTime = Number(((Date.now() - startedAt) / 1000).toFixed(1));

  fetch(`${API_BASE}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question_id: questionData.question_id,
      session_id: studentConfig.session_id,
      student_id: studentConfig.student_id,
      subject: studentConfig.subject,
      batch: studentConfig.batch,
      answer: selected,
      correct: correctAnswer,
      response_time: responseTime,
    }),
  })
    .then((response) => response.json())
    .then(() => {
      setTimeout(() => popup.remove(), 2200);
    })
    .catch(() => {});
}

setInterval(() => {
  if (requestInFlight) return;

  video = getVideo();
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    updateOverlay(null, "No camera");
    return;
  }

  const scale = Math.min(1, MAX_CANVAS_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    ctx.getImageData(0, 0, 1, 1).data;
  } catch {
    updateOverlay(null, "Blocked");
    return;
  }

  requestInFlight = true;

  canvas.toBlob((blob) => {
    if (!blob || blob.size < 100) {
      requestInFlight = false;
      return;
    }

    fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: {
        "X-Session-Id": studentConfig.session_id,
        "X-Student-Id": studentConfig.student_id,
        "X-Student-Name": encodeURIComponent(studentConfig.name),
        "X-Student-Subject": encodeURIComponent(studentConfig.subject),
        "X-Student-Batch": encodeURIComponent(studentConfig.batch),
        "X-Meet-Link": encodeURIComponent(studentConfig.meet_link),
      },
      body: blob,
    })
      .then((response) => response.json())
      .then((data) => {
        updateOverlay(data, "Monitoring");
        if (data.ask_question) {
          fetchQuestion(data.difficulty);
        }
        requestInFlight = false;
      })
      .catch((error) => {
        console.error("[AI Monitor] Backend error", error);
        updateOverlay(null, "Backend error");
        requestInFlight = false;
      });
  }, "image/jpeg", 0.8);
}, CAPTURE_INTERVAL);

loadSessionConfig();
startObserver();
