import { REACT_MEMO_TYPE, type ElementType, type Props } from "shared";

export interface MemoComponent<P extends Props = Props> {
  $$typeof: typeof REACT_MEMO_TYPE;
  type: ElementType;
  compare: null | ((prevProps: P, nextProps: P) => boolean);
  displayName?: string;
}

export function memo<P extends Props = Props>(
  type: ElementType,
  compare: null | ((prevProps: P, nextProps: P) => boolean) = null,
): MemoComponent<P> {
  return {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare,
  };
}
