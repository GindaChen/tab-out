/**
 * background.js — Service Worker for Badge Updates
 *
 * Chrome's "always-on" background script for Tab Out.
 * Its only job: keep the toolbar badge showing the current open tab count.
 *
 * Since we no longer have a server, we query chrome.tabs directly.
 * The badge counts real web tabs (skipping chrome:// and extension pages).
 *
 * Color coding gives a quick at-a-glance health signal:
 *   Green  (#3d7a4a) → 1–10 tabs  (focused, manageable)
 *   Amber  (#b8892e) → 11–20 tabs (getting busy)
 *   Red    (#b35a5a) → 21+ tabs   (time to cull!)
 */

// ─── Badge updater ────────────────────────────────────────────────────────────

/**
 * updateBadge()
 *
 * Counts open real-web tabs and updates the extension's toolbar badge.
 * "Real" tabs = not chrome://, not extension pages, not about:blank.
 */
async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});

    // Only count actual web pages — skip browser internals and extension pages
    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    // Don't show "0" — an empty badge is cleaner
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    // Pick badge color based on workload level
    let color;
    if (count <= 10) {
      color = '#3d7a4a'; // Green — you're in control
    } else if (count <= 20) {
      color = '#b8892e'; // Amber — things are piling up
    } else {
      color = '#b35a5a'; // Red — time to focus and close some tabs
    }

    await chrome.action.setBadgeBackgroundColor({ color });

  } catch {
    // If something goes wrong, clear the badge rather than show stale data
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

// Update badge when the extension is first installed
chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
});

// Update badge when Chrome starts up
chrome.runtime.onStartup.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is opened
chrome.tabs.onCreated.addListener(() => {
  updateBadge();
});

// Update badge whenever a tab is closed
chrome.tabs.onRemoved.addListener(() => {
  updateBadge();
});

// Update badge when a tab's URL changes (e.g. navigating to/from chrome://)
chrome.tabs.onUpdated.addListener(() => {
  updateBadge();
});

// ─── Initial run ─────────────────────────────────────────────────────────────

// Run once immediately when the service worker first loads
updateBadge();


// ─── Keyboard shortcut: open or focus Tab Out ─────────────────────────────────

/**
 * openOrFocusTabOut()
 *
 * Implements the "open-tab-out" command triggered by the keyboard shortcut.
 *
 * Logic:
 *   1. Look for any already-open Tab Out tab (chrome-extension://.../index.html).
 *   2. If one exists → activate it and bring its window to the front.
 *   3. If none exists → open a new Tab Out tab in the current window.
 *
 * This mirrors how browsers handle "switch to existing tab" for homepage tabs.
 */
async function openOrFocusTabOut() {
  try {
    const extensionId  = chrome.runtime.id;
    const tabOutUrl    = `chrome-extension://${extensionId}/index.html`;

    // Find all open Tab Out tabs across all windows
    const allTabs      = await chrome.tabs.query({});
    const tabOutTabs   = allTabs.filter(t => t.url === tabOutUrl || t.url === 'chrome://newtab/');

    if (tabOutTabs.length > 0) {
      // Prefer a tab in the currently focused window
      const currentWindow = await chrome.windows.getCurrent();
      const match =
        tabOutTabs.find(t => t.windowId === currentWindow.id) ||
        tabOutTabs[0];

      await chrome.tabs.update(match.id, { active: true });
      await chrome.windows.update(match.windowId, { focused: true });
    } else {
      // No Tab Out tab open — open a fresh one
      await chrome.tabs.create({ url: tabOutUrl });
    }
  } catch (err) {
    console.error('[tab-out] Failed to open/focus Tab Out:', err);
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-tab-out') {
    openOrFocusTabOut();
  }
});

// Clicking the toolbar icon also opens/focuses Tab Out (same logic)
chrome.action.onClicked.addListener(() => {
  openOrFocusTabOut();
});
