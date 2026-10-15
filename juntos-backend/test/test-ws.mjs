import WebSocket from 'ws';

const cookieHeader = process.env.WS_COOKIE || '';
const wsUrl = process.env.WS_URL || 'ws://localhost:8788/ws';

function tryConnect(label, headers) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl, { headers, timeout: 5000 });
    const t = setTimeout(() => {
      ws.terminate();
      resolve(`${label}: TIMEOUT`);
    }, 6000);
    ws.on('open', () => {
      ws.on('message', (m) => {
        const parsed = JSON.parse(m.toString());
        clearTimeout(t);
        if (parsed.type === 'init') {
          resolve(`${label}: 101 + init pois=${parsed.data.pois?.length} role=${parsed.data.authenticatedUser?.role}`);
        } else {
          resolve(`${label}: 101 + ${parsed.type}`);
        }
        ws.close();
      });
    });
    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(t);
      resolve(`${label}: ${res.statusCode}`);
    });
    ws.on('error', (e) => {
      clearTimeout(t);
      resolve(`${label}: ERROR ${e.message}`);
    });
  });
}

const results = [];
const originOk = process.env.WS_ORIGIN_OK || 'http://localhost:8788';
results.push(await tryConnect('sem_cookie', {}));
results.push(await tryConnect('com_cookie', { Cookie: cookieHeader, Origin: originOk }));
results.push(await tryConnect('origin_invalida', { Cookie: cookieHeader, Origin: 'https://evil.example' }));
console.log(results.join('\n'));
process.exit(0);
