export type Timer = {
  stop(): void;
  restart(): void;
}

export function startTimer(timeout: number, callback: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(callback, timeout);
  return {
    stop: function () {
      clearTimeout(timer);
      timer = undefined;
    },
    restart: function () {
      clearTimeout(timer);
      timer = setTimeout(callback, timeout);
    }
  };
}