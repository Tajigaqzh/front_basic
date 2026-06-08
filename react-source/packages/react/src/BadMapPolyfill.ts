export let hasBadMapPolyfill = false;

try {
  const frozenObject = Object.freeze({});
  new Map([[frozenObject, null]]);
  new Set([frozenObject]);
} catch {
  hasBadMapPolyfill = true;
}
