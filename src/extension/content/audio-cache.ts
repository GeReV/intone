export class AudioCache {
  private readonly maxSize: number;
  private readonly entries = new Map<number, string>();

  constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  get(index: number): string | undefined {
    const url = this.entries.get(index);
    if (url === undefined) {
      return undefined;
    }

    this.entries.delete(index);
    this.entries.set(index, url);

    return url;
  }

  has(index: number): boolean {
    return this.entries.has(index);
  }

  set(index: number, url: string): void {
    if (this.entries.has(index)) {
      this.entries.delete(index);
      this.entries.set(index, url);
      return;
    }

    if (this.entries.size >= this.maxSize) {
      const first = this.entries.entries().next();

      if (!first.done) {
        const [lruIndex, lruUrl] = first.value;

        URL.revokeObjectURL(lruUrl);

        this.entries.delete(lruIndex);
      }
    }
    this.entries.set(index, url);
  }

  clear(): void {
    for (const url of this.entries.values()) {
      URL.revokeObjectURL(url);
    }

    this.entries.clear();
  }
}
