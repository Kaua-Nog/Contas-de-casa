import https from 'https';
const url = 'https://ais-dev-ojqxtuoyefmzk2gk5vufnb-161500518592.us-east1.run.app/api/health';
https.get(url, (res) => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);
}).on('error', (e) => console.error(e));
