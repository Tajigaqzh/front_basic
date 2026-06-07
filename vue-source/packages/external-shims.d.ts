declare module 'csstype' {
  export interface Properties<TLength = string | number, TTime = string & {}> {
    [key: string]: unknown
  }

  export interface PropertiesHyphen<
    TLength = string | number,
    TTime = string & {},
  > {
    [key: string]: unknown
  }
}

declare module 'trusted-types/lib' {
  export interface TrustedHTML {}

  export interface TrustedTypePolicy {
    name: string
    createHTML(value: string): TrustedHTML
  }

  export interface TrustedTypesWindow {
    trustedTypes?: {
      createPolicy(
        name: string,
        rules: { createHTML(value: string): string },
      ): TrustedTypePolicy
    }
  }
}

declare module 'node:stream' {
  export class Readable {
    constructor(options?: { read?(): void })
    push(chunk: string | null): void
    destroy(err?: any): void
    pipe<T>(destination: T): T
    on(event: string, listener: (...args: any[]) => void): this
  }

  export class Writable {
    write(chunk: string): void
    end(): void
    on(event: string, listener: (...args: any[]) => void): this
    destroy(err?: any): void
  }
}

declare var require: (id: string) => any
