import http from 'http';
const data = JSON.stringify({
  local: "ChannelStartupService.sendDataWebhook-local",
  url: "https://ais-dev...",
  event: "messages.upsert",
  instance: "AppCasa",
  data: {
    key: {
      remoteJid: '120363428218497591@g.us',
      fromMe: false,
      id: "AC4BC1D5F4...",
      participant: "1094..."
    },
    pushName: "Kauã Oliveira",
    message: {
      conversation: 'Adicionar 1 shampoo na lista',
      messageContextInfo: {}
    },
    contextInfo: undefined,
    messageType: "conversation",
    messageTimestamp: 1780432622,
    owner: "AppCasa",
    source: "android"
  }
});
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/webhook/whatsapp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});
req.on('error', error => console.error(error));
req.write(data);
req.end();
