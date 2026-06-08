import { REACT_FORWARD_REF_TYPE, type Props, type ReactNode } from "shared";

export interface ForwardRefComponent<P extends Props = Props> {
  $$typeof: typeof REACT_FORWARD_REF_TYPE;
  render: (props: P, ref: unknown) => ReactNode;
  displayName?: string;
}

export function forwardRef<P extends Props = Props>(
  render: (props: P, ref: unknown) => ReactNode,
): ForwardRefComponent<P> {
  return {
    $$typeof: REACT_FORWARD_REF_TYPE,
    render,
  };
}
