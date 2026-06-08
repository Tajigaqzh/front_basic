import { REACT_CONTEXT_TYPE, REACT_PROVIDER_TYPE, REACT_CONSUMER_TYPE } from "shared";
import type { ReactContext } from "shared";

export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    _currentValue2: defaultValue,
    _currentRenderer: null,
    _currentRenderer2: null,
  } as ReactContext<T>;

  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  context.Consumer = {
    $$typeof: REACT_CONSUMER_TYPE,
    _context: context,
  };

  return context;
}
