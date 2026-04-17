const backendStatus = document.getElementById("backend-status");
const tabStatus = document.getElementById("tab-status");
const studentConfig = document.getElementById("student-config");
const saveConfigButton = document.getElementById("save-config");
const studentIdInput = document.getElementById("student-id");
const studentNameInput = document.getElementById("student-name");
const subjectInput = document.getElementById("subject");
const batchInput = document.getElementById("batch");
const meetLinkInput = document.getElementById("meet-link");

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

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    if (!chrome?.tabs?.query) {
      reject(new Error("Tab API unavailable"));
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

function slugify(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferSessionId(meetLink, currentSessionId) {
  try {
    const url = new URL(meetLink);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || currentSessionId || "demo_session";
  } catch {
    return currentSessionId || "demo_session";
  }
}

function ensureStudentId(existing) {
  if (studentIdInput.value.trim()) {
    return studentIdInput.value.trim();
  }
  if (existing?.student_id) {
    return existing.student_id;
  }
  return `student-${slugify(studentNameInput.value) || "demo-user"}`;
}

function renderStudentConfig(profile, message, isError = false) {
  if (message) {
    studentConfig.textContent = message;
    studentConfig.className = isError ? "value warn" : "value ok";
    return;
  }

  if (!profile) {
    studentConfig.textContent = "Not saved";
    studentConfig.className = "value warn";
    return;
  }

  studentConfig.textContent = `${profile.student_id} | ${profile.name || "Student"} | ${profile.subject || "General"} | ${profile.batch || "General"}`;
  studentConfig.className = "value ok";
}

async function updateBackendStatus() {
  try {
    const response = await fetch("http://localhost:8000/health", { method: "GET" });
    if (response.ok) {
      const data = await response.json();
      backendStatus.textContent = `Connected on localhost:8000 (${data.mongo})`;
      backendStatus.className = "value ok";
      return;
    }
  } catch {
    // ignore
  }

  backendStatus.textContent = "Server not reachable";
  backendStatus.className = "value warn";
}

async function updateTabStatus() {
  try {
    const tab = await queryActiveTab();

    if (!tab || !tab.url) {
      tabStatus.textContent = "No active tab detected";
      tabStatus.className = "value warn";
      return;
    }

    if (tab.url.startsWith("https://meet.google.com/")) {
      tabStatus.textContent = "Google Meet detected";
      tabStatus.className = "value ok";
      if (!meetLinkInput.value) {
        meetLinkInput.value = tab.url;
      }
      return;
    }

    tabStatus.textContent = "Open a Google Meet tab";
    tabStatus.className = "value warn";
  } catch (error) {
    tabStatus.textContent = "Tab read failed";
    tabStatus.className = "value warn";
    console.error("[Popup] Failed to query tab", error);
  }
}

async function loadConfig() {
  try {
    const response = await sendRuntimeMessage({ type: "GET_CONFIG" });
    const profile = response.profile;

    if (profile) {
      studentIdInput.value = profile.student_id || "";
      studentNameInput.value = profile.name || "";
      subjectInput.value = profile.subject || "";
      batchInput.value = profile.batch || "";
      meetLinkInput.value = profile.meet_link || "";
      renderStudentConfig(profile);
    } else {
      renderStudentConfig(null);
    }
  } catch (error) {
    renderStudentConfig(null, `Load failed: ${error.message}`, true);
    console.error("[Popup] Failed to load config", error);
  }
}

async function saveConfig() {
  const currentResponse = await sendRuntimeMessage({ type: "GET_CONFIG" });
  const current = currentResponse.profile || {};
  const tab = await queryActiveTab();
  const activeMeetLink = tab?.url?.startsWith("https://meet.google.com/") ? tab.url : "";
  const meetLink = meetLinkInput.value.trim() || activeMeetLink;

  const profile = {
    student_id: ensureStudentId(current),
    session_id: inferSessionId(meetLink, current.session_id),
    name: studentNameInput.value.trim() || "Student",
    subject: subjectInput.value.trim() || "General",
    batch: batchInput.value.trim() || "General",
    meet_link: meetLink,
  };

  if (!profile.meet_link) {
    renderStudentConfig(null, "Open Google Meet first", true);
    return;
  }

  await sendRuntimeMessage({ type: "SAVE_CONFIG", profile });
  studentIdInput.value = profile.student_id;
  meetLinkInput.value = profile.meet_link;
  renderStudentConfig(profile, "Saved successfully");
}

saveConfigButton.addEventListener("click", async () => {
  try {
    await saveConfig();
  } catch (error) {
    renderStudentConfig(null, `Save failed: ${error.message}`, true);
    console.error("[Popup] Failed to save config", error);
  }
});

updateBackendStatus();
updateTabStatus();
loadConfig();
