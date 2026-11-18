// Minimal types for the few Node APIs tests use (the project only carries browser types; @types/node
// would clash with them in the game code). v4.47: tests/castfile.test.ts.
declare const __dirname: string;
interface NodeBuf extends Uint8Array {
  readUInt32LE(offset: number): number;
  subarray(start?: number, end?: number): NodeBuf;
  toString(encoding?: string): string;
}
declare module 'node:fs' {
  export function readFileSync(path: string): NodeBuf;
  const fs: { readFileSync: typeof readFileSync };
  export default fs;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  const path: { join: typeof join };
  export default path;
}
declare module 'node:crypto' {
  interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(encoding: 'hex'): string;
  }
  export function createHash(alg: string): Hash;
  const crypto: { createHash: typeof createHash };
  export default crypto;
}
declare module 'node:zlib' {
  export function gunzipSync(data: Uint8Array): NodeBuf;
  const zlib: { gunzipSync: typeof gunzipSync };
  export default zlib;
}
