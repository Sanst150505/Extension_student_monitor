// ================= CONFIG =================

const API_BASE = "http://localhost:8000";
const CAPTURE_INTERVAL = 1500;      // ms between frame captures
const IDLE_THRESHOLD = 10000;       // ms before marking idle
const IDLE_CHECK_INTERVAL = 3000;   // ms between idle checks
const MAX_CANVAS_WIDTH = 640;       // downscale frames to save bandwidth

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
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ type, ...details, timestamp: Date.now() })
    }).catch(() => {});   // fire-and-forget
}

// ================= ACTIVITY TRACKING =================

let lastActive = Date.now();

document.addEventListener("mousemove", () => { lastActive = Date.now(); });
document.addEventListener("keydown",   () => { lastActive = Date.now(); });
document.addEventListener("click",     () => { lastActive = Date.now(); });
document.addEventListener("scroll",    () => { lastActive = Date.now(); });

setInterval(() => {
    if (Date.now() - lastActive > IDLE_THRESHOLD) {
        sendEvent("IDLE");
    }
}, IDLE_CHECK_INTERVAL);

// ================= VIDEO DETECTION =================

let video = null;
let requestInFlight = false;   // backpressure: skip frames while waiting

/**
 * Find the first active video element on the page.
 * Google Meet dynamically injects video elements, so we re-scan each cycle.
 */
function getVideo() {
    const videos = document.querySelectorAll("video");
    for (let v of videos) {
        if (v.videoWidth > 0 && v.videoHeight > 0 && !v.paused) {
            return v;
        }
    }
    return null;
}

// MutationObserver: detect dynamically added video elements (Google Meet)
const observer = new MutationObserver(() => {
    if (!video || video.videoWidth === 0) {
        video = getVideo();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// ================= FRAME CAPTURE =================

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

setInterval(() => {
    // Skip if previous request hasn't returned yet (backpressure)
    if (requestInFlight) return;

    video = getVideo();

    // No active video element
    if (!video) {
        return;
    }

    // Camera is off (video element exists but no actual video)
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
    }

    // Downscale to save bandwidth and processing time
    const scale = Math.min(1, MAX_CANVAS_WIDTH / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Check for black/empty frame (camera might be on but covered)
    try {
        const sample = ctx.getImageData(0, 0, 1, 1).data;
        // All zeros = likely black frame
    } catch(e) {
        // Security: cross-origin video can't be read
        console.log("[AI Monitor] Cannot read video frame (cross-origin)");
        return;
    }

    requestInFlight = true;

    canvas.toBlob(blob => {
        if (!blob || blob.size < 100) {
            requestInFlight = false;
            return;
        }

        fetch(`${API_BASE}/analyze`, {
            method: "POST",
            body: blob
        })
        .then(res => res.json())
        .then(data => {
            console.log("[AI Monitor] Result:", data);
            
            // Check for trigger
            if (data.ask_question) {
                console.log("[AI Monitor] Attention Drop Detected! Triggering question...");
                fetchQuestion(data.difficulty);
            }

            requestInFlight = false;
        })
        .catch(err => {
            console.log("[AI Monitor] Error:", err.message);
            requestInFlight = false;
        });

    }, "image/jpeg", 0.8);   // 0.8 quality = good balance of size vs quality

}, CAPTURE_INTERVAL);


// ================= QUESTION SYSTEM =================

function fetchQuestion(difficulty) {
    const topic = "General Science & Math"; // Hardcoded for now
    fetch(`${API_BASE}/generate-question?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}`)
        .then(res => res.json())
        .then(questionData => {
            if (questionData && questionData.question) {
                showQuestionPopup(questionData);
            }
        })
        .catch(err => console.error("[AI Monitor] Failed to fetch question:", err));
}

function showQuestionPopup(data) {
    // Remove if already exists
    const existing = document.getElementById("ai-attention-popup");
    if (existing) existing.remove();

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

    // Inject CSS Animation
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
    title.innerHTML = `<span style="color: #007bff; font-weight: bold; margin-bottom: 8px; display: block;">🧠 Quick Check!</span>`;
    
    const question = document.createElement("div");
    question.style.cssText = "font-weight: 600; margin-bottom: 15px; line-height: 1.4; font-size: 15px;";
    question.innerText = data.question;

    popup.appendChild(title);
    popup.appendChild(question);

    const optionsContainer = document.createElement("div");
    data.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "ai-option-btn";
        btn.innerText = opt;
        btn.onclick = () => handleAnswer(opt, data.answer, btn, popup);
        optionsContainer.appendChild(btn);
    });

    popup.appendChild(optionsContainer);
    document.body.appendChild(popup);
}

function handleAnswer(selected, correct, btn, popup) {
    const isCorrect = (selected === correct);
    
    // Disable all buttons
    const buttons = popup.querySelectorAll(".ai-option-btn");
    buttons.forEach(b => b.disabled = true);

    // Visual feedback
    if (isCorrect) {
        btn.classList.add("correct");
        btn.innerText = "✅ " + selected;
    } else {
        btn.classList.add("wrong");
        btn.innerText = "❌ " + selected;
        // Show correct answer
        buttons.forEach(b => {
            if (b.innerText === correct) b.classList.add("correct");
        });
    }

    // Send answer to backend
    fetch(`${API_BASE}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            selected: selected,
            correct: correct,
            timestamp: Date.now()
        })
    })
    .then(res => res.json())
    .then(result => {
        console.log("[AI Monitor] Answer Result:", result);
        
        // Remove popup after delay
        setTimeout(() => {
            popup.style.transition = "all 0.5s ease";
            popup.style.opacity = "0";
            popup.style.transform = "translateY(50px)";
            setTimeout(() => popup.remove(), 500);
        }, 3000);
    })
    .catch(err => console.error("[AI Monitor] Answer log failed:", err));
}