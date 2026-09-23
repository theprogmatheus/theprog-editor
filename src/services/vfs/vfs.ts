import type { FileKind } from '../languages/types';

export interface VFile {
  id: string;
  path: string;
  name: string;
  kind: FileKind;
  size: number;
  updatedAt: number;
  readBytes(): Promise<Uint8Array>;
  readText(): Promise<string>;
  readStream(chunkSize?: number): ReadableStream<Uint8Array>;
  write(data: Uint8Array | string): Promise<void>;
}

export class MemoryVFile implements VFile {
  public id: string;
  public path: string;
  public name: string;
  public kind: FileKind;
  public updatedAt: number;
  private buffer: Uint8Array;

  constructor(id: string, path: string, initialData: Uint8Array | string, kind: FileKind = 'text') {
    this.id = id;
    this.path = path;
    this.name = path.split('/').pop() || path;
    this.kind = kind;
    this.updatedAt = Date.now();
    if (typeof initialData === 'string') {
      this.buffer = new TextEncoder().encode(initialData);
    } else {
      this.buffer = initialData;
    }
  }

  get size(): number {
    return this.buffer.byteLength;
  }

  async readBytes(): Promise<Uint8Array> {
    return new Uint8Array(this.buffer);
  }

  async readText(): Promise<string> {
    return new TextDecoder('utf-8').decode(this.buffer);
  }

  readStream(chunkSize: number = 64 * 1024): ReadableStream<Uint8Array> {
    const data = this.buffer;
    let offset = 0;

    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= data.byteLength) {
          controller.close();
          return;
        }
        const next = Math.min(offset + chunkSize, data.byteLength);
        const chunk = data.subarray(offset, next);
        offset = next;
        controller.enqueue(chunk);
      },
    });
  }

  async write(data: Uint8Array | string): Promise<void> {
    if (typeof data === 'string') {
      this.buffer = new TextEncoder().encode(data);
    } else {
      this.buffer = new Uint8Array(data);
    }
    this.updatedAt = Date.now();
  }
}

export class VirtualFileSystem {
  private files = new Map<string, VFile>();

  public register(file: VFile): void {
    this.files.set(file.path, file);
  }

  public get(path: string): VFile | undefined {
    return this.files.get(path);
  }

  public remove(path: string): boolean {
    return this.files.delete(path);
  }

  public list(): VFile[] {
    return Array.from(this.files.values());
  }

  public clear(): void {
    this.files.clear();
  }
}

export const vfs = new VirtualFileSystem();
