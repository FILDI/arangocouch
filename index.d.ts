declare module 'arangocouch' {
  interface ConstructorOptions {
    port: number;
    auth?: string;
    pathname: string;
    protocol: string;
    hostname: string;
  }

  interface SubscriberConfig {
    collection: string;
    events?: string[];
    keys?: string[];
  }

  class ArangoCouch {
    constructor(config: string | ConstructorOptions);
    start: () => void;
    subscribe: (opts: string | SubscriberConfig) => void;
    unsubscribe: (opts: string | SubscriberConfig) => void;
    on: (event: string, cb: (...args: any) => void) => void;
  }

  export = ArangoCouch;
}
