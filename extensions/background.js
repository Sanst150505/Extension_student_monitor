/**
 * background.js - Manifest V3 service worker
 */

const STORAGE_KEY = "ai_monitor_student_profile";
let profileCache = null;

if (chrome?.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log("[AI Monitor] Extension installed/updated:", details.reason);
  });
}

if (chrome?.alarms?.create && chrome?.alarms?.onAlarm) {
  chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
      // no-op
    }
  });
}

function readProfile() {
  return new Promise((resolve, reject) => {
    if (!chrome?.storage?.local) {
      resolve(profileCache);
      return;
    }

    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      profileCache = result[STORAGE_KEY] || profileCache || null;
      resolve(profileCache);
    });
  });
}

function writeProfile(profile) {
  return new Promise((resolve, reject) => {
    profileCache = profile;

    if (!chrome?.storage?.local) {
      resolve();
      return;
    }

    chrome.storage.local.set({ [STORAGE_KEY]: profile }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "STATUS") {
      console.log("[AI Monitor] Status from content:", message.data);
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "GET_CONFIG") {
      readProfile()
        .then((profile) => sendResponse({ ok: true, profile }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    if (message?.type === "SAVE_CONFIG") {
      writeProfile(message.profile)
        .then(() => {
          if (chrome?.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: "CONFIG_UPDATED", profile: message.profile });
          }
          sendResponse({ ok: true });
        })
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    return false;
  });
}
