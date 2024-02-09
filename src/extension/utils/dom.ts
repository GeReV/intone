import assert from "./assert";

export function $<E extends Element = Element>(selectors: string, parentNode: ParentNode = document): E {
  const el = parentNode.querySelector<E>(selectors);

  assert(el, `No element for selector "${selectors}" found.`);

  return el;
}

export function $$<E extends Element = Element>(selectors: string, parentNode: ParentNode = document): NodeListOf<E> {
  const els = parentNode.querySelectorAll<E>(selectors);

  assert(els.length, `No elements for selector "${selectors}" found.`);

  return els;
}