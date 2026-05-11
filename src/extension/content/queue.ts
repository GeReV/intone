export class Queue {
  private chunks: string[] = [];
  private prefetchCache = new Map<number, string>();
  private currentIndex = 0;

  public load(chunks: string[]): void {
    this.chunks = chunks;
    this.currentIndex = 0;
    this.prefetchCache.clear();
  }

  public current(): string | null {
    return this.chunks[this.currentIndex] ?? null;
  }

  public peek(index: number): string | null {
    return this.chunks[index] ?? null;
  }

  public advance(): void {
    this.currentIndex++;
  }

  public retreat(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  public seekTo(index: number): void {
    if (this.chunks.length === 0) {
      return;
    }

    this.currentIndex = Math.max(0, Math.min(index, this.chunks.length - 1));

    for (const url of this.prefetchCache.values()) {
      URL.revokeObjectURL(url);
    }

    this.prefetchCache.clear();
  }

  public get index(): number {
    return this.currentIndex;
  }

  public get total(): number {
    return this.chunks.length;
  }

  public setPrefetch(index: number, url: string): void {
    this.prefetchCache.set(index, url);
  }

  public getPrefetch(index: number): string | undefined {
    return this.prefetchCache.get(index);
  }

  public clearPrefetch(index: number): void {
    this.prefetchCache.delete(index);
  }
}
