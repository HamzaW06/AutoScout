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

## 3) SSH from Windows

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

## 7) Build and start

```bash
npm run build
pm2 start dist/index.js --name autoscout
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`.

## 8) Validate

```bash
pm2 status
pm2 logs autoscout --lines 80
curl -s http://localhost:3000/api/health
```

Browser:
- http://<PUBLIC_IP>:3000
- http://<PUBLIC_IP>:3000/api/health

## 9) Fix Ubuntu iptables ordering if app is unreachable

```bash
sudo iptables -L INPUT -n --line-numbers
sudo iptables -D INPUT <line-number-for-3000-rule>
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

## 10) Update flow after code changes

```bash
cd ~/AutoScout
git pull
npm install
cd web && npm install && cd ..
npm run build
pm2 restart autoscout
pm2 logs autoscout --lines 80
```
