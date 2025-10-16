const http = require('http');
const code = process.argv[2] || 'UL6K7M';
const options = {
  hostname: '127.0.0.1',
  port: 5000,
  path: `/api/rooms/check/${code}`,
  method: 'GET',
  timeout: 2000,
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    try { console.log(JSON.parse(data)); } catch (e) { console.log(data); }
  });
});
req.on('error', (e) => console.error('REQUEST ERROR', e.message));
req.end();
