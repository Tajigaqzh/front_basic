import ReactDOMSharedInternals from "shared/ReactDOMSharedInternals.js";
import { getCrossOriginString } from "./crossOriginStrings.js";

type HintCode = "D" | "C" | "L" | "m" | "X" | "S" | "M";
type HintModel =
  | string
  | readonly [string, string]
  | readonly [string, string, Record<string, unknown>]
  | readonly [string, Record<string, unknown>]
  | readonly [string, string | 0 | undefined, Record<string, unknown>?];

export function dispatchHint(code: HintCode, model: HintModel): void {
  const dispatcher = ReactDOMSharedInternals.d;

  switch (code) {
    case "D":
      dispatcher.D(model as string);
      return;
    case "C":
      if (typeof model === "string") {
        dispatcher.C(model);
      } else {
        dispatcher.C(model[0], model[1] as string);
      }
      return;
    case "L": {
      const refined = model as readonly [string, string, Record<string, unknown>?];
      if (refined.length === 3) {
        dispatcher.L(refined[0], refined[1], refined[2]);
      } else {
        dispatcher.L(refined[0], refined[1]);
      }
      return;
    }
    case "m":
      if (typeof model === "string") {
        dispatcher.m(model);
      } else {
        dispatcher.m(model[0], model[1] as Record<string, unknown>);
      }
      return;
    case "X":
      if (typeof model === "string") {
        dispatcher.X(model);
      } else {
        dispatcher.X(model[0], model[1] as Record<string, unknown>);
      }
      return;
    case "S":
      if (typeof model === "string") {
        dispatcher.S(model);
      } else {
        const precedence = model[1] === 0 ? undefined : (model[1] as string | undefined);
        dispatcher.S(model[0], precedence, model.length === 3 ? model[2] : undefined);
      }
      return;
    case "M":
      if (typeof model === "string") {
        dispatcher.M(model);
      } else {
        dispatcher.M(model[0], model[1] as Record<string, unknown>);
      }
  }
}

export function preinitModuleForSSR(
  href: string,
  nonce: string | null | undefined,
  crossOrigin: string | null | undefined,
): void {
  ReactDOMSharedInternals.d.M(href, {
    crossOrigin: getCrossOriginString(crossOrigin),
    nonce,
  });
}

export function preinitScriptForSSR(
  href: string,
  nonce: string | null | undefined,
  crossOrigin: string | null | undefined,
): void {
  ReactDOMSharedInternals.d.X(href, {
    crossOrigin: getCrossOriginString(crossOrigin),
    nonce,
  });
}
