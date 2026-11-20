// Zenkai Stream Companion - Background Service Worker
// Handles direct high-speed downloads directly from CDN to disk with proper custom filenames

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.type === 'ZENKAI_DOWNLOAD' && request.url) {
    const cleanFn = (request.filename || 'video.mp4')
      .replace(/[^\w\s\-\.\(\)\[\]]/gi, '')
      .trim() || 'video.mp4';

    chrome.downloads.download(
      {
        url: request.url,
        filename: cleanFn,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ ok: true, downloadId });
        }
      }
    );
    return true; // Keep sendResponse open for async download callback
  }
});
