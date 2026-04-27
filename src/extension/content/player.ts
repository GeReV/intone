import { AudioCache } from "./audio-cache";
import type { Queue } from "./queue";
import type { Settings } from "./settings";
import type { PlaybackState } from "./types";

const PREFETCH_AHEAD = 2;
const MAX_RETRIES = 3;

export class Player {
  private audio = new Audio();
  private state: PlaybackState["state"] = "idle";
  private fetchController: AbortController | null = null;
  private readonly audioCache = new AudioCache();

  onStateChange?: (state: PlaybackState) => void;

  get isPlaying(): boolean {
    return this.state === "playing";
  }

  constructor(
    private readonly queue: Queue,
    private readonly settings: Settings,
  ) {
    this.audio.addEventListener("ended", () => {
      this.onAudioEnded();
    });

    this.audio.addEventListener("error", () => {
      // Ignore errors from intentional stop or seek (audio.src = '' fires MEDIA_ERR_SRC_NOT_SUPPORTED)
      if (this.state === "stopped" || this.state === "idle" || this.state === "loading") {
        return;
      }

      this.notify("error", this.audio.error?.message ?? "Audio playback failed");
    });
  }

  async play(): Promise<void> {
    if (this.state === "playing" || this.state === "loading") {
      return;
    }

    if (this.state === "paused") {
      await this.audio.play();

      this.notify("playing");

      return;
    }

    await this.playCurrentChunk();
  }

  pause(): void {
    if (this.state !== "playing") {
      return;
    }

    this.audio.pause();

    this.notify("paused");
  }

  stop(): void {
    this.fetchController?.abort();

    this.audio.pause();
    this.audio.src = "";

    this.audioCache.clear();

    this.notify("stopped");
  }

  async forward(): Promise<void> {
    const wasActive = this.state === "playing" || this.state === "paused" || this.state === "loading";

    this.fetchController?.abort();

    this.audio.pause();
    this.audio.src = "";

    this.queue.advance();

    if (wasActive) {
      await this.playCurrentChunk();
    }
  }

  async rewind(): Promise<void> {
    const wasActive = this.state === "playing" || this.state === "paused" || this.state === "loading";

    this.fetchController?.abort();

    this.audio.pause();
    this.audio.src = "";

    this.queue.retreat();

    if (wasActive) {
      await this.playCurrentChunk();
    }
  }

  async seekTo(index: number): Promise<void> {
    this.fetchController?.abort();

    this.audio.pause();
    this.audio.src = "";

    this.queue.seekTo(index);

    await this.playCurrentChunk();
  }

  updateRate(rate: number): void {
    this.settings.rate = rate;
    this.audio.playbackRate = rate;
  }

  updateVolume(volume: number): void {
    this.settings.volume = volume;
    this.audio.volume = volume;
  }

  private async playCurrentChunk(): Promise<void> {
    const text = this.queue.current();
    if (text === null) {
      this.notify("stopped");
      return;
    }

    this.notify("loading");

    try {
      const url = await this.resolveAudio(text, this.queue.index);
      this.audio.src = url;
      this.audio.playbackRate = this.settings.rate;
      this.audio.volume = this.settings.volume;

      await this.audio.play();

      this.notify("playing");
      this.schedulePrefetch();
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        this.notify("error", err.message);
      }
    }
  }

  private async resolveAudio(text: string, index: number): Promise<string> {
    const cached = this.audioCache.get(index);

    if (cached) {
      return cached;
    }

    const url = await this.fetchAudio(text);
    this.audioCache.set(index, url);
    return url;
  }

  private async fetchAudio(text: string): Promise<string> {
    this.fetchController?.abort();
    this.fetchController = new AbortController();

    const { signal } = this.fetchController;

    const reqUrl = new URL(this.settings.serverUrl);
    reqUrl.searchParams.set("text", text);

    const urlStr = reqUrl.toString();

    let lastError: Error = new Error("Failed to fetch audio");
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, attempt * 1000));

        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
      }
      try {
        const res = await fetch(urlStr, { signal });

        if (!res.ok) {
          throw new Error(`TTS server responded with ${res.status}`);
        }

        return URL.createObjectURL(await res.blob());
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError;
  }

  private schedulePrefetch(): void {
    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const idx = this.queue.index + i;
      const text = this.queue.peek(idx);

      if (text && !this.audioCache.has(idx)) {
        void this.prefetchOne(idx, text);
      }
    }
  }

  private async prefetchOne(idx: number, text: string): Promise<void> {
    // Re-check inside the async body — another path may have cached this since schedulePrefetch checked
    if (this.audioCache.has(idx)) {
      return;
    }

    const reqUrl = new URL(this.settings.serverUrl);
    reqUrl.searchParams.set("text", text);

    try {
      const res = await fetch(reqUrl.toString());

      if (!res.ok) {
        return;
      }

      const blobUrl = URL.createObjectURL(await res.blob());

      if (this.state === "stopped" || this.state === "idle" || this.audioCache.has(idx)) {
        URL.revokeObjectURL(blobUrl);
      } else {
        this.audioCache.set(idx, blobUrl);
      }
    } catch { /* prefetch failures are silent */
    }
  }

  private onAudioEnded(): void {
    // Blob URL stays in AudioCache — available if the user seeks back to this sentence
    this.queue.advance();
    void this.playCurrentChunk();
  }

  private notify(state: PlaybackState["state"], error?: string): void {
    this.state = state;
    this.onStateChange?.({
      state,
      chunkIndex: this.queue.index,
      totalChunks: this.queue.total,
      error,
    });
  }
}
