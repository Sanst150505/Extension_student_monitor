// ================= CONFIG =================

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";
const CAPTURE_INTERVAL = 1000;
const IDLE_THRESHOLD = 10000;
const IDLE_CHECK_INTERVAL = 3000;
const MAX_CANVAS_WIDTH = 640;
const STORAGE_KEY = "ai_monitor_student_profile";

// ================= STATE =================

let video = null;
let requestInFlight = false;
let socket = null;
let reconnectTimer = null;
let isInitializingConfig = false;
let studentConfig = {
  student_id: crypto.randomUUID(),
  name: "Student",
  subject: "General",
  meet_link: window.location.href,
  session_id: "",
};

// ================= OVERLAY =================

const overlay = createOverlay();

function createOverlay() {
  const existing = document.getElementById("ai-live-overlay");
  if (existing) {
    return existing;
  }

  const panel = document.createElement("div");
  panel.id = "ai-live-overlay";
  panel.style.cssText = `
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 2147483647;
    width: 250px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(10, 16, 28, 0.88);
    color: #f7fbff;
    box-shadow: 0 18px 40px rgba(0,0,0,0.28);
    backdrop-filter: blur(14px);
    font-family: Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  `;

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px;">
      <div>
        <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8ea0b8;">Live Attention</div>
        <div id="ai-overlay-name" style="font-size:14px;font-weight:700;line-height:1.2;">Waiting for session</div>
      </div>
      <div id="ai-overlay-connection" style="font-size:11px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.08);">Disconnected</div>
    </div>
    <div style="display:grid;gap:10px;">
      <div style="display:flex;justify-content:space-between;align-items:end;">
        <span style="color:#9fb2c7;font-size:12px;">Attention score</span>
        <strong id="ai-overlay-score" style="font-size:30px;line-height:1;">--</strong>
      </div>
      <div style="height:8px;border-radius:999px;background:rgba(255,255,255,0.08);overflow:hidden;">
        <div id="ai-overlay-meter" style="height:100%;width:0%;border-radius:inherit;background:linear-gradient(90deg,#24d18f,#f6c34a,#ef5c5c);"></div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#a9bdd1;">
        <span id="ai-overlay-status">Status: idle</span>
        <span id="ai-overlay-meta">Meet: --</span>
      </div>
    </div>
  `;

  document.documentElement.appendChild(panel);
  return panel;
}

function updateOverlay(payload, connectionState) {
  const scoreNode = document.getElementById("ai-overlay-score");
  const statusNode = document.getElementById("ai-overlay-status");
  const meterNode = document.getElementById("ai-overlay-meter");
  const nameNode = document.getElementById("ai-overlay-name");
  const connectionNode = document.getElementById("ai-overlay-connection");
  const metaNode = document.getElementById("ai-overlay-meta");

  if (nameNode) {
    nameNode.textContent = studentConfig.name || "Student";
  }

  if (connectionNode) {
    connectionNode.textContent = connectionState || "Disconnected";
  }

  if (!payload) {
    if (statusNode) statusNode.textContent = "Status: idle";
    if (metaNode) metaNode.textContent = `Meet: ${studentConfig.meet_link || "--"}`;
    return;
  }

  if (scoreNode) scoreNode.textContent = `${Math.round(payload.attention_score ?? 0)}`;
  if (statusNode) statusNode.textContent = `Status: ${payload.status || "idle"}`;
  if (meterNode) meterNode.style.width = `${Math.max(0, Math.min(100, payload.attention_score ?? 0))}%`;
  if (metaNode) metaNode.textContent = `Meet: ${studentConfig.meet_link ? "connected" : "--"}`;
}

// ================= STORAGE / WEBSOCKET =================

function ensureMeetLink(value) {
  return value || window.location.href || "unassigned";
}

function computeTelemetryScore(result) {
  const primaryFace = Array.isArray(result?.faces) && result.faces.length ? result.faces[0] : null;
  const faceDetected = Boolean(result?.face || result?.face_count || primaryFace);
  const gazeDirection = primaryFace?.gaze_direction || "Center";
  const headPose = result?.pose?.head_direction || "Forward";
  const blinkRate = Number(primaryFace?.blink_rate ?? 0);
  const yawning = Boolean(primaryFace?.yawning);

  const faceScore = faceDetected ? 100 : 0;

  const gazeScore = (() => {
    if (!faceDetected) return 0;
    if (gazeDirection === "Center" || gazeDirection === "Forward") return 100;
    if (gazeDirection === "Left" || gazeDirection === "Right") return 60;
    return 40;
  })();

  const headPoseScore = (() => {
    if (headPose === "Forward" || headPose === "Center") return 100;
    if (headPose === "Left" || headPose === "Right") return 65;
    if (headPose === "Up") return 75;
    if (headPose === "Down") return 25;
    return 55;
  })();

  const blinkScore = (() => {
    if (blinkRate >= 8 && blinkRate <= 25) return 100;
    if ((blinkRate >= 5 && blinkRate < 8) || (blinkRate > 25 && blinkRate <= 30)) return 75;
    if (blinkRate > 0) return 45;
    return 0;
  })();

  const noYawningScore = yawning ? 0 : 100;
  const score = Math.round(
    0.4 * faceScore +
      0.2 * gazeScore +
      0.15 * headPoseScore +
      0.15 * blinkScore +
      0.1 * noYawningScore
  );

  const status = yawning ? "Bored" : score > 75 ? "Focused" : score >= 50 ? "Slightly distracted" : "Highly distracted";

  return {
    student_id: studentConfig.student_id,
    name: studentConfig.name,
    subject: studentConfig.subject,
    meet_link: studentConfig.meet_link,
    timestamp: new Date().toISOString(),
    attention_score: score,
    face_detected: faceDetected,
    gaze_direction: gazeDirection,
    blink_rate: blinkRate,
    head_pose: headPose,
    yawning,
    status,
    metrics: {
      face_score: faceScore,
      gaze_score: gazeScore,
      head_pose_score: headPoseScore,
      blink_score: blinkScore,
      no_yawning_score: noYawningScore,
      processing_time_ms: result?.processing_time_ms ?? 0,
      emotion: result?.emotion || "Unknown",
      phone_detected: Boolean(result?.phone?.phone_detected),
      face_count: result?.face_count ?? 0,
      pose: result?.pose || {},
    },
  };
}

function connectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
  }

  if (!studentConfig.meet_link) {
    updateOverlay(null, "Disconnected");
    return;
  }

  const wsUrl = new URL(`${WS_BASE}/ws/student`);
  wsUrl.searchParams.set("student_id", studentConfig.student_id);
  wsUrl.searchParams.set("name", studentConfig.name || "Student");
  wsUrl.searchParams.set("subject", studentConfig.subject || "General");
  wsUrl.searchParams.set("meet_link", studentConfig.meet_link);
  if (studentConfig.session_id) {
    wsUrl.searchParams.set("session_id", studentConfig.session_id);
  }

  socket = new WebSocket(wsUrl.toString());

  socket.onopen = () => {
    updateOverlay(null, "Connected");
  };

  socket.onclose = () => {
    updateOverlay(null, "Disconnected");
    reconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = () => {
    updateOverlay(null, "Error");
  };
}

function sendTelemetry(payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function loadSessionConfig() {
  isInitializingConfig = true;
  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const stored = result[STORAGE_KEY] || {};
    studentConfig = {
      student_id: stored.student_id || crypto.randomUUID(),
      name: stored.name || "Student",
      subject: stored.subject || "General",
      meet_link: ensureMeetLink(stored.meet_link),
      session_id: stored.session_id || "",
    };

    chrome.storage.local.set({ [STORAGE_KEY]: studentConfig });
    updateOverlay(null, socket?.readyState === WebSocket.OPEN ? "Connected" : "Disconnected");
    connectWebSocket();
    isInitializingConfig = false;
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORAGE_KEY] || isInitializingConfig) {
    return;
  }

  const next = changes[STORAGE_KEY].newValue || {};
  studentConfig = {
    student_id: next.student_id || studentConfig.student_id,
    name: next.name || studentConfig.name,
    subject: next.subject || studentConfig.subject,
    meet_link: ensureMeetLink(next.meet_link || studentConfig.meet_link),
    session_id: next.session_id || studentConfig.session_id,
  };

  connectWebSocket();
  updateOverlay(null, "Connected");
});

loadSessionConfig();

// ================= EVENTS =================

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sendEvent("TAB_SWITCH");
  } else {
    sendEvent("TAB_RETURN");
  }
});

function sendEvent(type, details = {}) {
  fetch(`${API_BASE}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...details, timestamp: Date.now() }),
  }).catch(() => {});
}

// ================= ACTIVITY TRACKING =================

let lastActive = Date.now();

document.addEventListener("mousemove", () => {
  lastActive = Date.now();
});
document.addEventListener("keydown", () => {
  lastActive = Date.now();
});
document.addEventListener("click", () => {
  lastActive = Date.now();
});
document.addEventListener("scroll", () => {
  lastActive = Date.now();
});

setInterval(() => {
  if (Date.now() - lastActive > IDLE_THRESHOLD) {
    sendEvent("IDLE");
  }
}, IDLE_CHECK_INTERVAL);

// ================= VIDEO DETECTION =================

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

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

// ================= FRAME CAPTURE =================

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

setInterval(() => {
  if (requestInFlight) {
    return;
  }

  video = getVideo();

  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    return;
  }

  const scale = Math.min(1, MAX_CANVAS_WIDTH / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    ctx.getImageData(0, 0, 1, 1).data;
  } catch (error) {
    return;
  }

  requestInFlight = true;

  canvas.toBlob(
    (blob) => {
      if (!blob || blob.size < 100) {
        requestInFlight = false;
        return;
      }

      fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: blob,
      })
        .then((response) => response.json())
        .then((data) => {
          const telemetry = computeTelemetryScore(data);
          sendTelemetry(telemetry);
          updateOverlay(telemetry, socket?.readyState === WebSocket.OPEN ? "Connected" : "Disconnected");

          if (data.ask_question) {
            fetchQuestion(data.difficulty);
          }

          requestInFlight = false;
        })
        .catch(() => {
          requestInFlight = false;
        });
    },
    "image/jpeg",
    0.8
  );
}, CAPTURE_INTERVAL);

// ================= QUESTION SYSTEM =================

function fetchQuestion(difficulty) {
  const topic = "General Science & Math";
  fetch(`${API_BASE}/generate-question?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}`)
    .then((response) => response.json())
    .then((questionData) => {
      if (questionData && questionData.question) {
        showQuestionPopup(questionData);
      }
    })
    .catch(() => {});
}

function showQuestionPopup(data) {
  const existing = document.getElementById("ai-attention-popup");
  if (existing) {
    existing.remove();
  }

  const popup = document.createElement("div");
  popup.id = "ai-attention-popup";
  popup.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    padding: 20px;
    z-index: 999999;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    animation: ai-slide-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    color: #1a1a1a;
  `;

  if (!document.getElementById("ai-popup-styles")) {
    const style = document.createElement("style");
    style.id = "ai-popup-styles";
    style.innerHTML = `
      @keyframes ai-slide-in {
        from { transform: translateY(100px) scale(0.8); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }
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
        transform: translateX(5px);
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

  const title = document.createElement("div");
  title.innerHTML = `<span style="color: #007bff; font-weight: bold; margin-bottom: 8px; display: block;">Quick Check!</span>`;

  const question = document.createElement("div");
  question.style.cssText = "font-weight: 600; margin-bottom: 15px; line-height: 1.4; font-size: 15px;";
  question.innerText = data.question;

  popup.appendChild(title);
  popup.appendChild(question);

  const optionsContainer = document.createElement("div");
  data.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "ai-option-btn";
    button.innerText = option;
    button.onclick = () => handleAnswer(option, data.answer, button, popup);
    optionsContainer.appendChild(button);
  });

  popup.appendChild(optionsContainer);
  document.body.appendChild(popup);
}

function handleAnswer(selected, correct, btn, popup) {
  const isCorrect = selected === correct;
  const buttons = popup.querySelectorAll(".ai-option-btn");
  buttons.forEach((button) => {
    button.disabled = true;
  });

  if (isCorrect) {
    btn.classList.add("correct");
    btn.innerText = `✓ ${selected}`;
  } else {
    btn.classList.add("wrong");
    btn.innerText = `✕ ${selected}`;
    buttons.forEach((button) => {
      if (button.innerText === correct) {
        button.classList.add("correct");
      }
    });
  }

  fetch(`${API_BASE}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selected, correct, timestamp: Date.now() }),
  })
    .then((response) => response.json())
    .then(() => {
      setTimeout(() => {
        popup.style.transition = "all 0.5s ease";
        popup.style.opacity = "0";
        popup.style.transform = "translateY(50px)";
        setTimeout(() => popup.remove(), 500);
      }, 3000);
    })
    .catch(() => {});
}