#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
export NODE_ENV=production
echo "Deploying database migrations..."
npm run prisma:migrate
echo "Starting Node.js server..."
node server/dist/index.js
