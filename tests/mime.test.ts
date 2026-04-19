import { describe, it, expect } from 'vitest';
import { getMimeType } from '../src/utils/mime.js';

describe('getMimeType', () => {
  it('既知の拡張子に対して正しい MIME タイプを返す', () => {
    expect(getMimeType('scene.glb')).toBe('model/gltf-binary');
    expect(getMimeType('scene.gltf')).toBe('model/gltf+json');
    expect(getMimeType('texture.png')).toBe('image/png');
    expect(getMimeType('photo.jpg')).toBe('image/jpeg');
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(getMimeType('image.webp')).toBe('image/webp');
    expect(getMimeType('data.json')).toBe('application/json');
    expect(getMimeType('app.js')).toBe('application/javascript');
    expect(getMimeType('module.mjs')).toBe('application/javascript');
    expect(getMimeType('index.html')).toBe('text/html');
    expect(getMimeType('style.css')).toBe('text/css');
    expect(getMimeType('readme.txt')).toBe('text/plain');
    expect(getMimeType('model.bin')).toBe('application/octet-stream');
  });

  it('不明な拡張子には application/octet-stream を返す', () => {
    expect(getMimeType('file.xyz')).toBe('application/octet-stream');
    expect(getMimeType('file.unknown')).toBe('application/octet-stream');
  });

  it('パス付きファイル名も処理する', () => {
    expect(getMimeType('assets/textures/diffuse.png')).toBe('image/png');
    expect(getMimeType('/path/to/scene.glb')).toBe('model/gltf-binary');
  });

  it('大文字拡張子も処理する', () => {
    expect(getMimeType('file.PNG')).toBe('image/png');
    expect(getMimeType('file.JPG')).toBe('image/jpeg');
  });
});
