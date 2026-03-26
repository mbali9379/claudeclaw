/* Type declarations for modules without bundled types */

declare module 'better-sqlite3' {
  class Database {
    constructor(filename: string, options?: Database.Options);
    prepare(source: string): Database.Statement;
    exec(source: string): this;
    pragma(source: string, options?: { simple?: boolean }): any;
    close(): this;
    transaction<F extends (...args: any[]) => any>(fn: F): F;
    backup(destination: string, options?: any): Promise<any>;
    readonly open: boolean;
    readonly inTransaction: boolean;
    readonly name: string;
    readonly memory: boolean;
    readonly readonly: boolean;
  }

  namespace Database {
    interface Database {
      prepare(source: string): Statement;
      exec(source: string): this;
      pragma(source: string, options?: { simple?: boolean }): any;
      close(): this;
      transaction<F extends (...args: any[]) => any>(fn: F): F;
      backup(destination: string, options?: any): Promise<any>;
      readonly open: boolean;
      readonly inTransaction: boolean;
      readonly name: string;
      readonly memory: boolean;
      readonly readonly: boolean;
    }

    interface Options {
      readonly?: boolean;
      fileMustExist?: boolean;
      timeout?: number;
      verbose?: ((message?: any, ...additionalArgs: any[]) => void) | null;
      nativeBinding?: string;
    }

    interface Statement {
      run(...params: any[]): RunResult;
      get(...params: any[]): any;
      all(...params: any[]): any[];
      iterate(...params: any[]): IterableIterator<any>;
      pluck(toggleState?: boolean): this;
      expand(toggleState?: boolean): this;
      raw(toggleState?: boolean): this;
      columns(): any[];
      bind(...params: any[]): this;
      readonly source: string;
      readonly reader: boolean;
    }

    interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }
  }

  export = Database;
}

declare module 'js-yaml' {
  export function load(str: string, opts?: any): any;
  export function dump(obj: any, opts?: any): string;
}

declare module 'qrcode-terminal' {
  export function generate(text: string, opts?: any, cb?: (qr: string) => void): void;
  export function setErrorLevel(level: string): void;
}
