import type { ProtocolWithReturn } from "webext-bridge";
import { DocumentInfo } from "~/player/sources";

import { PlaybackState } from "~/player/player";
import { TtsOptions } from "~/player/ttsEngines";

declare module "webext-bridge" {
  export interface ProtocolMap {
    // define message protocol types
    // see https://github.com/antfu/webext-bridge#type-safe-protocols

    "log": {
      log: string
    },

    "play-text": {
      text: string | undefined,
      opts: {
        lang: string | undefined
      },
    },
    "play-tab": { tabId?: number },
    "reload-and-play-tab": { tabId?: number },
    "prefetch": {
      prefetchText: string,
      options: Exclude<TtsOptions, "voice">,
    },
    "speak": {
      text: string,
      options: Exclude<TtsOptions, "voice">,
    }
    "resume": null,
    "pause": null,
    "stop": ProtocolWithReturn<null, boolean>,
    "forward": null,
    "rewind": null,
    "seek": { n: number },
    "player-check-in": null,
    "get-playback-state": ProtocolWithReturn<null, PlaybackState>,
    "get-required-js": ProtocolWithReturn<null, string[]>,
    "get-texts": ProtocolWithReturn<{ index: number, quietly: boolean }, string[]>,
    "get-document-info": ProtocolWithReturn<null, DocumentInfo>,
    "get-current-index": ProtocolWithReturn<null, { index: number }>,
  }
}
