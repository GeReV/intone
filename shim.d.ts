import type { ProtocolWithReturn } from "webext-bridge";

import { PlaybackState } from "~/player/player";
import { TtsOptions } from "~/player/ttsEngines";

declare module "webext-bridge" {
  export interface ProtocolMap {
    // define message protocol types
    // see https://github.com/antfu/webext-bridge#type-safe-protocols

    "play-text": {
      text: string | undefined,
      opts: {
        lang: string | undefined
      },
    },
    "play-tab": { tabId?: number },
    "reload-and-play-tab": { tabId?: number },
    "resume": null,
    "pause": null,
    "stop": ProtocolWithReturn<null, boolean>,
    "forward": null,
    "rewind": null,
    "seek": { n: number },
    "get-playback-state": ProtocolWithReturn<null, PlaybackState>,

    "get-required-js": ProtocolWithReturn<null, string[]>,

    "is-speaking": ProtocolWithReturn<null, boolean>,
    "prefetch": {
      prefetchText: string,
      options: Omit<TtsOptions, "voice">,
    },
    "speak": {
      text: string,
      options: Omit<TtsOptions, "voice">,
    }
    "set-next-start-time": number,
  }
}
