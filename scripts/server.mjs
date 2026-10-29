import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = Number(process.env.PORT || 8000);
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

const salasSinal = new Map();

function obterSalaSinal(id) {
  const chave = String(id).trim().toUpperCase();
  let sala = salasSinal.get(chave);
  if (!sala) {
    sala = { ouvintes: new Set(), mensagens: [], ultimaAtividade: Date.now() };
    salasSinal.set(chave, sala);
  }
  sala.ultimaAtividade = Date.now();
  return sala;
}

// Limpa salas inativas após 30 minutos
setInterval(() => {
  const agora = Date.now();
  for (const [chave, sala] of salasSinal) {
    if (agora - sala.ultimaAtividade > 30 * 60 * 1000 && sala.ouvintes.size === 0) {
      salasSinal.delete(chave);
    }
  }
}, 60 * 1000).unref();

function tratarSinalizacao(req, res, urlPath) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return true;
  }

  if (urlPath === '/_sinal/ping') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  const match = urlPath.match(/^\/_sinal\/([^/]+)(?:\/(sse|mensagens))?$/);
  if (!match) return false;

  const [, codigoSala, subRota] = match;
  const sala = obterSalaSinal(codigoSala);

  if (req.method === 'GET' && subRota === 'mensagens') {
    const urlObj = new URL(req.url, 'http://localhost');
    const desde = Number(urlObj.searchParams.get('desde') || 0);
    const msgs = sala.mensagens.filter((m) => m.tempo > desde);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ ok: true, mensagens: msgs }));
    return true;
  }

  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(': ok\n\n');

    const ouvinte = (dados) => {
      try {
        res.write(`data: ${JSON.stringify(dados)}\n\n`);
      } catch {
        /* conexão fechada */
      }
    };
    sala.ouvintes.add(ouvinte);

    for (const msg of sala.mensagens) {
      ouvinte(msg);
    }

    const timerPing = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(timerPing);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(timerPing);
      sala.ouvintes.delete(ouvinte);
    });
    return true;
  }

  if (req.method === 'POST') {
    let corpo = '';
    req.on('data', (chunk) => {
      corpo += chunk;
      if (corpo.length > 512 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(corpo);
        const item = { ...payload, tempo: Date.now() };
        sala.mensagens.push(item);
        if (sala.mensagens.length > 30) sala.mensagens.shift();
        for (const ouvinte of sala.ouvintes) {
          ouvinte(item);
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ erro: 'JSON inválido' }));
      }
    });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.startsWith('/_sinal/')) {
    if (tratarSinalizacao(req, res, urlPath)) return;
  }
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
