import { Doc } from "~/player/doc";
import { SimpleSource, Source, TabSource } from "~/player/sources";
import { SpeechPosition } from "~/player/speech";
import { errorToJson } from "~/utils";


export type PlaybackState = {
  state: "STOPPED" | "PAUSED" | "PLAYING" | "LOADING",
  speechPosition?: SpeechPosition | null,
  playbackError?: unknown
};

export class Player {
  private activeDoc: Doc | null = null;
  private playbackError: unknown = null;

  openDoc(source: Source, onEnd: (err: unknown) => void) {
    this.activeDoc = new Doc(source, async err => {
      handleError(err);

      await this.closeDoc();

      if (typeof onEnd === "function") {
        onEnd(err);
      }
    });
  }

  async closeDoc() {
    console.log("close doc");
    if (this.activeDoc) {
      await this.activeDoc.close();

      this.activeDoc = null;

      console.log("closed doc");
    }
  }

  async playText(text: string | undefined, opts: { lang: string | undefined }) {
    // opts = opts || {};
    this.playbackError = null;

    if (!this.activeDoc) {
      this.openDoc(new SimpleSource((text ?? "").split(/(?:\r?\n){2,}/), { lang: opts.lang }), (err) => {
        if (err) {
          this.playbackError = err;
        }
      });
    }

    const doc = this.activeDoc;

    try {
      return await this.activeDoc?.play();
    } catch (err) {
      if (doc === this.activeDoc) {
        handleError(err);

        await this.closeDoc();
      }

      throw err;
    }
  }

  async playTab() {
    console.log("player play tab");
    this.playbackError = null;

    if (!this.activeDoc) {
      this.openDoc(new TabSource(), err => {
        if (err) {
          console.error("open doc", err);
          this.playbackError = err;
        }
      });
    }

    const doc = this.activeDoc;

    try {
      console.log("player play");
      return await this.activeDoc?.play();
    } catch (err) {
      console.error("player error", err);
      if (doc === this.activeDoc) {
        handleError(err);

        await this.closeDoc();
      }
      throw err;
    }
  }

  async stop() {
    if (this.activeDoc) {
      await this.activeDoc.stop();
      await this.closeDoc();
    }

    return true;
  }

  async pause() {
    if (this.activeDoc) {
      return this.activeDoc.pause();
    }
  }

  async resume() {
    if (this.activeDoc) {
      return this.activeDoc.play();
    }
  }

  async forward() {
    if (this.activeDoc) {
      return this.activeDoc.forward();
    }

    throw new Error("Can't forward, not active");
  }

  async rewind() {
    if (this.activeDoc) {
      return this.activeDoc.rewind();
    }

    throw new Error("Can't rewind, not active");
  }

  seek(n: number) {
    if (this.activeDoc) {
      return this.activeDoc.seek(n);
    }

    throw new Error("Can't seek, not active");
  }

  async getPlaybackState(): Promise<PlaybackState> {
    if (this.activeDoc) {
      const [state, speech] = await Promise.all([
        this.activeDoc.getState(),
        this.activeDoc.getActiveSpeech()
      ]);

      return {
        state,
        speechPosition: speech?.getPosition() ?? null,
        playbackError: errorToJson(this.playbackError),
      };
    }

    return {
      state: "STOPPED",
      playbackError: errorToJson(this.playbackError),
    };
  }
}

function handleError(err: unknown) {
  if (err instanceof Error) {
    // const code = err.message.startsWith("{") ? JSON.parse(err.message).code : err.message;
    //
    // if (code === "error_payment_required") {
    //   void clearSettings(["voiceName"]);
    // }
  }
}
