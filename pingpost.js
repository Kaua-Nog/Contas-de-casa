import http from 'http';
import https from 'https';
const data = JSON.stringify({});
const options = {
  hostname: 'ais-dev-ojqxtuoyefmzk2gk5vufnb-161500518592.us-east1.run.app',
  port: 443,
  path: '/api/webhook/whatsapp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});
req.on('error', error => console.error(error));
req.write(data);
req.end();
