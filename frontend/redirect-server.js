import http from 'http';
import { request } from 'http';

const HTTP_PORT = 5001;
const HTTPS_HOST = '192.168.1.28';
const HTTPS_PORT = 5000;

const server = http.createServer((req, res) => {
  const url = `https://${HTTPS_HOST}:${HTTPS_PORT}${req.url}`;
  res.writeHead(301, { Location: url, 'Cache-Control': 'no-cache' });
  res.end();
});

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`HTTP redirect server: http://0.0.0.0:${HTTP_PORT} -> https://${HTTPS_HOST}:${HTTPS_PORT}`);
});
