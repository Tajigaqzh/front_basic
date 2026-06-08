export type CrossOriginString = "anonymous" | "use-credentials" | "";

export function getCrossOriginString(input: unknown): CrossOriginString | undefined {
  if (input === "use-credentials") {
    return "use-credentials";
  }

  if (input === "" || input === "anonymous" || input === true) {
    return "anonymous";
  }

  return undefined;
}

export function getCrossOriginStringAs(as: unknown, input?: unknown): CrossOriginString | undefined {
  if (as === "font") {
    return "";
  }
  return getCrossOriginString(input ?? as);
}
