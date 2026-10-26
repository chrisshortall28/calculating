import { crc32 as nodeCrc32 } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createZip, crc32 } from './zip';

const text = (s: string) => new TextEncoder().encode(s);

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
  });

  it('matches node for binary data', () => {
    const data = Uint8Array.from({ length: 5000 }, (_, i) => (i * 31 + 7) & 0xff);
    expect(crc32(data)).toBe(nodeCrc32(data));
  });
});

describe('createZip', () => {
  /** Reads the archive back through its central directory, as an unzip tool does. */
  function read(zip: Uint8Array) {
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const files: { name: string; data: Uint8Array; crc: number }[] = [];
    for (let i = 0; i < count; i++) {
      expect(view.getUint32(at, true)).toBe(0x02014b50);
      const crc = view.getUint32(at + 16, true);
      const size = view.getUint32(at + 24, true);
      const nameLength = view.getUint16(at + 28, true);
      const local = view.getUint32(at + 42, true);
      const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength));
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      files.push({ name, data: zip.slice(start, start + size), crc });
      at += 46 + nameLength;
    }
    return files;
  }

  it('stores files that read back with their names, contents and checksums', () => {
    const a = text('hello');
    const b = Uint8Array.from({ length: 3000 }, (_, i) => i & 0xff);
    const files = read(
      createZip([
        { name: 'a.txt', data: a },
        { name: 'DATA001B.ROL', data: b },
      ]),
    );
    expect(files.map((f) => f.name)).toEqual(['a.txt', 'DATA001B.ROL']);
    expect(files[0]!.data).toEqual(a);
    expect(files[1]!.data).toEqual(b);
    expect(files.map((f) => f.crc)).toEqual([nodeCrc32(a), nodeCrc32(b)]);
  });

  it('makes an empty archive', () => {
    expect(read(createZip([]))).toEqual([]);
  });
});
