#!/bin/sh
cd "$(dirname "$0")/../.."
export NODE_ENV=production
echo "Deploying database migrations..."
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
echo "Starting Node.js server..."
node server/dist/index.js
