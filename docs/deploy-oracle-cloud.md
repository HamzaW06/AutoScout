# AutoScout - Oracle Cloud Free Tier Deployment Guide

Save this for when Oracle capacity opens up.

## 1. Create Oracle Cloud Account

- Go to https://cloud.oracle.com/
- Sign up for a free account (credit card required but never charged for Always Free)
- **Pick a region with capacity** — try EU-Frankfurt, UK-London, or Canada-Toronto

## 2. Create a VM Instance

- Go to Compute → Instances → Create Instance
- **Name:** autoscout
- **Shape (try in order):**
  1. VM.Standard.A1.Flex — 2 OCPU, 12 GB RAM (ARM, best performance)
  2. VM.Standard.E2.1.Micro — 1 OCPU, 1 GB RAM (x86, more available)
- **Image:** Ubuntu 22.04
- **Networking:** Assign a **public IPv4 address** (CRITICAL — must be Yes)
- **SSH Key:** Generate or upload your SSH key
- **Boot volume:** Default 47 GB is fine, enable in-transit encryption
- Try all availability domains (AD-1, AD-2, AD-3) if one is full

## 3. Open Firewall Ports

### Oracle Cloud Console (Security List)
1. Networking → Virtual Cloud Networks → your VCN → Subnet → Security List
2. Add Ingress Rules:
   - **SSH:** Source 0.0.0.0/0, TCP, Port 22
   - **HTTP:** Source 0.0.0.0/0, TCP, Port 3000

### On the VM (iptables)
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo netfilter-persistent save
```

## 4. SSH into the Server

```bash
ssh -i /path/to/your/private-key ubuntu@YOUR_PUBLIC_IP
```

## 5. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install git
sudo apt install -y git
```

## 6. Clone and Setup

```bash
cd ~
git clone https://github.com/HamzaW06/AutoScout.git
cd AutoScout
npm install
```

## 7. Configure Environment

```bash
nano .env
```

Add:
```
PORT=3000
NODE_ENV=production
VINAUDIT_API_KEY=your_key_here
DISCORD_WEBHOOK_URL=your_discord_webhook_here
```

Save: Ctrl+O, Enter, Ctrl+X

## 8. Build and Start

```bash
npm run build
pm2 start dist/index.js --name autoscout
pm2 save
pm2 startup
```

Run the command that `pm2 startup` outputs (it will look like `sudo env PATH=... pm2 startup systemd ...`).

## 9. Access Dashboard

Open in browser: `http://YOUR_PUBLIC_IP:3000`

## 10. Maintenance

```bash
# View logs
pm2 logs autoscout

# Restart
pm2 restart autoscout

# Update code
cd ~/AutoScout
git pull
npm install
npm run build
pm2 restart autoscout

# Monitor
pm2 monit
```

## Capacity Tips

Oracle ARM instances are in high demand. If you can't create one:
- Try all availability domains (AD-1, AD-2, AD-3)
- Try the E2.1.Micro shape instead
- Try early morning hours (4-6 AM)
- Retry every few hours — capacity opens as others delete instances
- Create a new account in a different region if needed
