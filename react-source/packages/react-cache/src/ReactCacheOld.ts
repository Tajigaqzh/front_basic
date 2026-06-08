import { createContext } from "react";
import { ReactSharedInternals } from "shared";
import type { ReactContext } from "shared";
import { createLRU, type Entry } from "./LRU.js";

interface Suspender {
  then(resolve: () => unknown, reject: () => unknown): unknown;
}

type PendingResult = {
  status: 0;
  value: Suspender;
};

type ResolvedResult<V> = {
  status: 1;
  value: V;
};

type RejectedResult = {
  status: 2;
  value: unknown;
};

type Result<V> = PendingResult | ResolvedResult<V> | RejectedResult;

interface Resource<I, V> {
  read(input: I): V;
  preload(input: I): void;
}

const Pending = 0;
const Resolved = 1;
const Rejected = 2;

function readContext(Context: ReactContext<unknown>): unknown {
  const dispatcher = ReactSharedInternals.H;
  if (dispatcher === null) {
    throw new Error(
      "react-cache: read and preload may only be called from within a component's render. They are not supported in event handlers or lifecycle methods.",
    );
  }
  return dispatcher.readContext(Context);
}

function identityHashFn<I>(input: I): I {
  return input;
}

const CACHE_LIMIT = 500;
const lru = createLRU<Result<unknown>>(CACHE_LIMIT);
const entries: Map<Resource<unknown, unknown>, Map<unknown, Entry<Result<unknown>>>> = new Map();

const CacheContext = createContext<unknown>(null);

function accessResult<I, K, V>(
  resource: Resource<I, V>,
  fetch: (input: I) => Promise<V>,
  input: I,
  key: K,
): Result<V> {
  let entriesForResource = entries.get(resource as Resource<unknown, unknown>);
  if (entriesForResource === undefined) {
    entriesForResource = new Map();
    entries.set(resource as Resource<unknown, unknown>, entriesForResource);
  }

  const entry = entriesForResource.get(key);
  if (entry === undefined) {
    const thenable = fetch(input);
    const newResult: PendingResult = {
      status: Pending,
      value: thenable,
    };

    thenable.then(
      (value) => {
        if (newResult.status === Pending) {
          (newResult as unknown as ResolvedResult<V>).status = Resolved;
          (newResult as unknown as ResolvedResult<V>).value = value;
        }
      },
      (error) => {
        if (newResult.status === Pending) {
          (newResult as unknown as RejectedResult).status = Rejected;
          (newResult as unknown as RejectedResult).value = error;
        }
      },
    );

    const newEntry = lru.add(
      newResult as Result<unknown>,
      deleteEntry.bind(null, resource as Resource<unknown, unknown>, key),
    );
    entriesForResource.set(key, newEntry);
    return newResult as Result<V>;
  }

  return lru.access(entry) as Result<V>;
}

function deleteEntry(resource: Resource<unknown, unknown>, key: unknown): void {
  const entriesForResource = entries.get(resource);
  if (entriesForResource !== undefined) {
    entriesForResource.delete(key);
    if (entriesForResource.size === 0) {
      entries.delete(resource);
    }
  }
}

export function unstable_createResource<I, K extends string | number | symbol | boolean | null | undefined, V>(
  fetch: (input: I) => Promise<V>,
  maybeHashInput?: (input: I) => K,
): Resource<I, V> {
  const hashInput = maybeHashInput !== undefined ? maybeHashInput : identityHashFn<I>;

  const resource: Resource<I, V> = {
    read(input: I): V {
      // react-cache 当前不依赖 context 值，但官方会读取它来限制只能在 render 期间访问。
      readContext(CacheContext);
      const key = hashInput(input);
      const result = accessResult(resource, fetch, input, key);
      switch (result.status) {
        case Pending:
          throw result.value;
        case Resolved:
          return result.value;
        case Rejected:
          throw result.value;
      }
    },

    preload(input: I): void {
      readContext(CacheContext);
      const key = hashInput(input);
      accessResult(resource, fetch, input, key);
    },
  };

  return resource;
}

export function unstable_setGlobalCacheLimit(limit: number): void {
  lru.setLimit(limit);
}
