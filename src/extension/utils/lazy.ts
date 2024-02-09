export function lazy<T>(get: () => T): () => T {
  let value: T;
  return () => value || (value = get());
}