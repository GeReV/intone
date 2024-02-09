import { lazy } from "~/utils/lazy";
import { StateMachine } from "~/utils/stateMachine";

export const getSingletonAudio = lazy(() => new Audio());
export const getSilenceTrack = lazy(() => makeSilenceTrack());

function makeSilenceTrack() {
  const audio = new Audio(/*browser.runtime.getURL("assets/silence.mp3")*/);
  audio.loop = true;

  let timer: ReturnType<typeof setTimeout>;
  const stateMachine = new StateMachine({
    IDLE: {
      start() {
        audio.play().catch(console.error);
        return "PLAYING";
      },
      stop() {
        /* empty */
      }
    },
    PLAYING: {
      start() {
        /* empty */
      },
      stop() {
        return "STOPPING";
      }
    },
    STOPPING: {
      onTransitionIn() {
        timer = setTimeout(() => {
          stateMachine.trigger("onStop");
        }, 15 * 1000);
      },
      onStop() {
        audio.pause();
        return "IDLE";
      },
      start() {
        clearTimeout(timer);
        return "PLAYING";
      },
      stop() {
        /* empty */
      }
    }
  });
  return {
    start() {
      stateMachine.trigger("start");
    },
    stop() {
      stateMachine.trigger("stop");
    }
  };
}