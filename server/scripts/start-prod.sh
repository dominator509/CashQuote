#!/bin/sh
echo "Deploying database migrations..."
npx prisma migrate deploy --schema=../packages/db/prisma/schema.prisma
echo "Starting Node.js server..."
node dist/index.js
