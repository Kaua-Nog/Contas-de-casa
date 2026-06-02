import https from 'https';
const url = 'https://ais-pre-ojqxtuoyefmzk2gk5vufnb-161500518592.us-east1.run.app/api/health';
https.get(url, (res) => {
  console.log('statusCode:', res.statusCode);
  res.on('data', (d) => process.stdout.write(d));
}).on('error', (e) => console.error(e));
