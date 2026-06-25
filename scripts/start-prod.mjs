import { spawnSync } from 'child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  NODE_ENV: 'production',
};

const migrate = spawnSync(npmCommand, ['run', 'prisma:migrate'], {
  env,
  stdio: 'inherit',
});

if (migrate.status !== 0) {
  process.exit(migrate.status || 1);
}

const server = spawnSync(process.execPath, ['server/dist/index.js'], {
  env,
  stdio: 'inherit',
});

process.exit(server.status || 0);
