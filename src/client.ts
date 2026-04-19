import { HttpClient } from './api/http-client.js';
import { WorldsApi } from './api/worlds.js';
import { ItemsApi } from './api/items.js';

export interface XriftClientConfig {
  token: string;
  baseUrl?: string;
  timeout?: number;
}

export class XriftClient {
  readonly worlds: WorldsApi;
  readonly items: ItemsApi;

  constructor(config: XriftClientConfig) {
    const http = new HttpClient({
      baseUrl: config.baseUrl,
      token: config.token,
      timeout: config.timeout,
    });

    this.worlds = new WorldsApi(http);
    this.items = new ItemsApi(http);
  }
}
