const backendStatus = document.getElementById("backend-status");
const tabStatus = document.getElementById("tab-status");
const studentConfig = document.getElementById("student-config");
const saveConfigButton = document.getElementById("save-config");
const studentNameInput = document.getElementById("student-name");
const subjectInput = document.getElementById("subject");
const meetLinkInput = document.getElementById("meet-link");

const STORAGE_KEY = "ai_monitor_student_profile";

function ensureStudentId(existing) {
  if (existing?.student_id) {
    return existing.student_id;
  }

  return crypto.randomUUID();
}

function renderStudentConfig(profile) {
  if (!profile) {
    studentConfig.textContent = "Not saved";
    studentConfig.className = "value warn";
    return;
  }

  studentConfig.textContent = `${profile.name || "Student"} • ${profile.subject || "General"}`;
  studentConfig.className = "value ok";
}

async function updateBackendStatus() {
  try {
    const response = await fetch("http://localhost:8000/docs", { method: "GET" });
    if (response.ok) {
      backendStatus.textContent = "Connected on localhost:8000";
      backendStatus.className = "value ok";
      return;
    }
  } catch (error) {
    // Fall through to warning state.
  }

  backendStatus.textContent = "Server not reachable";
  backendStatus.className = "value warn";
}

async function updateTabStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    tabStatus.textContent = "No active tab detected";
    tabStatus.className = "value warn";
    return;
  }

  if (tab.url.startsWith("https://meet.google.com/")) {
    tabStatus.textContent = "Google Meet detected";
    tabStatus.className = "value ok";
    return;
  }

  tabStatus.textContent = "Open a Google Meet tab";
  tabStatus.className = "value warn";

  if (!meetLinkInput.value && tab?.url?.startsWith("https://meet.google.com/")) {
    meetLinkInput.value = tab.url;
  }
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const profile = stored[STORAGE_KEY];

  if (profile) {
    studentNameInput.value = profile.name || "";
    subjectInput.value = profile.subject || "";
    meetLinkInput.value = profile.meet_link || "";
    renderStudentConfig(profile);
  } else {
    renderStudentConfig(null);
  }
}

async function saveConfig() {
  const current = (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] || {};
  const profile = {
    student_id: ensureStudentId(current),
    name: studentNameInput.value.trim() || "Student",
    subject: subjectInput.value.trim() || "General",
    meet_link: meetLinkInput.value.trim(),
    session_id: current.session_id || "",
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: profile });
  renderStudentConfig(profile);
}

saveConfigButton.addEventListener("click", () => {
  saveConfig().catch(() => {
    studentConfig.textContent = "Failed to save";
    studentConfig.className = "value warn";
  });
});

updateBackendStatus();
updateTabStatus();
loadConfig();
