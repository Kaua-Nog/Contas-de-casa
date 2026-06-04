import fetch from 'node-fetch';

async function test() {
  const payload = {
    event: "messages.upsert",
    instance: "InstanciaAPP",
    data: {
      key: {
        remoteJid: "120363428218497591@g.us",
        fromMe: false,
        id: "TEST1234",
        participant: "10947921969181@lid"
      },
      message: {
        conversation: "Adicionar uma coca 2l na lista"
      }
    }
  };

  const res = await fetch('http://localhost:3000/api/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  console.log("Response:", res.status, text);
}

test();
