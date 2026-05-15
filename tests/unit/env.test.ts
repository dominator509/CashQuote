import { test } from 'shared';

if (test !== 'test') {
  console.error('Environment verification failed');
  process.exit(1);
}
console.log('Environment verification passed');
