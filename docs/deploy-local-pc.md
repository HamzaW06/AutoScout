# Local PC 24/7 Runbook (AutoScout)

Use this if Oracle is unstable or you want quick, reliable operation.

## 1) Install prerequisites
- Node.js 20+
- Git

Verify:

```powershell
node --version
npm --version
git --version
```

## 2) Install project deps

```powershell
cd C:\Users\Hamza\OneDrive\CarAgg
npm install
cd web
npm install
cd ..
```

## 3) Configure env
Create `.env` in project root with at least:

```dotenv
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

REQUEST_DELAY_MS=2000
MAX_CONCURRENT_SCRAPERS=3

GOOGLE_AI_API_KEY=REPLACE_ME
MARKETCHECK_API_KEY=REPLACE_ME
GOOGLE_PLACES_API_KEY=REPLACE_ME
VINAUDIT_API_KEY=
DISCORD_WEBHOOK_URL=
```

No quotes around key values.

## 4) Build and run

```powershell
npm run build
npm start
```

Open:
- http://localhost:3000
- http://localhost:3000/api/health

## 5) Keep running with PM2

```powershell
npm install -g pm2
pm2 start dist/index.js --name autoscout
pm2 save
```

## 6) Make it survive reboot (Windows)

```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

## 7) Power settings
Set PC sleep to Never.
Screen off is fine; sleep must stay off.

## 8) Access from phone on same LAN
- Allow inbound TCP 3000 in Windows Firewall
- Find your IPv4 with `ipconfig`
- Open `http://<YOUR_PC_IP>:3000`

## 9) Update flow

```powershell
cd C:\Users\Hamza\OneDrive\CarAgg
git pull
npm install
cd web
npm install
cd ..
npm run build
pm2 restart autoscout
```

## 10) Troubleshooting
- Build errors about React modules: run `npm install` inside `web`.
- "Cannot GET /": ensure latest code and build succeeded.
- UI loads but no data: check `.env` keys and backend logs.
- Scraping does nothing: verify dealers were added with valid website/inventory URL.
