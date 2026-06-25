import { spawn } from 'child_process';

const port = process.env.SMOKE_PORT || '3100';
const baseUrl = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: port,
};

const server = spawn(process.execPath, ['server/dist/index.js'], {
  env,
  stdio: 'inherit',
});

const stopServer = () =>
  new Promise((resolve) => {
    if (server.killed || server.exitCode !== null) {
      resolve();
      return;
    }

    server.once('exit', resolve);
    server.kill('SIGTERM');
    setTimeout(() => {
      if (server.exitCode === null) {
        server.kill('SIGKILL');
      }
    }, 5000);
  });

const waitFor = async (path, validate) => {
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}${path}`);
      if (response.ok && (!validate || (await validate(response)))) {
        return;
      }
      lastError = new Error(`${path} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError;
};

try {
  await waitFor('/healthz');
  await waitFor('/readyz');
  await waitFor('/', async (response) => {
    const body = await response.text();
    return body.includes('<div id="root"></div>');
  });
  console.log('Production smoke check passed');
} finally {
  await stopServer();
}
