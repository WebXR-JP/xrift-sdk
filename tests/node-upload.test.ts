import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the XriftClient before importing the module under test
vi.mock('../src/client.js', () => {
  const mockUpload = vi.fn().mockResolvedValue({
    worldId: 'world-123',
    versionId: 'ver-1',
    versionNumber: 1,
    contentHash: 'abc',
    files: [],
  });
  const mockItemUpload = vi.fn().mockResolvedValue({
    itemId: 'item-123',
    versionId: 'ver-1',
    versionNumber: 1,
    contentHash: 'abc',
    files: [],
  });

  return {
    XriftClient: vi.fn().mockImplementation(() => ({
      worlds: { upload: mockUpload },
      items: { upload: mockItemUpload },
    })),
    __mockWorldUpload: mockUpload,
    __mockItemUpload: mockItemUpload,
  };
});

import {
  uploadWorldFromDirectory,
  uploadItemFromDirectory,
} from '../src/node/upload.js';
import { XriftClient } from '../src/client.js';

describe('uploadWorldFromDirectory', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'xrift-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
    vi.clearAllMocks();
  });

  it('should read xrift.json, collect files, and call worlds.upload', async () => {
    // Setup: create xrift.json and dist files
    const config = {
      world: {
        distDir: './dist',
        title: 'Test World',
        description: 'A test',
      },
    };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist'));
    await writeFile(join(tmpDir, 'dist', 'scene.glb'), 'glb-data');
    await writeFile(join(tmpDir, 'dist', 'index.html'), '<html></html>');

    const result = await uploadWorldFromDirectory(tmpDir, {
      token: 'test-token',
    });

    expect(result.worldId).toBe('world-123');

    // Verify XriftClient was created with correct config
    expect(XriftClient).toHaveBeenCalledWith({
      token: 'test-token',
      baseUrl: undefined,
      timeout: undefined,
    });

    // Verify upload was called with the right files
    const mockClient = vi.mocked(XriftClient).mock.results[0]
      .value as ReturnType<typeof XriftClient>;
    const uploadCall = vi.mocked(mockClient.worlds.upload).mock.calls[0];
    const uploadFiles = uploadCall[0];
    const uploadOptions = uploadCall[1];

    expect(uploadFiles).toHaveLength(2);
    const remotePaths = uploadFiles.map((f) => f.remotePath).sort();
    expect(remotePaths).toEqual(['index.html', 'scene.glb']);

    expect(uploadOptions.name).toBe('Test World');
    expect(uploadOptions.description).toBe('A test');
  });

  it('should filter out ignored files', async () => {
    const config = {
      world: {
        distDir: 'dist',
        title: 'Test',
      },
    };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist'));
    await writeFile(join(tmpDir, 'dist', 'scene.glb'), 'data');
    await writeFile(
      join(tmpDir, 'dist', '__federation_shared_abc.js'),
      'shared',
    );

    await uploadWorldFromDirectory(tmpDir, { token: 'tok' });

    const mockClient = vi.mocked(XriftClient).mock.results[0]
      .value as ReturnType<typeof XriftClient>;
    const uploadFiles = vi.mocked(mockClient.worlds.upload).mock.calls[0][0];

    expect(uploadFiles).toHaveLength(1);
    expect(uploadFiles[0].remotePath).toBe('scene.glb');
  });

  it('should handle nested dist directories', async () => {
    const config = { world: { distDir: 'dist' } };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist', 'assets'), { recursive: true });
    await writeFile(join(tmpDir, 'dist', 'index.html'), 'html');
    await writeFile(join(tmpDir, 'dist', 'assets', 'model.glb'), 'glb');

    await uploadWorldFromDirectory(tmpDir, { token: 'tok' });

    const mockClient = vi.mocked(XriftClient).mock.results[0]
      .value as ReturnType<typeof XriftClient>;
    const uploadFiles = vi.mocked(mockClient.worlds.upload).mock.calls[0][0];
    const remotePaths = uploadFiles.map((f) => f.remotePath).sort();

    expect(remotePaths).toEqual(['assets/model.glb', 'index.html']);
  });

  it('should throw when xrift.json is missing', async () => {
    await expect(
      uploadWorldFromDirectory(tmpDir, { token: 'tok' }),
    ).rejects.toThrow('xrift.json not found');
  });

  it('should throw when config type is item', async () => {
    const config = { item: { distDir: 'dist' } };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist'));

    await expect(
      uploadWorldFromDirectory(tmpDir, { token: 'tok' }),
    ).rejects.toThrow('does not contain a "world" configuration');
  });

  it('should throw when distDir does not exist', async () => {
    const config = { world: { distDir: 'nonexistent' } };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));

    await expect(
      uploadWorldFromDirectory(tmpDir, { token: 'tok' }),
    ).rejects.toThrow('distDir not found');
  });

  it('should pass worldId and onProgress options', async () => {
    const config = { world: { distDir: 'dist' } };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist'));
    await writeFile(join(tmpDir, 'dist', 'a.txt'), 'data');

    const onProgress = vi.fn();
    await uploadWorldFromDirectory(tmpDir, {
      token: 'tok',
      worldId: 'w-1',
      onProgress,
    });

    const mockClient = vi.mocked(XriftClient).mock.results[0]
      .value as ReturnType<typeof XriftClient>;
    const options = vi.mocked(mockClient.worlds.upload).mock.calls[0][1];
    expect(options.worldId).toBe('w-1');
    expect(options.onProgress).toBe(onProgress);
  });
});

describe('uploadItemFromDirectory', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'xrift-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
    vi.clearAllMocks();
  });

  it('should read xrift.json and call items.upload', async () => {
    const config = {
      item: {
        distDir: 'dist',
        title: 'Test Item',
        description: 'An item',
        permissions: { allowedDomains: ['example.com'] },
      },
    };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist'));
    await writeFile(join(tmpDir, 'dist', 'model.glb'), 'glb');

    const result = await uploadItemFromDirectory(tmpDir, { token: 'tok' });
    expect(result.itemId).toBe('item-123');

    const mockClient = vi.mocked(XriftClient).mock.results[0]
      .value as ReturnType<typeof XriftClient>;
    const options = vi.mocked(mockClient.items.upload).mock.calls[0][1];
    expect(options.name).toBe('Test Item');
    expect(options.description).toBe('An item');
    expect(options.permissions).toEqual({ allowedDomains: ['example.com'] });
  });

  it('should throw when config type is world', async () => {
    const config = { world: { distDir: 'dist' } };
    await writeFile(join(tmpDir, 'xrift.json'), JSON.stringify(config));
    await mkdir(join(tmpDir, 'dist'));

    await expect(
      uploadItemFromDirectory(tmpDir, { token: 'tok' }),
    ).rejects.toThrow('does not contain an "item" configuration');
  });
});
