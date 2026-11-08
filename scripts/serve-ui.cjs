// Servidor estático para abrir la interfaz en un navegador (modo sin escritorio).
// Uso: node scripts/serve-ui.cjs LibroStudio/v3/app 5179
const http = require('http'),
  fs = require('fs'),
  path = require('path');
const [root, port] = [path.resolve(process.argv[2]), Number(process.argv[3] || 5179)];
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
http
  .createServer((req, res) => {
    const file = path.join(
      root,
      decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'),
    );
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res
        .writeHead(200, {
          'Content-Type': types[path.extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        })
        .end(data);
    });
  })
  .listen(port, '127.0.0.1', () => console.log('listo en http://127.0.0.1:' + port));
