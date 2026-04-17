/**
 * background.js — Manifest V3 Service Worker
 *
 * Keeps the extension alive and manages state across content script reloads.
 */

// Extension installed or updated
chrome.runtime.onInstalled.addListener((details) => {
    console.log("[AI Monitor] Extension installed/updated:", details.reason);
});

// Keep-alive: Manifest V3 service workers can go idle after ~30s.
// This alarm fires every 25s to keep it alive during active monitoring.
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
        // No-op — just keeps the service worker alive
    }
});

// Listen for messages from content script (future: relay results to popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "STATUS") {
        console.log("[AI Monitor] Status from content:", message.data);
        sendResponse({ ok: true });
    }
    return true;  // keep channel open for async response
});
