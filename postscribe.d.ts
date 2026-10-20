// Type definitions for postscribe 3.x (https://github.com/epom/postscribe).

declare namespace postscribe {
  /** A token of the HTML tokenizer, as beforeWriteToken sees it. */
  interface Token {
    type: 'startTag' | 'endTag' | 'atomicTag' | 'chars' | 'comment';
    tagName?: string;
    attrs?: Record<string, string>;
    booleanAttrs?: Record<string, boolean>;
    unary?: boolean;
    /** Inner text of an atomic tag (script, style, textarea...). */
    content?: string;
    /** Raw text of a chars or comment token. */
    text?: string;
    toString(): string;
  }

  interface Options {
    /** Called when everything has been written, including what the snippet's scripts wrote. */
    done?: () => void;
    /** Called when a script fails to load or throws; the stream goes on. Default: throws `error.msg`. */
    error?: (error: {msg: string}) => void;
    /** The page's Content-Security-Policy nonce, put on every script and style postscribe creates. */
    nonce?: string | null;
    /** Let scripts with an async attribute leave the queue without waiting for them. Default false. */
    releaseAsync?: boolean;
    /** Let the tokenizer close unclosed tags, as the browser would. Default true. */
    autoFix?: boolean;
    /** Called before each chunk a script writes with document.write; may return changed HTML. */
    beforeWrite?: (html: string) => string;
    /** Called after each chunk a script writes with document.write. */
    afterWrite?: (html: string) => void;
    /** Called before each token is written; return it, changed or not, or nothing to drop it. */
    beforeWriteToken?: (token: Token) => Token | null | undefined | void;
    /** Called when an async script has loaded. */
    afterAsync?: () => void;
    /** Called just before the stream joins the queue. */
    beforeEnqueue?: (args: unknown[]) => void;
    /** Called just before the stream leaves the queue to run. */
    afterDequeue?: () => void;
    /** Called right after the stream has started. */
    afterStreamStart?: () => void;
    /** A name for the stream in postscribe.streams. */
    name?: string;
  }

  interface Stream {
    /** Stop the stream, running or still queued: nothing more is written, none of its callbacks fire. */
    cancel(): void;
  }

  /** What to write: an HTML string, or a function that writes to the document it is given. */
  type Html = string | ((doc: Document) => void);

  /** Where to write: an element, a jQuery-like object, or an id selector such as '#ad'. */
  type Target = Element | {jquery: string; [index: number]: Element} | string;
}

/** Writes `html` into `element`, running its scripts in order with document.write pointed into the stream. */
declare function postscribe(
  element: postscribe.Target,
  html: postscribe.Html,
  options?: postscribe.Options | (() => void)
): postscribe.Stream;

export = postscribe;
export as namespace postscribe;
