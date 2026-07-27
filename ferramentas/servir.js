// Preview local do public/ para o dono conferir ANTES do push (o push e o deploy).
// A pagina fala com o Supabase de PRODUCAO: a sessao e a base sao as de verdade.
//   node ferramentas/servir.js   ->  http://localhost:8788
const http = require('http'), fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
http.createServer(function (req, res) {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  let alvo = path.join(RAIZ, rel);
  if (!alvo.startsWith(RAIZ)) { res.writeHead(403).end('fora da raiz'); return; }
  if (!fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) alvo = path.join(RAIZ, 'index.html');
  res.writeHead(200, { 'content-type': TIPOS[path.extname(alvo)] || 'application/octet-stream',
    'cache-control': 'no-store' });
  fs.createReadStream(alvo).pipe(res);
}).listen(8788, function () { console.log('Pit Wall em http://localhost:8788 (Ctrl+C para parar)'); });
