type Resolve = () => void;

export default class AwaitableSet<T> extends Set<T> {
  private readonly listeners = new Map<T, Resolve[]>();

  public waitFor(value: T): Promise<void> {
    return new Promise<void>(resolve => {
      if (this.has(value)) {
        resolve();

        return;
      }

      const resolvers = this.listeners.get(value) ?? [];

      resolvers.push(resolve);

      this.listeners.set(value, resolvers);
    });
  }

  override add(value: T): this {
    super.add(value);

    const resolvers = this.listeners.get(value);

    if (resolvers) {
      for (const resolver of resolvers) {
        resolver();
      }

      this.listeners.delete(value);
    }

    return this;
  }

  override delete(value: T): boolean {
    const result = super.delete(value);

    this.listeners.delete(value);

    return result;
  }

  override clear() {
    super.clear();

    this.listeners.clear();
  }
}