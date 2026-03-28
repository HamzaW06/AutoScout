# AutoScout Chrome Extension

Chrome extension (Manifest V3) that overlays car deal ratings on marketplace listing pages.

## Supported Sites

- Craigslist (`*.craigslist.org`)
- Facebook Marketplace (`facebook.com/marketplace`)
- Cars.com (`cars.com/shopping`)
- Autotrader (`autotrader.com/cars-for-sale`)
- CarGurus (`cargurus.com/Cars`)

## Building

The extension is written in TypeScript and must be compiled to JavaScript before loading.

### 1. Install dependencies

```bash
cd extension
npm init -y
npm install --save-dev typescript @anthropic-ai/chrome-types
```

If `@anthropic-ai/chrome-types` is unavailable, install the community Chrome types:

```bash
npm install --save-dev typescript @anthropic-ai/chrome-extension-types
```

Or simply remove the `"types": ["chrome"]` line from `tsconfig.json` and the
Chrome APIs (`chrome.runtime`, `chrome.storage`, etc.) will still work at
runtime -- you just lose editor autocompletion.

### 2. Compile TypeScript

```bash
npx tsc
```

This produces `background.js`, `content.js`, and `popup.js` alongside the `.ts` sources.

### 3. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` directory

### Quick build (from project root)

```bash
cd extension && npx tsc
```

## How It Works

1. **Content script** (`content.ts`) runs on supported car listing pages
   - Detects listing elements using site-specific CSS selectors
   - Extracts title, price, URL, and VIN from each listing
   - Sends data to the background script for scoring
   - Overlays a color-coded deal badge (STEAL / GREAT / GOOD / FAIR / HIGH / RIP-OFF)
   - Adds a "Save to AutoScout" button on each listing
   - Uses MutationObserver to handle infinite scroll / dynamic content

2. **Background service worker** (`background.ts`) communicates with the AutoScout backend
   - Forwards listing analysis requests to `POST /api/analyze`
   - Saves listings via `POST /api/listings`
   - Checks backend health via `GET /api/health`
   - Fetches stats via `GET /api/stats`

3. **Popup** (`popup.html` + `popup.ts`) provides quick access
   - Shows backend connection status
   - Displays listing count and STEAL count
   - "Scan This Page" triggers a content script scan
   - "Open Dashboard" opens the web UI (localhost:5173)
   - Configurable backend URL

## Requirements

- AutoScout backend running at `http://localhost:3000` (configurable in popup)
- Chrome 102+ (Manifest V3 support)

## Icons

Place PNG icons in the `icons/` directory:
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

To generate placeholder gold-circle icons, run:

```bash
node extension/generate-icons.js
```
