import fs from 'fs';
import { getStaticClientBuild } from '../../server/src/config/static-client';

describe('production runtime hardening', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fails startup when production SPA build is missing', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(() => getStaticClientBuild('C:\\app')).toThrow('Production client build not found');
  });
});
