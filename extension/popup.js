// Get the current active tab URL on load
document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      document.getElementById('payload').value = tabs[0].url;
    }
  });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

document.getElementById('scanBtn').addEventListener('click', async () => {
  const text = document.getElementById('payload').value;
  if (!text) return;

  const resultDiv = document.getElementById('result');
  const btn = document.getElementById('scanBtn');
  const statusBadge = document.getElementById('statusBadge');
  
  btn.disabled = true;
  btn.style.opacity = '0.5';
  btn.innerText = 'SCANNING...';
  statusBadge.innerText = 'UPLINK_BUSY';
  statusBadge.style.color = 'var(--neon-pink)';
  statusBadge.style.borderColor = 'var(--neon-pink)';

  resultDiv.innerHTML = `
    <div class="log-line"><span>[1]</span> INITIATING HANDSHAKE...</div>
    <div class="progress-bar"><div class="progress-fill" style="width: 20%"></div></div>
  `;

  await sleep(300);
  resultDiv.innerHTML += `<div class="log-line"><span>[2]</span> EXTRACTING FEATURES...</div>`;
  document.querySelector('.progress-fill').style.width = '50%';
  
  await sleep(300);
  resultDiv.innerHTML += `<div class="log-line"><span>[3]</span> QUERYING AEGIS-SWARM CORE...</div>`;
  document.querySelector('.progress-fill').style.width = '80%';

  try {
    // Easily configurable for Hugging Face Space URL
    const API_URL = 'https://wall06-aegis-swarm-api.hf.space';
    
    const res = await fetch(`${API_URL}/analyze/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    const data = await res.json();
    const isHigh = data.verdict === 'HIGH' || data.verdict === 'HIGH RISK';
    const color = isHigh ? 'var(--neon-pink)' : 'var(--neon-cyan)';
    
    document.querySelector('.progress-fill').style.width = '100%';
    document.querySelector('.progress-fill').style.backgroundColor = color;
    
    await sleep(200);

    resultDiv.innerHTML = `
      <div style="margin-bottom: 5px; font-weight: bold; color: ${color};">> SCAN_COMPLETE</div>
      <div style="border-left: 2px solid ${color}; padding-left: 10px;">
        <div style="margin-bottom: 5px;">VERDICT: <span class="${isHigh ? 'high-risk' : 'safe'}">[ ${data.verdict} ]</span></div>
        <div>CONFIDENCE: <span style="color: ${color};">${data.confidence.toFixed(1)}%</span></div>
      </div>
    `;

    statusBadge.innerText = isHigh ? 'THREAT_FOUND' : 'SECURE';
    statusBadge.style.color = color;
    statusBadge.style.borderColor = color;

  } catch (err) {
    document.querySelector('.progress-fill').style.backgroundColor = 'red';
    resultDiv.innerHTML += `
      <div style="color: red; margin-top: 10px; font-weight: bold;">
        > ERR: UPLINK_FAILED
      </div>
      <div style="color: #aaa; font-size: 9px; margin-top: 5px;">
        Backend API Unreachable.
      </div>
    `;
    statusBadge.innerText = 'OFFLINE';
    statusBadge.style.color = 'red';
    statusBadge.style.borderColor = 'red';
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerText = 'EXECUTE_SCAN //';
  }
});
