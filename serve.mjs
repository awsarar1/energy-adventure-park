import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.ENERGY_PARK_PORT ?? 4173);
const types = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  woff: 'font/woff',
  woff2: 'font/woff2',
};
try {
  await readFile(new URL('./dist/index.html', import.meta.url));
} catch {
  console.error('النسخة المبنية غير موجودة. نفّذي npm ci ثم npm run build.');
  process.exit(1);
}
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const file = path === '/' ? 'index.html' : /^\/assets\/[\w.-]+$/.test(path) ? path.slice(1) : null;
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(new URL('./dist/' + file, import.meta.url));
    response.writeHead(200, { 'Content-Type': types[file.split('.').at(-1)] ?? 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});
server.on('error', error => {
  console.error('تعذّر تشغيل الخادم المحلي:', error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`مدينة ملاهي الطاقة · http://127.0.0.1:${port}/`));
