import { describe, it, expect } from 'vitest';
import {
  parseWorldConfig,
  parseItemConfig,
  filterFiles,
  DEFAULT_IGNORE_PATTERNS,
} from '../src/config.js';

describe('parseWorldConfig', () => {
  it('should parse a world config', () => {
    const json = JSON.stringify({
      world: {
        distDir: './dist',
        title: 'My World',
        description: 'A test world',
        thumbnailPath: 'thumb.png',
        physics: { gravity: 9.8 },
        camera: { near: 0.1, far: 1000 },
        permissions: { allowedDomains: ['example.com'] },
        outputBufferType: 'HalfFloatType',
      },
    });

    const config = parseWorldConfig(json);
    expect(config.type).toBe('world');
    expect(config.distDir).toBe('dist');
    expect(config.name).toBe('My World');
    expect(config.description).toBe('A test world');
    expect(config.thumbnailPath).toBe('thumb.png');
    expect(config.ignore).toEqual(DEFAULT_IGNORE_PATTERNS);
    expect(config.physics).toEqual({ gravity: 9.8 });
    expect(config.camera).toEqual({ near: 0.1, far: 1000 });
    expect(config.permissions).toEqual({ allowedDomains: ['example.com'] });
    expect(config.outputBufferType).toBe('HalfFloatType');
  });

  it('should default name to "Untitled" when title is missing', () => {
    const json = JSON.stringify({
      world: { distDir: 'dist' },
    });

    const config = parseWorldConfig(json);
    expect(config.name).toBe('Untitled');
  });

  it('should default name to "Untitled" when title is empty string', () => {
    const json = JSON.stringify({
      world: { distDir: 'dist', title: '' },
    });

    const config = parseWorldConfig(json);
    expect(config.name).toBe('Untitled');
  });

  it('should normalize distDir paths', () => {
    const cases = [
      { input: './dist', expected: 'dist' },
      { input: 'dist/', expected: 'dist' },
      { input: './dist/', expected: 'dist' },
      { input: '.', expected: '' },
      { input: 'build/output', expected: 'build/output' },
    ];

    for (const { input, expected } of cases) {
      const json = JSON.stringify({ world: { distDir: input } });
      const config = parseWorldConfig(json);
      expect(config.distDir).toBe(expected);
    }
  });

  it('should merge user ignore patterns with defaults', () => {
    const json = JSON.stringify({
      world: {
        distDir: 'dist',
        ignore: ['*.map', 'test/**'],
      },
    });

    const config = parseWorldConfig(json);
    expect(config.ignore).toEqual([
      '__federation_shared_*.js',
      '*.map',
      'test/**',
    ]);
  });

  it('should not duplicate ignore patterns', () => {
    const json = JSON.stringify({
      world: {
        distDir: 'dist',
        ignore: ['__federation_shared_*.js', 'extra.txt'],
      },
    });

    const config = parseWorldConfig(json);
    expect(config.ignore).toEqual([
      '__federation_shared_*.js',
      'extra.txt',
    ]);
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseWorldConfig('not json')).toThrow('Invalid JSON');
  });

  it('should throw when JSON is not an object', () => {
    expect(() => parseWorldConfig('"string"')).toThrow('must be a JSON object');
  });

  it('should throw when "world" key is missing', () => {
    expect(() => parseWorldConfig('{}')).toThrow(
      'does not contain a "world" key',
    );
  });

  it('should throw when "world" key is missing (item-only config)', () => {
    const json = JSON.stringify({ item: { distDir: 'dist' } });
    expect(() => parseWorldConfig(json)).toThrow(
      'does not contain a "world" key',
    );
  });

  it('should throw when distDir is missing', () => {
    const json = JSON.stringify({ world: {} });
    expect(() => parseWorldConfig(json)).toThrow('"world.distDir" is required');
  });

  it('should throw when world value is not an object', () => {
    const json = JSON.stringify({ world: 'not-object' });
    expect(() => parseWorldConfig(json)).toThrow('"world" must be an object');
  });
});

describe('parseItemConfig', () => {
  it('should parse an item config', () => {
    const json = JSON.stringify({
      item: {
        distDir: 'build',
        title: 'My Item',
        permissions: { allowedCodeRules: ['rule1'] },
      },
    });

    const config = parseItemConfig(json);
    expect(config.type).toBe('item');
    expect(config.distDir).toBe('build');
    expect(config.name).toBe('My Item');
    expect(config.permissions).toEqual({ allowedCodeRules: ['rule1'] });
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseItemConfig('not json')).toThrow('Invalid JSON');
  });

  it('should throw when JSON is not an object', () => {
    expect(() => parseItemConfig('"string"')).toThrow('must be a JSON object');
  });

  it('should throw when "item" key is missing', () => {
    expect(() => parseItemConfig('{}')).toThrow(
      'does not contain an "item" key',
    );
  });

  it('should throw when "item" key is missing (world-only config)', () => {
    const json = JSON.stringify({ world: { distDir: 'dist' } });
    expect(() => parseItemConfig(json)).toThrow(
      'does not contain an "item" key',
    );
  });

  it('should throw when distDir is missing', () => {
    const json = JSON.stringify({ item: {} });
    expect(() => parseItemConfig(json)).toThrow('"item.distDir" is required');
  });

  it('should throw when item value is not an object', () => {
    const json = JSON.stringify({ item: 'not-object' });
    expect(() => parseItemConfig(json)).toThrow('"item" must be an object');
  });
});

describe('filterFiles', () => {
  it('should filter out files matching ignore patterns', () => {
    const files = [
      'scene.glb',
      '__federation_shared_abc.js',
      '__federation_shared_xyz.js',
      'index.html',
    ];

    const result = filterFiles(files, DEFAULT_IGNORE_PATTERNS);
    expect(result).toEqual(['scene.glb', 'index.html']);
  });

  it('should match by filename only for nested paths', () => {
    const files = [
      'assets/scene.glb',
      'js/__federation_shared_abc.js',
    ];

    const result = filterFiles(files, ['__federation_shared_*.js']);
    expect(result).toEqual(['assets/scene.glb']);
  });

  it('should handle wildcard patterns', () => {
    const files = ['app.js', 'app.js.map', 'style.css', 'style.css.map'];

    const result = filterFiles(files, ['*.map']);
    expect(result).toEqual(['app.js', 'style.css']);
  });

  it('should return all files when no patterns match', () => {
    const files = ['a.js', 'b.css'];
    const result = filterFiles(files, ['*.txt']);
    expect(result).toEqual(['a.js', 'b.css']);
  });

  it('should return all files when patterns is empty', () => {
    const files = ['a.js', 'b.css'];
    const result = filterFiles(files, []);
    expect(result).toEqual(['a.js', 'b.css']);
  });
});

describe('DEFAULT_IGNORE_PATTERNS', () => {
  it('should contain federation shared pattern', () => {
    expect(DEFAULT_IGNORE_PATTERNS).toContain('__federation_shared_*.js');
  });
});
