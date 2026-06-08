const VALID_ATTRIBUTE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_.:-]*$/;
const illegalAttributeNameCache = new Set<string>();
const validatedAttributeNameCache = new Set<string>();

export default function isAttributeNameSafe(attributeName: string): boolean {
  if (validatedAttributeNameCache.has(attributeName)) {
    return true;
  }

  if (illegalAttributeNameCache.has(attributeName)) {
    return false;
  }

  if (VALID_ATTRIBUTE_NAME_REGEX.test(attributeName)) {
    validatedAttributeNameCache.add(attributeName);
    return true;
  }

  illegalAttributeNameCache.add(attributeName);
  return false;
}
