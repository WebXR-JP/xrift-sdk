const MIME_TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ktx2': 'image/ktx2',
  '.basis': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.exr': 'application/octet-stream',
};

export function getMimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}
