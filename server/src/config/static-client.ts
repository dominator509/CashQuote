import fs from 'fs';
import path from 'path';

export interface StaticClientBuild {
  clientDist: string;
  clientIndex: string;
}

export const getStaticClientBuild = (cwd = process.cwd()): StaticClientBuild => {
  const clientDist = path.resolve(cwd, 'client/dist');
  const clientIndex = path.join(clientDist, 'index.html');

  if (!fs.existsSync(clientIndex)) {
    throw new Error(`Production client build not found at ${clientIndex}`);
  }

  return { clientDist, clientIndex };
};
