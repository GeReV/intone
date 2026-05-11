export class AudioCache {
  private readonly maxSize: number;
  private readonly entries = new Map<number, string>();

  public constructor(maxSize = 10) {
    this.maxSize = maxSize;
  }

  public get(index: number): string | undefined {
    const url = this.entries.get(index);
    if (url === undefined) {
      return undefined;
    }

    this.entries.delete(index);
    this.entries.set(index, url);

    return url;
  }

  public has(index: number): boolean {
    return this.entries.has(index);
  }

  public set(index: number, url: string): void {
    if (this.entries.has(index)) {
      this.entries.delete(index);
      this.entries.set(index, url);
      return;
    }

    if (this.entries.size >= this.maxSize) {
      const first = this.entries.entries().next();

      if (!first.done) {
        const [lruIndex, lruUrl] = first.value;

        if (lruUrl.startsWith("blob:")) {
          URL.revokeObjectURL(lruUrl);
        }

        this.entries.delete(lruIndex);
      }
    }
    this.entries.set(index, url);
  }

  public clear(): void {
    for (const url of this.entries.values()) {
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }

    this.entries.clear();
  }
}
