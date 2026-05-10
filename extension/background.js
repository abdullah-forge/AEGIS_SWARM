chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scanAegis",
    title: "Scan with AEGIS-SWARM",
    contexts: ["selection", "link"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "scanAegis") {
    const payload = info.selectionText || info.linkUrl;
    
    fetch('https://wall06-aegis-swarm-api.hf.space/analyze/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload })
    })
    .then(res => res.json())
    .then(data => {
      const message = `[AEGIS-SWARM THREAT ANALYSIS]\n\nVERDICT: ${data.verdict}\nCONFIDENCE: ${data.confidence}%`;
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: (msg) => alert(msg),
        args: [message]
      });
    })
    .catch(err => {
      console.error("AEGIS API Error:", err);
      chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => alert("AEGIS-SWARM ERROR: Backend API Offline or Unreachable."),
      });
    });
  }
});
