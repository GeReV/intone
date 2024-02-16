import { bgCyan, black } from "kolorist";
import { ENTITY_MAP } from "./consts";

export * from "./consts";

export function log(name: string, message: string) {
  console.log(black(bgCyan(` ${name} `)), message);
}

export function getQueryString() {
  return new URLSearchParams(location.search.replace(/^\?/, ""));
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`=/]/g, (s) => ENTITY_MAP[s] ?? s);
}

export function errorToJson(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  } else {
    return err;
  }
}

export const nextId = (() => {
  let id = 0;

  return () => ++id;
})();

export const promisifyAbortSignal = (signal: AbortSignal) => new Promise<never>((_, reject) => {
  signal.onabort = reject;
});