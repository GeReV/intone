import assert from "~/utils/assert";

export type State = {
  readonly onTransitionIn?: () => void;
} & Readonly<Record<string, string | ((...args: unknown[]) => unknown)>>;

export type States = {
  readonly IDLE: State;
  readonly [key: string]: State;
};

export class StateMachine<const S extends States> {
  private currentStateName: keyof S = "IDLE";
  private lock = 0;

  constructor(private readonly states: S) {
    if (!Object.hasOwn(states, "IDLE")) {
      throw new Error("Missing IDLE state");
    }
  }

  trigger(eventName: string, ...args: unknown[]) {
    if (this.lock) {
      throw new Error("Cannot trigger an event while inside an event handler");
    }

    this.lock++;

    try {
      const currentState = this.states[this.currentStateName];

      assert(currentState);

      const nextStateFn = currentState[eventName];

      if (nextStateFn) {
        const nextStateName = (typeof nextStateFn === "string") ? nextStateFn : nextStateFn(...args);

        if (nextStateName) {
          if (typeof nextStateName === "string") {
            if (this.states[nextStateName]) {
              this.currentStateName = nextStateName;

              const nextState = this.states[this.currentStateName];
              if (nextState?.onTransitionIn) {
                nextState.onTransitionIn();
              }
            } else {
              throw new Error(`Unknown next-state ${nextStateName}`);
            }
          } else {
            throw new Error("Event handler must return next-state's name or null to stay in same state");
          }
        }
      } else {
        throw new Error(`No handler '${eventName}' in state ${String(this.currentStateName)}`);
      }
    } finally {
      this.lock--;
    }
  }

  getState() {
    return this.currentStateName;
  }
}