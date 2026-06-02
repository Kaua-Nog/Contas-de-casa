import https from 'https';
const data = JSON.stringify({
  local: "ChannelStartupService.sendDataWebhook-local",
  url: "https://ais-pre-ojqxtuoyefmzk2gk5vufnb-161500518592.us-east1.run.app/api/webhook/whatsapp",
  event: "messages.upsert",
  instance: "AppCasa",
  data: {
    key: {
      remoteJid: '120363428218497591@g.us',
      fromMe: false,
    },
    message: {
      conversation: 'Adicionar ping na lista'
    }
  }
});

const options = {
  hostname: 'ais-pre-ojqxtuoyefmzk2gk5vufnb-161500518592.us-east1.run.app',
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
