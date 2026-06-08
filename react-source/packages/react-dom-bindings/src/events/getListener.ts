export default function getListener(
  props: Record<string, unknown>,
  registrationName: string,
): ((event: Event) => void) | null {
  const listener = props[registrationName];
  return typeof listener === "function" ? (listener as (event: Event) => void) : null;
}
