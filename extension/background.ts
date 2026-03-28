// ==========================================================================
// AutoScout - Background Service Worker (Manifest V3)
// ==========================================================================

const DEFAULT_BACKEND_URL = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

async function getBackendUrl(): Promise<string> {
  try {
    const result = await chrome.storage.local.get('backendUrl');
    return result.backendUrl || DEFAULT_BACKEND_URL;
  } catch {
    return DEFAULT_BACKEND_URL;
  }
}

// ---------------------------------------------------------------------------
// Backend communication
// ---------------------------------------------------------------------------

interface AnalyzeRequest {
  title: string;
  price: number | null;
  vin?: string | null;
}

interface AnalyzeResponse {
  rating: string;
  riskScore: number;
}

async function analyzeListing(data: AnalyzeRequest): Promise<AnalyzeResponse> {
  const backendUrl = await getBackendUrl();
  try {
    const resp = await fetch(`${backendUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (resp.ok) {
      return await resp.json();
    }
  } catch {
    // Server not running or unreachable
  }
  return { rating: 'UNKNOWN', riskScore: -1 };
}

interface SaveListingRequest {
  title: string;
  price: number | null;
  url: string;
  vin: string | null;
  site: string;
}

interface SaveListingResponse {
  success: boolean;
  id?: string;
  error?: string;
}

async function saveListing(data: SaveListingRequest): Promise<SaveListingResponse> {
  const backendUrl = await getBackendUrl();
  try {
    const resp = await fetch(`${backendUrl}/api/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (resp.ok) {
      const body = await resp.json();
      return { success: true, id: body.id };
    }
    const errorBody = await resp.text();
    return { success: false, error: errorBody };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

interface HealthResponse {
  status: string;
  database: boolean;
  activeListings: number;
  activeDealers: number;
  uptime: number;
}

async function checkHealth(): Promise<HealthResponse | null> {
  const backendUrl = await getBackendUrl();
  try {
    const resp = await fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (resp.ok) {
      return await resp.json();
    }
  } catch {
    // Server not running
  }
  return null;
}

interface StatsResponse {
  activeListings: number;
  activeDealers: number;
  unresolvedIssues: number;
  ratingBreakdown: Record<string, number>;
}

async function fetchStats(): Promise<StatsResponse | null> {
  const backendUrl = await getBackendUrl();
  try {
    const resp = await fetch(`${backendUrl}/api/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (resp.ok) {
      return await resp.json();
    }
  } catch {
    // Server not running
  }
  return null;
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: { type: string; data?: any },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    if (message.type === 'ANALYZE_LISTING') {
      analyzeListing(message.data).then(sendResponse);
      return true; // keep the message channel open for async response
    }

    if (message.type === 'SAVE_LISTING') {
      saveListing(message.data).then(sendResponse);
      return true;
    }

    if (message.type === 'CHECK_HEALTH') {
      checkHealth().then(sendResponse);
      return true;
    }

    if (message.type === 'FETCH_STATS') {
      fetchStats().then(sendResponse);
      return true;
    }

    if (message.type === 'GET_BACKEND_URL') {
      getBackendUrl().then((url) => sendResponse({ url }));
      return true;
    }

    if (message.type === 'SET_BACKEND_URL') {
      const url = message.data?.url || DEFAULT_BACKEND_URL;
      chrome.storage.local.set({ backendUrl: url }).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }

    // Trigger a content script scan on the active tab
    if (message.type === 'SCAN_PAGE') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_SCAN' }, (response) => {
            sendResponse(response || { scanned: false });
          });
        } else {
          sendResponse({ scanned: false });
        }
      });
      return true;
    }

    return false;
  },
);

// ---------------------------------------------------------------------------
// Extension install / update
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
});
