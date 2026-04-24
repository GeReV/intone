export class Queue {
  private chunks: string[] = []
  private prefetchCache = new Map<number, string>()
  private currentIndex = 0

  load(chunks: string[]): void {
    this.chunks = chunks
    this.currentIndex = 0
    this.prefetchCache.clear()
  }

  current(): string | null {
    return this.chunks[this.currentIndex] ?? null
  }

  peek(index: number): string | null {
    return this.chunks[index] ?? null
  }

  advance(): void {
    this.currentIndex++
  }

  retreat(): void {
    if (this.currentIndex > 0) this.currentIndex--
  }

  get index(): number {
    return this.currentIndex
  }

  get total(): number {
    return this.chunks.length
  }

  setPrefetch(index: number, url: string): void {
    this.prefetchCache.set(index, url)
  }

  getPrefetch(index: number): string | undefined {
    return this.prefetchCache.get(index)
  }

  clearPrefetch(index: number): void {
    this.prefetchCache.delete(index)
  }
}
