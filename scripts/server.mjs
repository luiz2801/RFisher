import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 8000;
const ROOT = process.cwd();

const MIMES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function obterIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const lista of Object.values(interfaces)) {
    for (const info of lista ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        return info.address;
      }
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // Evita directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Acesso negado');
    return;
  }

  // Se for diretório, procura index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Não Encontrado');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIMES[ext] || 'application/octet-stream';

  // Cabeçalhos para nunca cachear em desenvolvimento local / testes entre aparelhos
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*',
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = obterIpLocal();
  console.log(`\n🎲 Servidor Tabuleiro do CEO ativo na porta ${PORT}`);
  console.log(`  > Local:       http://localhost:${PORT}`);
  if (ip) {
    console.log(`  > No celular:  http://${ip}:${PORT}`);
  }
  console.log('  (Cache desabilitado automaticamente para módulos e estilos)\n');
});
