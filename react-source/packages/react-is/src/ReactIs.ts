import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared";

export function typeOf(object: unknown): symbol | undefined {
  if (
    typeof object === "object" &&
    object !== null &&
    (object as { $$typeof?: symbol }).$$typeof === REACT_ELEMENT_TYPE
  ) {
    return (object as { type?: symbol }).type;
  }

  return undefined;
}

export function isElement(object: unknown): boolean {
  return (
    typeof object === "object" &&
    object !== null &&
    (object as { $$typeof?: symbol }).$$typeof === REACT_ELEMENT_TYPE
  );
}

export function isFragment(object: unknown): boolean {
  return typeOf(object) === REACT_FRAGMENT_TYPE;
}

export { REACT_ELEMENT_TYPE as Element, REACT_FRAGMENT_TYPE as Fragment };
