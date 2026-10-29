import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

test('scripts/server.mjs: rotas de sinalização HTTP e SSE', async (t) => {
  const TEST_PORT = 8999;
  const proc = spawn('node', ['scripts/server.mjs'], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe',
  });

  t.after(() => {
    proc.kill('SIGTERM');
  });

  // Aguarda servidor subir
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Servidor não subiu a tempo')), 4000);
    proc.stdout.on('data', (d) => {
      if (d.toString().includes('Servidor Tabuleiro do CEO ativo')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  const baseUrl = `http://localhost:${TEST_PORT}`;

  // 1. GET /_sinal/ping
  const pingRes = await fetch(`${baseUrl}/_sinal/ping`);
  assert.equal(pingRes.status, 200);
  const pingJson = await pingRes.json();
  assert.equal(pingJson.ok, true);

  // 2. OPTIONS /_sinal/K9P2 (CORS)
  const optRes = await fetch(`${baseUrl}/_sinal/K9P2`, { method: 'OPTIONS' });
  assert.equal(optRes.status, 204);
  assert.equal(optRes.headers.get('access-control-allow-origin'), '*');

  // 3. GET /_sinal/K9P2 (SSE)
  const reqSse = http.request(`${baseUrl}/_sinal/K9P2`, {
    headers: { Accept: 'text/event-stream' },
  });

  const mensagensRecebidasNoSse = [];
  reqSse.on('response', (res) => {
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/event-stream/);
    res.on('data', (chunk) => {
      const texto = chunk.toString();
      for (const linha of texto.split('\n')) {
        if (linha.startsWith('data: ')) {
          try {
            mensagensRecebidasNoSse.push(JSON.parse(linha.slice(6)));
          } catch {
            /* ignora */
          }
        }
      }
    });
  });
  reqSse.end();

  // Dá um instante para o listener registrar
  await new Promise((r) => setTimeout(r, 100));

  // 4. POST /_sinal/K9P2
  const postRes = await fetch(`${baseUrl}/_sinal/K9P2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'teste', texto: 'olá mundo' }),
  });
  assert.equal(postRes.status, 200);
  const postJson = await postRes.json();
  assert.equal(postJson.ok, true);

  // Aguarda evento chegar via SSE
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(mensagensRecebidasNoSse.length, 1);
  assert.equal(mensagensRecebidasNoSse[0].tipo, 'teste');
  assert.equal(mensagensRecebidasNoSse[0].texto, 'olá mundo');

  // 5. GET /_sinal/K9P2/mensagens (polling)
  const pollRes = await fetch(`${baseUrl}/_sinal/K9P2/mensagens?desde=0`);
  assert.equal(pollRes.status, 200);
  const pollJson = await pollRes.json();
  assert.equal(pollJson.ok, true);
  assert.equal(pollJson.mensagens.length, 1);
  assert.equal(pollJson.mensagens[0].tipo, 'teste');

  reqSse.destroy();
});
