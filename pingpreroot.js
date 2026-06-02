import https from 'https';
const options = {
  hostname: 'ais-pre-ojqxtuoyefmzk2gk5vufnb-161500518592.us-east1.run.app',
  port: 443,
  path: '/',
  method: 'GET'
};
const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
});
req.on('error', error => console.error(error));
req.end();
