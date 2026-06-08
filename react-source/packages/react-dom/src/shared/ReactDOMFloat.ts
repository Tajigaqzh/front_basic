import ReactDOMSharedInternals from "shared/ReactDOMSharedInternals.js";
import {
  getCrossOriginString,
  getCrossOriginStringAs,
} from "react-dom-bindings/src/shared/crossOriginStrings.js";
import {
  getValueDescriptorExpectingEnumForWarning,
  getValueDescriptorExpectingObjectForWarning,
} from "react-dom-bindings/src/shared/ReactDOMResourceValidation.js";

export interface PreconnectOptions {
  crossOrigin?: unknown;
}

export interface PreloadOptions {
  as: string;
  crossOrigin?: unknown;
  integrity?: unknown;
  nonce?: unknown;
  type?: unknown;
  fetchPriority?: unknown;
  referrerPolicy?: unknown;
  imageSrcSet?: unknown;
  imageSizes?: unknown;
  media?: unknown;
}

export interface PreloadModuleOptions {
  as?: string;
  crossOrigin?: unknown;
  integrity?: unknown;
}

export interface PreinitOptions {
  as: "style" | "script" | string;
  crossOrigin?: unknown;
  integrity?: unknown;
  fetchPriority?: unknown;
  nonce?: unknown;
  precedence?: unknown;
}

export interface PreinitModuleOptions {
  as?: "script" | string;
  crossOrigin?: unknown;
  integrity?: unknown;
  nonce?: unknown;
}

function warnInvalid(message: string, value: unknown): void {
  console.error(message, getValueDescriptorExpectingObjectForWarning(value));
}

export function prefetchDNS(href: string): void {
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.prefetchDNS(): Expected `href` to be a non-empty string but encountered %s.", href);
    return;
  }
  ReactDOMSharedInternals.d.D(href);
}

export function preconnect(href: string, options?: PreconnectOptions | null): void {
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.preconnect(): Expected `href` to be a non-empty string but encountered %s.", href);
    return;
  }
  if (options != null && typeof options !== "object") {
    console.error(
      "ReactDOM.preconnect(): Expected `options` to be an object but encountered %s.",
      getValueDescriptorExpectingEnumForWarning(options),
    );
    return;
  }
  ReactDOMSharedInternals.d.C(href, options ? getCrossOriginString(options.crossOrigin) : undefined);
}

export function preload(href: string, options: PreloadOptions): void {
  if (
    typeof href !== "string" ||
    href === "" ||
    options == null ||
    typeof options !== "object" ||
    typeof options.as !== "string" ||
    options.as === ""
  ) {
    console.error("ReactDOM.preload(): Expected href and an options object with a valid `as` property.");
    return;
  }

  ReactDOMSharedInternals.d.L(href, options.as, {
    crossOrigin: getCrossOriginStringAs(options.as, options.crossOrigin),
    integrity: typeof options.integrity === "string" ? options.integrity : undefined,
    nonce: typeof options.nonce === "string" ? options.nonce : undefined,
    type: typeof options.type === "string" ? options.type : undefined,
    fetchPriority: typeof options.fetchPriority === "string" ? options.fetchPriority : undefined,
    referrerPolicy: typeof options.referrerPolicy === "string" ? options.referrerPolicy : undefined,
    imageSrcSet: typeof options.imageSrcSet === "string" ? options.imageSrcSet : undefined,
    imageSizes: typeof options.imageSizes === "string" ? options.imageSizes : undefined,
    media: typeof options.media === "string" ? options.media : undefined,
  });
}

export function preloadModule(href: string, options?: PreloadModuleOptions | null): void {
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.preloadModule(): Expected `href` to be a non-empty string but encountered %s.", href);
    return;
  }
  if (options != null) {
    ReactDOMSharedInternals.d.m(href, {
      as: typeof options.as === "string" && options.as !== "script" ? options.as : undefined,
      crossOrigin: getCrossOriginStringAs(options.as, options.crossOrigin),
      integrity: typeof options.integrity === "string" ? options.integrity : undefined,
    });
  } else {
    ReactDOMSharedInternals.d.m(href);
  }
}

export function preinit(href: string, options: PreinitOptions): void {
  if (typeof href !== "string" || href === "" || options == null || typeof options !== "object") {
    console.error("ReactDOM.preinit(): Expected href and an options object.");
    return;
  }

  const crossOrigin = getCrossOriginStringAs(options.as, options.crossOrigin);
  const integrity = typeof options.integrity === "string" ? options.integrity : undefined;
  const fetchPriority = typeof options.fetchPriority === "string" ? options.fetchPriority : undefined;

  if (options.as === "style") {
    ReactDOMSharedInternals.d.S(
      href,
      typeof options.precedence === "string" ? options.precedence : undefined,
      { crossOrigin, integrity, fetchPriority },
    );
  } else if (options.as === "script") {
    ReactDOMSharedInternals.d.X(href, {
      crossOrigin,
      integrity,
      fetchPriority,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined,
    });
  } else {
    console.error("ReactDOM.preinit(): Expected `as` to be \"style\" or \"script\".");
  }
}

export function preinitModule(href: string, options?: PreinitModuleOptions | null): void {
  if (typeof href !== "string" || href === "") {
    warnInvalid("ReactDOM.preinitModule(): Expected `href` to be a non-empty string but encountered %s.", href);
    return;
  }
  if (options == null) {
    ReactDOMSharedInternals.d.M(href);
    return;
  }
  if (options.as == null || options.as === "script") {
    ReactDOMSharedInternals.d.M(href, {
      crossOrigin: getCrossOriginStringAs(options.as, options.crossOrigin),
      integrity: typeof options.integrity === "string" ? options.integrity : undefined,
      nonce: typeof options.nonce === "string" ? options.nonce : undefined,
    });
  }
}
