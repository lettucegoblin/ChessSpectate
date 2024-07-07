function injectScript(file, node) {
  const script = document.createElement('script');
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', chrome.runtime.getURL(file));
  script.onload = function() {
      this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}
console.log('Content script loaded');
let _lastFen = '';
let _lastTabId = '';

document.addEventListener('fenFromPage', function (e) {
  _lastFen = e.detail.fen;
  if(!_lastTabId) return;

  chrome.runtime.sendMessage({
    message: 'sendFen',
    payload: {
      tabId: _lastTabId,
      fen: _lastFen,
    },
  });
});

document.addEventListener('markingsFromPage', function (e) {
  console.log('Markings from page:', e.detail.markings);
  if(!_lastTabId) return;

  chrome.runtime.sendMessage({
    message: 'sendMarkings',
    payload: {
      tabId: _lastTabId,
      markings: e.detail.markings,
    },
  });
});

// Get the tab ID and FEN from the chess.com board
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === 'getFen') {
    _lastTabId = request.tabId;

    chrome.runtime.sendMessage({
      message: 'sendFen',
      payload: {
        tabId: _lastTabId,
        fen: _lastFen,
      },
    });

    sendResponse({ status: 'FEN sent' });
  }
});


injectScript('injectedScript.js', 'body');