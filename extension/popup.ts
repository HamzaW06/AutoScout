// ==========================================================================
// AutoScout - Popup Script
// ==========================================================================

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const statusDot = document.getElementById('statusDot') as HTMLElement;
const statusText = document.getElementById('statusText') as HTMLElement;
const listingCount = document.getElementById('listingCount') as HTMLElement;
const stealCount = document.getElementById('stealCount') as HTMLElement;
const scanBtn = document.getElementById('scanBtn') as HTMLButtonElement;
const scanResult = document.getElementById('scanResult') as HTMLElement;
const dashboardBtn = document.getElementById('dashboardBtn') as HTMLButtonElement;
const backendUrlInput = document.getElementById('backendUrlInput') as HTMLInputElement;
const saveUrlBtn = document.getElementById('saveUrlBtn') as HTMLButtonElement;

// ---------------------------------------------------------------------------
// Check backend health
// ---------------------------------------------------------------------------

function checkHealth(): void {
  statusDot.className = 'status-dot checking';
  statusText.textContent = 'Checking connection...';

  chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' }, (response) => {
    if (response && response.status) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = `Connected (${response.status})`;
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Backend not reachable';
    }
  });
}

// ---------------------------------------------------------------------------
// Fetch stats
// ---------------------------------------------------------------------------

function fetchStats(): void {
  chrome.runtime.sendMessage({ type: 'FETCH_STATS' }, (response) => {
    if (response) {
      listingCount.textContent = String(response.activeListings ?? 0);
      const steals = response.ratingBreakdown?.STEAL ?? 0;
      stealCount.textContent = String(steals);
    } else {
      listingCount.textContent = '--';
      stealCount.textContent = '--';
    }
  });
}

// ---------------------------------------------------------------------------
// Load saved backend URL
// ---------------------------------------------------------------------------

function loadBackendUrl(): void {
  chrome.runtime.sendMessage({ type: 'GET_BACKEND_URL' }, (response) => {
    if (response?.url) {
      backendUrlInput.value = response.url;
    }
  });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

// Scan This Page
scanBtn.addEventListener('click', () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';
  scanResult.textContent = '';

  chrome.runtime.sendMessage({ type: 'SCAN_PAGE' }, (response) => {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan This Page';

    if (response?.scanned) {
      scanResult.textContent = `Found ${response.count} listing(s) on this page.`;
    } else {
      scanResult.textContent = 'No supported car marketplace detected on this tab.';
    }
  });
});

// Open Dashboard
dashboardBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_BACKEND_URL' }, (response) => {
    // Dashboard runs on vite dev server (port 5173) or same host
    const backendUrl = response?.url || 'http://localhost:3000';
    // Derive the dashboard URL: replace port 3000 with 5173
    let dashboardUrl: string;
    try {
      const parsed = new URL(backendUrl);
      parsed.port = '5173';
      dashboardUrl = parsed.toString();
    } catch {
      dashboardUrl = 'http://localhost:5173';
    }
    chrome.tabs.create({ url: dashboardUrl });
  });
});

// Save backend URL
saveUrlBtn.addEventListener('click', () => {
  const url = backendUrlInput.value.trim();
  if (!url) return;

  chrome.runtime.sendMessage(
    { type: 'SET_BACKEND_URL', data: { url } },
    (response) => {
      if (response?.success) {
        saveUrlBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveUrlBtn.textContent = 'Save';
        }, 1500);
        // Re-check health with new URL
        checkHealth();
        fetchStats();
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Initialise on popup open
// ---------------------------------------------------------------------------

loadBackendUrl();
checkHealth();
fetchStats();
