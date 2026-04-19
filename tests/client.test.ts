import { describe, it, expect } from 'vitest';
import { XriftClient } from '../src/client.js';

describe('XriftClient', () => {
  it('worlds, items プロパティを持つ', () => {
    const client = new XriftClient({ token: 'test-token' });

    expect(client.worlds).toBeDefined();
    expect(client.items).toBeDefined();
  });

  it('baseUrl をカスタマイズできる', () => {
    const client = new XriftClient({
      token: 'test-token',
      baseUrl: 'https://custom.api.com',
    });

    expect(client).toBeDefined();
  });
});
