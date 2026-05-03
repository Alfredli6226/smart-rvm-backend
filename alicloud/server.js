const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIST = path.join(__dirname, 'dist');
const API_UPSTREAM = 'rvm-merchant-platform-main.vercel.app';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// Proxy API calls to Vercel (where all serverless functions live)
function proxyApi(upstreamPath, req, res) {
  const options = {
    hostname: API_UPSTREAM,
    port: 443,
    path: upstreamPath,
    method: req.method,
    headers: { ...req.headers, host: API_UPSTREAM, 'accept-encoding': 'identity' },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Forward response headers
    const contentType = proxyRes.headers['content-type'] || 'application/json';
    res.writeHead(proxyRes.statusCode, { 'Content-Type': contentType });

    // Stream response
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API proxy failed', detail: err.message }));
  });

  // Forward request body
  req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  // Health check
  if (url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'healthy', server: 'alicloud-malaysia', time: new Date().toISOString() }));
  }

  // All other /api/* calls → proxy to Vercel
  if (url.startsWith('/api/')) {
    return proxyApi(url, req, res);
  }

  // Serve static files from dist
  let filePath = url === '/' ? '/index.html' : url;
  filePath = path.join(DIST, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      return fs.readFile(path.join(DIST, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(500);
          return res.end('Internal error');
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data2);
      });
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RVM Platform running on http://0.0.0.0:${PORT}`);
});
