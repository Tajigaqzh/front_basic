type LinkStyleResourceProps = {
  href?: unknown;
  onLoad?: unknown;
  onError?: unknown;
  disabled?: unknown;
};

function propNamesListJoin(list: string[], combinator: "and" | "or"): string {
  switch (list.length) {
    case 0:
      return "";
    case 1:
      return list[0];
    case 2:
      return `${list[0]} ${combinator} ${list[1]}`;
    default:
      return `${list.slice(0, -1).join(", ")}, ${combinator} ${list[list.length - 1]}`;
  }
}

export function validateLinkPropsForStyleResource(props: LinkStyleResourceProps): boolean {
  const { href, onLoad, onError, disabled } = props;
  const includedProps: string[] = [];
  if (onLoad) includedProps.push("`onLoad`");
  if (onError) includedProps.push("`onError`");
  if (disabled != null) includedProps.push("`disabled`");

  if (includedProps.length === 0) {
    return false;
  }

  let includedPropsPhrase = propNamesListJoin(includedProps, "and");
  includedPropsPhrase += includedProps.length === 1 ? " prop" : " props";
  const withArticlePhrase =
    includedProps.length === 1 ? `an ${includedPropsPhrase}` : `the ${includedPropsPhrase}`;

  console.error(
    "React encountered a <link rel=\"stylesheet\" href=\"%s\" ... /> with a `precedence` prop that also included %s. React will not hoist or deduplicate this stylesheet. Remove %s or remove `precedence`.",
    href,
    withArticlePhrase,
    includedPropsPhrase,
  );
  return true;
}

export function getValueDescriptorExpectingObjectForWarning(thing: unknown): string {
  return thing === null
    ? "`null`"
    : thing === undefined
      ? "`undefined`"
      : thing === ""
        ? "an empty string"
        : `something with type "${typeof thing}"`;
}

export function getValueDescriptorExpectingEnumForWarning(thing: unknown): string {
  return thing === null
    ? "`null`"
    : thing === undefined
      ? "`undefined`"
      : thing === ""
        ? "an empty string"
        : typeof thing === "string"
          ? JSON.stringify(thing)
          : `something with type "${typeof thing}"`;
}
