import { getSilenceTrack, getSingletonAudio } from "~/utils/audio";
import { AudioHelper, TtsOptions } from "~/player/ttsEngines";
import { lazy } from "~/utils/lazy";
import { promisifyAbortSignal } from "~/utils";

const requestAudioPlaybackPermission = lazy(async () => {
  try {
    await Promise.resolve();
    // const thisTab = await browser.tabs.getCurrent();
    // const prevTab = await browser.tabs.query({ windowId: thisTab.windowId, active: true }).then(tabs => tabs[0]);
    // await browser.tabs.update(thisTab.id, { active: true });

    // $$<HTMLElement>("#dialog-backdrop, #audio-playback-permission-dialog").forEach(el => {
    //   el.hidden = false;
    // });

    // await new Audio(/*browser.runtime.getURL("sound/silence.mp3")*/).play();

    // $$<HTMLElement>("#dialog-backdrop, #audio-playback-permission-dialog").forEach(el => {
    //   el.hidden = true;
    // });

    // await browser.tabs.update(prevTab?.id, { active: true });
  } catch (err) {
    console.error(err);
  }
});

export function playAudio(url: string, options: TtsOptions, startTime?: number) {
  // if (brapi.offscreen) {
  //   return playAudioOffscreen(urlPromise, options, startTime);
  // } else {
  return playAudioHere(requestAudioPlaybackPermission().then(() => url), options, startTime);
  // }
}


function playAudioHere(urlPromise: Promise<string>, options: TtsOptions, startTime?: number): AudioHelper {
  const audio = getSingletonAudio();
  audio.pause();
  // if (!isIOS()) {
  // audio.defaultPlaybackRate = (options.rate || 1) * (options.rateAdjust ?? 1);
  audio.volume = options.volume;
  // }
  const silenceTrack = getSilenceTrack();

  const timeoutPromise = promisifyAbortSignal(AbortSignal.timeout(10 * 1000));

  const abortController = new AbortController();
  const abortPromise = promisifyAbortSignal(abortController.signal);

  const readyPromise = Promise.resolve(urlPromise)
    .then(async url => {
      console.log(url);
      const canPlayPromise = new Promise<void>((fulfill, reject) => {
        audio.oncanplay = () => {
          fulfill();
        };
        audio.onerror = () => {
          reject(new Error(audio.error?.message ?? audio.error?.code.toString()));
        };
      });

      audio.src = url;

      await canPlayPromise;

      if (startTime) {
        const waitTime = startTime - Date.now();
        if (waitTime > 0) {
          await new Promise(resolve => {
            setTimeout(resolve, waitTime);
          });
        }
      }
    });

  const startPromise = Promise.race([readyPromise, abortPromise, timeoutPromise])
    .then(async () => {
      try {
        await audio.play();
      } catch (err) {
        if (err instanceof DOMException) {
          throw new Error(err.name || err.message);
        }

        throw err;
      }

      silenceTrack.start();
    });

  const endPromise = new Promise<void>((fulfill, reject) => {
    audio.onended = () => {
      fulfill();
    };
    audio.onerror = (_event, _source, _lineno, _colno, error) => {
      if (!error) {
        error = new Error(audio.error?.message ?? audio.error?.code.toString());
      }

      reject(error);
    };
  })
    .finally(() => {
      silenceTrack.stop();
    });

  return {
    startPromise,
    endPromise,
    pause() {
      abortController.abort(new Error("Aborted"));

      audio.pause();

      silenceTrack.stop();
    },
    async resume() {
      await audio.play();

      silenceTrack.start();

      return true;
    }
  };
}

