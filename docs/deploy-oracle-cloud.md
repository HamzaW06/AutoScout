# Oracle Cloud Deployment Runbook (AutoScout)

This is the clean, corrected flow for deploying AutoScout on Oracle.

## 0) Important security step first
You exposed API keys in chat logs. Rotate all keys before production use:
- Google AI key
- MarketCheck key
- Google Places key
- Any Discord webhook or VIN API key

## 1) Oracle instance requirements
Use:
- Ubuntu 24.04 (or 22.04)
- Public subnet
- Public IPv4 assigned (ephemeral is fine)
- SSH key pair (you must keep the private key)

Check in instance details:
- Public IP is present (not '-')

## 2) Open network ports in Oracle Security List
VCN -> Subnet -> Security List -> Ingress rules:
- TCP 22 from 0.0.0.0/0 (SSH)
- TCP 3000 from 0.0.0.0/0 (App)

Optional later:
- TCP 80/443 only if you put Nginx in front.

## 3) SSH from Windows
From project root (or wherever key exists):

```powershell
ssh -i keys\ssh-key-2026-03-28.key ubuntu@<PUBLIC_IP>
```

Do NOT use the .pub file.

## 4) Server setup

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
node -v
npm -v
```

## 5) Clone and install

```bash
cd ~
git clone https://github.com/HamzaW06/AutoScout.git
cd AutoScout
npm install
cd web && npm install && cd ..
```

## 6) Create .env (no quotes around keys)

```bash
cat > ~/AutoScout/.env << 'EOF'
HOST=0.0.0.0
PORT=3000
LOG_LEVEL=info
NODE_ENV=production
ALLOWED_ORIGINS=http://<PUBLIC_IP>:3000

REQUEST_DELAY_MS=2000
MAX_CONCURRENT_SCRAPERS=3

GOOGLE_AI_API_KEY=REPLACE_ME
MARKETCHECK_API_KEY=REPLACE_ME
GOOGLE_PLACES_API_KEY=REPLACE_ME
VINAUDIT_API_KEY=
DISCORD_WEBHOOK_URL=
EOF
```

If you later host frontend separately, change ALLOWED_ORIGINS to your real frontend domain.

## 7) Build

```bash
npm run build
```

Expected result:
- root TypeScript build passes
- web build passes

## 8) Start with PM2

```bash
pm2 start dist/index.js --name autoscout
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`.

Then verify:

```bash
pm2 status
pm2 logs autoscout --lines 80
```

## 9) Fix Ubuntu iptables ordering if app still not reachable
If `iptables` has a REJECT rule before port 3000 ACCEPT, move it above REJECT:

```bash
sudo iptables -L INPUT -n --line-numbers
# if needed, delete bad 3000 rule line and reinsert above reject
sudo iptables -D INPUT <line-number-for-3000-rule>
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

## 10) Validate
From your laptop browser:
- http://<PUBLIC_IP>:3000/api/health
- http://<PUBLIC_IP>:3000

From server:

```bash
curl -s http://localhost:3000/api/health
```

## 11) Update flow after code changes

```bash
cd ~/AutoScout
git pull
npm install
cd web && npm install && cd ..
npm run build
pm2 restart autoscout
pm2 logs autoscout --lines 80
```

## 12) Common failure fixes
- SSH fails with invalid key format: you used .pub instead of private key.
- Build errors about React/Vite modules: run npm install inside web folder.
- "Cannot GET /": use latest code and successful web build; server now serves built frontend.
- Page not reachable but PM2 online: check Oracle security list + iptables rule order.

## 13) Optional hardening (recommended)
- Put Nginx reverse proxy in front on 80/443.
- Add HTTPS (Let's Encrypt) if using domain.
- Restrict SSH source CIDR from 0.0.0.0/0 to your IP.
- Rotate exposed API keys now.
