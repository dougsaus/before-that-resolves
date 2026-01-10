import os from 'node:os';

const envHost = (process.env.LAN_HOST || '').trim();
if (envHost) {
  process.stdout.write(envHost);
  process.exit(0);
}

const nets = os.networkInterfaces();
const addresses = [];

for (const infos of Object.values(nets)) {
  for (const info of infos || []) {
    if (info.family === 'IPv4' && !info.internal) {
      addresses.push(info.address);
    }
  }
}

const isPrivate = (address) => {
  if (address.startsWith('10.') || address.startsWith('192.168.')) {
    return true;
  }
  const parts = address.split('.').map((part) => Number(part));
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
};

const host = addresses.find(isPrivate) || addresses[0];

if (!host) {
  process.stderr.write('Unable to detect a LAN IP. Set LAN_HOST=your.ip.address\n');
  process.exit(1);
}

process.stdout.write(host);
