# AutoScout - Local PC Deployment Guide (24/7 Operation)

Run AutoScout on a Windows PC that stays on all the time.

---

## Step 1: Install Node.js

1. Go to https://nodejs.org/
2. Download the **LTS version** (20.x or newer)
3. Run the installer — accept all defaults
4. **Check the box** that says "Automatically install necessary tools" if it appears
5. Verify installation — open a new terminal (PowerShell or Command Prompt):
   ```
   node --version
   npm --version
   ```
   Both should print version numbers.

## Step 2: Install Git (if you don't have it)

1. Go to https://git-scm.com/download/win
2. Download and run the installer — accept all defaults
3. Verify:
   ```
   git --version
   ```

## Step 3: Clone the Repository

Open a terminal and run:
```bash
cd C:\Users\Hamza
git clone https://github.com/HamzaW06/AutoScout.git
cd AutoScout
```

This creates `C:\Users\Hamza\AutoScout` with all the code.

## Step 4: Install Dependencies

```bash
npm install
```

This downloads all required packages. Takes 1-2 minutes.

## Step 5: Create Your Environment File

Create a file called `.env` in the AutoScout folder (`C:\Users\Hamza\AutoScout\.env`):

```
PORT=3000
NODE_ENV=production
```

### Optional API Keys (add these as you get them):

```
# For VIN history reports (~$0.25/report)
# Sign up at https://www.vinaudit.com/api
VINAUDIT_API_KEY=your_key_here

# For Discord alerts when great deals are found
# Create a webhook in your Discord server: Server Settings → Integrations → Webhooks
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_here

# For market value comparisons (optional, has free tier)
# Sign up at https://www.marketcheck.com/apis
MARKETCHECK_API_KEY=your_key_here
```

You can start without any API keys — the core scraping and dashboard work without them.

## Step 6: Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript. Should complete in under a minute.

## Step 7: Test It Works

```bash
npm start
```

You should see output like:
```
Server running on port 3000
WebSocket server initialized
Scheduler started
```

Open your browser and go to: **http://localhost:3000**

You should see the AutoScout dashboard. Press Ctrl+C to stop for now.

## Step 8: Install PM2 (Keeps It Running 24/7)

PM2 is a process manager that:
- Restarts AutoScout if it crashes
- Starts it automatically when your PC boots
- Manages logs

```bash
npm install -g pm2
npm install -g pm2-windows-startup
```

## Step 9: Start AutoScout with PM2

```bash
cd C:\Users\Hamza\AutoScout
pm2 start dist/index.js --name autoscout
```

Verify it's running:
```bash
pm2 status
```

You should see:
```
┌─────────┬────┬─────────┬──────┬───────┬──────────┐
│ Name    │ id │ mode    │ ↺    │ status│ cpu      │
├─────────┼────┼─────────┼──────┼───────┼──────────┤
│autoscout│ 0  │ fork    │ 0    │ online│ 0%       │
└─────────┴────┴─────────┴──────┴───────┴──────────┘
```

## Step 10: Auto-Start on Boot

```bash
pm2 save
pm2-startup install
```

This ensures AutoScout starts automatically when Windows boots.

## Step 11: Prevent PC from Sleeping

AutoScout can't scrape if your PC is asleep!

1. Open **Settings** → **System** → **Power & sleep**
2. Set **Sleep** to **Never** (for both "On battery" and "When plugged in")
3. Set **Screen** to turn off whenever you want (screen off doesn't affect AutoScout)

Alternatively, in PowerShell (as admin):
```powershell
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
```

## Step 12: Windows Firewall (Access from Other Devices)

If you want to access the dashboard from your phone or another computer on your network:

1. Open **Windows Defender Firewall** → **Advanced Settings**
2. Click **Inbound Rules** → **New Rule**
3. **Port** → TCP → Specific port: **3000**
4. **Allow the connection**
5. Check all profiles (Domain, Private, Public)
6. Name it: **AutoScout**

Then access from other devices at: `http://YOUR_PC_IP:3000`

Find your PC's IP:
```
ipconfig
```
Look for "IPv4 Address" under your Wi-Fi or Ethernet adapter (usually 192.168.x.x).

---

## Daily Usage

### View the Dashboard
Open http://localhost:3000 in your browser.

### Add Dealers
1. Go to the dashboard → **Dealer Onboarding** page
2. Add dealer URLs one by one or bulk import
3. AutoScout automatically detects the platform and starts scraping

### Check Scraper Health
Dashboard → **Scraper Health** page shows:
- Which dealers are healthy/degraded/failing
- Success rates and last scrape times
- Re-test buttons for problem dealers

### Get VIN History
On any listing detail page, click **"Fetch VIN History"** to get a full report.
Requires VINAUDIT_API_KEY in your .env file.

### Export Data
Dashboard → **Export** page to download listings as CSV or JSON.

---

## Useful PM2 Commands

```bash
# Check status
pm2 status

# View live logs
pm2 logs autoscout

# Restart
pm2 restart autoscout

# Stop
pm2 stop autoscout

# Monitor CPU/memory
pm2 monit
```

## Updating AutoScout

When there's new code:
```bash
cd C:\Users\Hamza\AutoScout
git pull
npm install
npm run build
pm2 restart autoscout
```

## Troubleshooting

### "Port 3000 already in use"
Something else is using port 3000. Either:
- Close the other app, or
- Change PORT in .env to 3001 and rebuild

### Dashboard won't load
```bash
pm2 logs autoscout --lines 50
```
Check the recent logs for errors.

### Scrapers aren't running
Check the scheduler is active in the logs. Scrapers run on schedules:
- High priority dealers: every 4 hours
- Medium priority: twice daily (6 AM, 6 PM)
- Low priority: once daily (3 AM)

### PM2 not starting on boot
Re-run:
```bash
pm2 save
pm2-startup install
```
Make sure you run the command it outputs.

### Out of memory
If you have many dealers and the 1 scrape uses too much memory:
```bash
pm2 start dist/index.js --name autoscout --max-memory-restart 500M
```
This auto-restarts if memory exceeds 500MB.
