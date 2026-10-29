/**
 * @file postscribe
 * @description Asynchronously write javascript, even with document.write.
 * @version v3.1.1
 * @see {@link https://github.com/epom/postscribe}
 * @license MIT
 * @author Epom (https://epom.com), maintained by Anton Ruin
 * @copyright 2026 Epom; based on postscribe (c) 2016 Krux Digital, Inc. (Derek Brans and contributors)
 */
/**
 * Escape quotes in the given value.
 *
 * @param {string} value The value to escape.
 * @param {string} [defaultValue=''] The default value to return if value is falsy.
 * @returns {string}
 */
function escapeQuotes(value, defaultValue = '') {
  // There's no lookback in JS, so /(^|[^\\])"/ only matches the first of two `"`s.
  // Instead, just match anything before a double-quote and escape if it's not already escaped.
  return !value ? defaultValue : value.replace(/([^"]*)"/g, (_, prefix) => {
    return (/\\/).test(prefix) ? `${prefix}"` : `${prefix}\\\"`;
  });
}

/**
 * Epom fork: an attribute value, quoted for re-parsing. A bare double quote can only have come from a single-quoted
 * value, so that one goes back in single quotes (or as &quot; when it holds a single quote too): escapeQuotes'
 * backslash is JavaScript, not HTML, and turned data-cfg='{"a":1}' into data-cfg="{\"a\":1}", which breaks the
 * tag. Anything else keeps the original double-quoted form, backslashes and all, so the browser reads it as it read
 * the source.
 *
 * @param {string} val The attribute value as written
 * @returns {string}
 */
function quoteAttr(val) {
  const value = String(val);
  if (!(/(^|[^\\])"/).test(value)) {
    return `"${escapeQuotes(value)}"`;
  }
  return value.indexOf("'") === -1 ? `'${value}'` : `"${value.replace(/"/g, '&quot;')}"`;
}

/**
 * CommentToken represents comment tags.
 */
class CommentToken {
  /**
   * Constructor.
   *
   * @param {string} content The content of the comment
   * @param {Number} length The length of the Token text.
   */
  constructor(content, length) {
    this.type = 'comment';
    this.length = length || (content ? content.length : 0);
    this.text = '';
    this.content = content;
  }

  toString() {
    return `<!--${this.content}`;
  }
}

/**
 * CharsToken represents non-tag characters.
 */
class CharsToken {
  /**
   * Constructor.
   *
   * @param {Number} length The length of the Token text.
   */
  constructor(length) {
    this.type = 'chars';
    this.length = length;
    this.text = '';
  }

  toString() {
    return this.text;
  }
}

/**
 * TagToken is a base class for all tag-based Tokens.
 */
class TagToken {
  /**
   * Constructor.
   *
   * @param {string} type The type of the token.
   * @param {string} tagName The tag name.
   * @param {Number} length The length of the Token text.
   * @param {Object} attrs The dictionary of attributes and values
   * @param {Object} booleanAttrs If an entry has 'true' then the attribute
   *                              is a boolean attribute
   */
  constructor(type, tagName, length, attrs, booleanAttrs) {
    this.type = type;
    this.length = length;
    this.text = '';
    this.tagName = tagName;
    this.attrs = attrs;
    this.booleanAttrs = booleanAttrs;
    this.unary = false;
    this.html5Unary = false;
  }

  /**
   * Formats the given token tag.
   *
   * @param {TagToken} tok The TagToken to format.
   * @param {?string} [content=null] The content of the token.
   * @returns {string} The formatted tag.
   */
  static formatTag(tok, content = null) {
    let str = `<${tok.tagName}`;
    for (let key in tok.attrs) {
      if (tok.attrs.hasOwnProperty(key)) {
        str += ` ${key}`;

        const val = tok.attrs[key];
        if (typeof tok.booleanAttrs === 'undefined' ||
            typeof tok.booleanAttrs[key] === 'undefined') {
          str += `=${quoteAttr(val)}`;
        }
      }
    }

    if (tok.rest) {
      str += ` ${tok.rest}`;
    }

    if (tok.unary && !tok.html5Unary) {
      str += '/>';
    } else {
      str += '>';
    }

    if (content !== undefined && content !== null) {
      str += `${content}</${tok.tagName}>`;
    }

    return str;
  }
}

/**
 * StartTagToken represents a start token.
 */
class StartTagToken {
  /**
   * Constructor.
   *
   * @param {string} tagName The tag name.
   * @param {Number} length The length of the Token text
   * @param {Object} attrs The dictionary of attributes and values
   * @param {Object} booleanAttrs If an entry has 'true' then the attribute
   *                              is a boolean attribute
   * @param {boolean} unary True if the tag is a unary tag
   * @param {string} rest The rest of the content.
   */
  constructor(tagName, length, attrs, booleanAttrs, unary, rest) {
    this.type = 'startTag';
    this.length = length;
    this.text = '';
    this.tagName = tagName;
    this.attrs = attrs;
    this.booleanAttrs = booleanAttrs;
    this.html5Unary = false;
    this.unary = unary;
    this.rest = rest;
  }

  toString() {
    return TagToken.formatTag(this);
  }
}

/**
 * AtomicTagToken represents an atomic tag.
 */
class AtomicTagToken {
  /**
   * Constructor.
   *
   * @param {string} tagName The name of the tag.
   * @param {Number} length The length of the tag text.
   * @param {Object} attrs The attributes.
   * @param {Object} booleanAttrs If an entry has 'true' then the attribute
   *                              is a boolean attribute
   * @param {string} content The content of the tag.
   */
  constructor(tagName, length, attrs, booleanAttrs, content) {
    this.type = 'atomicTag';
    this.length = length;
    this.text = '';
    this.tagName = tagName;
    this.attrs = attrs;
    this.booleanAttrs = booleanAttrs;
    this.unary = false;
    this.html5Unary = false;
    this.content = content;
  }

  toString() {
    return TagToken.formatTag(this, this.content);
  }
}

/**
 * EndTagToken represents an end tag.
 */
class EndTagToken {
  /**
   * Constructor.
   *
   * @param {string} tagName The name of the tag.
   * @param {Number} length The length of the tag text.
   */
  constructor(tagName, length) {
    this.type = 'endTag';
    this.length = length;
    this.text = '';
    this.tagName = tagName;
  }

  toString() {
    return `</${this.tagName}>`;
  }
}

/**
 * Regular Expressions for parsing tags and attributes
 *
 * @type {Object}
 */
const REGEXES = {
  // Epom fork: attribute names are anything but whitespace, quotes, '>', '/' and '=', as in HTML (xlink:href,
  // xmlns:xlink, @click, :class), not just [\w-].
  startTag: /^<([\-A-Za-z0-9_!:]+)((?:\s+[^\s"'>\/=]+(?:\s*=?\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
  endTag: /^<\/([\-A-Za-z0-9_:]+)[^>]*>/,
  attr: /(?:([^\s"'>\/=]+)\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))|(?:([^\s"'>\/=]+)(\s|$)+)/g,
  fillAttr: /^(checked|compact|declare|defer|disabled|ismap|multiple|nohref|noresize|noshade|nowrap|readonly|selected)$/i
};

/**
 * Reads a comment token
 *
 * @param {string} stream The input stream
 * @returns {CommentToken}
 */
function comment(stream) {
  const index = stream.indexOf('-->');
  if (index >= 0) {
    return new CommentToken(stream.substr(4, index - 1), index + 3);
  }
}

/**
 * Reads non-tag characters.
 *
 * @param {string} stream The input stream
 * @returns {CharsToken}
 */
function chars(stream) {
  const index = stream.indexOf('<');
  if (index === -1) {
    // Epom fork: text that ends in what may be the start of a character reference (&cop) waits for the rest of it,
    // which the next write may bring (y;), as the browser waits: written now, "&cop" would stay literal.
    const reference = stream.search(/&[#\w]*$/);
    if (reference === 0) {
      return undefined;
    }
    if (reference > 0) {
      return new CharsToken(reference);
    }
  }
  return new CharsToken(index >= 0 ? index : stream.length);
}

/**
 * Epom fork: index of the '>' that ends the tag at the start of the stream, or -1 while it is incomplete. A quote
 * opens a value only right after '=', as in HTML, and a '>' inside it does not count: when a write ends inside a
 * quoted value (title="a >), the tag waits for the next write instead of ending there.
 *
 * @param {string} stream The input stream
 * @returns {number}
 */
function tagEnd(stream) {
  let quote = null;
  for (let i = 1; i < stream.length; i++) {
    const c = stream.charAt(i);
    if (quote) {
      if (c === quote) {
        quote = null;
      }
    } else if ((c === '"' || c === "'") && (/=\s*$/).test(stream.slice(Math.max(0, i - 32), i))) {
      quote = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

/**
 * Reads start tag token.
 *
 * @param {string} stream The input stream
 * @returns {StartTagToken}
 */
function startTag(stream) {
  const endTagIndex = tagEnd(stream);
  if (endTagIndex !== -1) {
    const match = stream.slice(0, endTagIndex + 1).match(REGEXES.startTag);
    if (match) {
      const attrs = {};
      const booleanAttrs = {};
      let rest = match[2];

      match[2].replace(REGEXES.attr, function(match, name) {
        // Epom fork: of repeated attributes the browser keeps the first.
        if (Object.prototype.hasOwnProperty.call(attrs, arguments[5] || name)) {
          rest = rest.replace(match, '');
          return;
        }
        if (!(arguments[2] || arguments[3] || arguments[4] || arguments[5])) {
          attrs[name] = '';
        } else if (arguments[5]) {
          attrs[arguments[5]] = '';
          booleanAttrs[arguments[5]] = true;
        } else {
          attrs[name] = arguments[2] || arguments[3] || arguments[4] ||
            REGEXES.fillAttr.test(name) && name || '';
        }

        rest = rest.replace(match, '');
      });

      return new StartTagToken(match[1], match[0].length, attrs,
        booleanAttrs, !!match[3],
        rest.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ''));
    }
  }
}

/**
 * Reads atomic tag token.
 *
 * @param {string} stream The input stream
 * @returns {AtomicTagToken}
 */
function atomicTag(stream) {
  const start = startTag(stream);
  if (start) {
    const rest = stream.slice(start.length);
    // for optimization, we check first just for the end tag
    if (rest.match(new RegExp('<\/\\s*' + start.tagName + '\\s*>', 'i'))) {
      // capturing the content is inefficient, so we do it inside the if
      const match = rest.match(new RegExp('([\\s\\S]*?)<\/\\s*' + start.tagName + '\\s*>', 'i'));
      if (match) {
        return new AtomicTagToken(start.tagName,
          match[0].length + start.length,
          start.attrs, start.booleanAttrs, match[1]);
      }
    }
  }
}

/**
 * Reads an end tag token.
 *
 * @param {string} stream The input stream
 * @returns {EndTagToken}
 */
function endTag(stream) {
  const match = stream.match(REGEXES.endTag);
  if (match) {
    return new EndTagToken(match[1], match[0].length);
  }
}

var streamReaders = /*#__PURE__*/Object.freeze({
  __proto__: null,
  atomicTag: atomicTag,
  chars: chars,
  comment: comment,
  endTag: endTag,
  startTag: startTag
});

/**
 * Empty Elements - HTML 4.01, plus the HTML5 void elements (Epom fork: SOURCE, TRACK, WBR)
 *
 * @type {RegExp}
 */
const EMPTY = /^(AREA|BASE|BASEFONT|BR|COL|FRAME|HR|IMG|INPUT|ISINDEX|LINK|META|PARAM|EMBED|SOURCE|TRACK|WBR)$/i;

/**
 * Elements that you can intentionally leave open (and which close themselves)
 *
 * @type {RegExp}
 */
const CLOSESELF = /^(COLGROUP|DD|DT|LI|OPTIONS|P|TD|TFOOT|TH|THEAD|TR)$/i;

/**
 * Epom fork: HTML's formatting elements, which the browser reopens after an end tag closed them out of order.
 *
 * @type {RegExp}
 */
const FORMATTING = /^(A|B|BIG|CODE|EM|FONT|I|NOBR|S|SMALL|STRIKE|STRONG|TT|U)$/i;

/**
 * Corrects a token.
 *
 * @param {Token} tok The token to correct
 * @returns {Token} The corrected token
 */
function correct(tok) {
  if (tok && tok.type === 'startTag') {
    tok.unary = EMPTY.test(tok.tagName) || tok.unary;
    tok.html5Unary = !(/\/>$/).test(tok.text);
  }
  return tok;
}

/**
 * Peeks at the next token in the parser.
 *
 * @param {HtmlParser} parser The parser
 * @param {Function} readTokenImpl The underlying readToken implementation
 * @returns {Token} The next token
 */
function peekToken(parser, readTokenImpl) {
  const tmp = parser.stream;
  const tok = correct(readTokenImpl());
  parser.stream = tmp;
  return tok;
}

/**
 * Closes the last token.
 *
 * @param {HtmlParser} parser The parser
 * @param {Array<Token>} stack The stack
 */
function closeLast(parser, stack) {
  const tok = stack.pop();

  // prepend close tag to stream.
  parser.prepend(`</${tok.tagName}>`);
}

/**
 * Create a new token stack.
 *
 * @returns {Array<Token>}
 */
function newStack() {
  const stack = [];

  stack.last = function() {
    return this[this.length - 1];
  };

  stack.lastTagNameEq = function(tagName) {
    const last = this.last();
    return last && last.tagName &&
      last.tagName.toUpperCase() === tagName.toUpperCase();
  };

  stack.containsTagName = function(tagName) {
    for (let i = 0, tok; (tok = this[i]); i++) {
      if (tok.tagName.toUpperCase() === tagName.toUpperCase()) {
        return true;
      }
    }
    return false;
  };

  return stack;
}

/**
 * Return a readToken implementation that fixes input.
 *
 * @param {HtmlParser} parser The parser
 * @param {{tagSoupFix: (boolean|undefined), selfCloseFix: (boolean|undefined)}} options Options for fixing:
 *   tagSoupFix, true to fix tag soup scenarios; selfCloseFix, true to fix self-closing tags
 * @param {Function} readTokenImpl The underlying readToken implementation
 * @returns {Function}
 */
function fixedReadTokenFactory(parser, options, readTokenImpl) {
  const stack = newStack();

  const handlers = {
    startTag(tok) {
      const tagName = tok.tagName;

      if (tagName.toUpperCase() === 'TR' && stack.lastTagNameEq('TABLE')) {
        parser.prepend('<TBODY>');
        prepareNextToken();
      } else if (CLOSESELF.test(tagName) &&
          stack.containsTagName(tagName)) {
        if (stack.lastTagNameEq(tagName)) {
          closeLast(parser, stack);
        } else {
          parser.prepend(`</${tok.tagName}>`);
          prepareNextToken();
        }
      } else if (!tok.unary) {
        stack.push(tok);
      }
    },

    endTag(tok) {
      // Epom fork: an empty element has no end tag. The browser drops a stray one (and reads </br> as <br>); taking
      // it for a mismatched end tag closed the enclosing element instead.
      if (EMPTY.test(tok.tagName)) {
        readTokenImpl();
        if ((/^br$/i).test(tok.tagName)) {
          parser.prepend('<br>');
        }
        prepareNextToken();
        return;
      }

      const last = stack.last();
      if (last && options.tagSoupFix && !stack.lastTagNameEq(tok.tagName)) {
        // Epom fork: as the browser does. An end tag of nothing open is dropped (</p> makes an empty <p>), not taken
        // to close whatever is open. One that skips open elements closes them; when it is itself a formatting end tag
        // (<b><i>x</b>y), the formatting elements it skipped are opened again after it, so the text that follows keeps
        // them, as the browser's adoption agency does.
        readTokenImpl();
        if (!stack.containsTagName(tok.tagName)) {
          if ((/^p$/i).test(tok.tagName)) {
            parser.prepend('<p></p>');
          }
        } else {
          let closes = '';
          let reopens = '';
          for (let i = stack.length - 1; !stack[i].tagName.match(new RegExp(`^${tok.tagName}$`, 'i')); i--) {
            closes += `</${stack[i].tagName}>`;
            if (FORMATTING.test(tok.tagName) && FORMATTING.test(stack[i].tagName)) {
              reopens = stack[i].toString() + reopens;
            }
          }
          parser.prepend(`${closes}</${tok.tagName}>${reopens}`);
        }
        prepareNextToken();
      } else if (last) {
        stack.pop();
      } else {
        // cleanup tag soup part 2: skip this token (Epom fork: a stray </p> makes an empty <p>, as in the browser)
        readTokenImpl();
        if ((/^p$/i).test(tok.tagName)) {
          parser.prepend('<p></p>');
        }
        prepareNextToken();
      }
    }
  };

  function prepareNextToken() {
    const tok = peekToken(parser, readTokenImpl);
    if (tok && handlers[tok.type]) {
      handlers[tok.type](tok);
    }
  }

  return function fixedReadToken() {
    prepareNextToken();
    return correct(readTokenImpl());
  };
}

/**
 * Detection regular expressions.
 *
 * Order of detection matters: detection of one can only
 * succeed if detection of previous didn't

 * @type {Object}
 */
const detect = {
  comment: /^<!--/,
  endTag: /^<\//,
  // Epom fork: xmp, noembed, noframes and title hold raw text too, as in the browser
  atomicTag: /^<\s*(script|style|noscript|iframe|textarea|xmp|noembed|noframes|title)[\s\/>]/i,
  startTag: /^</,
  chars: /^[^<]/
};

/**
 * HtmlParser provides the capability to parse HTML and return tokens
 * representing the tags and content.
 */
class HtmlParser {
  /**
   * Constructor.
   *
   * @param {string} stream The initial parse stream contents.
   * @param {{autoFix: (boolean|undefined)}=} options The options: autoFix, set to true to automatically fix errors
   */
  constructor(stream = '', options = {}) {
    this.stream = stream;

    // Epom fork: autoFix turns both fixes on. They used to be gated on feature tests of 2010s browsers (supports.js),
    // which every current browser passes the same way, so the tests are gone.
    if (options.autoFix) {
      const fixedTokenOptions = {tagSoupFix: true};
      this._readToken = fixedReadTokenFactory(this, fixedTokenOptions, () => this._readTokenImpl());
      this._peekToken = fixedReadTokenFactory(this, fixedTokenOptions, () => this._peekTokenImpl());
    } else {
      this._readToken = this._readTokenImpl;
      this._peekToken = this._peekTokenImpl;
    }
  }

  /**
   * Appends the given string to the parse stream.
   *
   * @param {string} str The string to append
   */
  append(str) {
    this.stream += str;
  }

  /**
   * Prepends the given string to the parse stream.
   *
   * @param {string} str The string to prepend
   */
  prepend(str) {
    this.stream = str + this.stream;
  }

  /**
   * The implementation of the token reading.
   *
   * @private
   * @returns {?Token}
   */
  _readTokenImpl() {
    const token = this._peekTokenImpl();
    if (token) {
      this.stream = this.stream.slice(token.length);
      return token;
    }
  }

  /**
   * The implementation of token peeking.
   *
   * @returns {?Token}
   */
  _peekTokenImpl() {
    for (let type in detect) {
      if (detect.hasOwnProperty(type)) {
        if (detect[type].test(this.stream)) {
          const token = streamReaders[type](this.stream);

          // Epom fork: a comment whose --> has not been written yet waits for it; falling through read "<!--" as a
          // start tag and its content as markup.
          if (!token && type === 'comment') {
            return null;
          }

          if (token) {
            // Epom fork: not only script and style: a textarea, noscript or iframe whose end tag has not been
            // written yet waits for it too, or its content was parsed as markup.
            if (token.type === 'startTag' &&
                (/^(script|style|noscript|iframe|textarea|xmp|noembed|noframes|title)$/i).test(token.tagName)) {
              return null;
            } else {
              token.text = this.stream.substr(0, token.length);
              return token;
            }
          }
        }
      }
    }
  }

  /**
   * The public token peeking interface.  Delegates to the basic token peeking
   * or a version that performs fixups depending on the `autoFix` setting in
   * options.
   *
   * @returns {object}
   */
  peekToken() {
    return this._peekToken();
  }

  /**
   * The public token reading interface.  Delegates to the basic token reading
   * or a version that performs fixups depending on the `autoFix` setting in
   * options.
   *
   * @returns {object}
   */
  readToken() {
    return this._readToken();
  }

  /**
   * Read tokens and hand to the given handlers.
   *
   * @param {Object} handlers The handlers to use for the different tokens.
   */
  readTokens(handlers) {
    let tok;
    while ((tok = this.readToken())) {
      // continue until we get an explicit "false" return
      if (handlers[tok.type] && handlers[tok.type](tok) === false) {
        return;
      }
    }
  }

  /**
   * Clears the parse stream.
   *
   * @returns {string} The contents of the parse stream before clearing.
   */
  clear() {
    const rest = this.stream;
    this.stream = '';
    return rest;
  }

  /**
   * Returns the rest of the parse stream.
   *
   * @returns {string} The contents of the parse stream.
   */
  rest() {
    return this.stream;
  }
}

HtmlParser.tokenToString = tok => tok.toString();

HtmlParser.escapeAttributes = attrs => {
  const escapedAttrs = {};

  for (let name in attrs) {
    if (attrs.hasOwnProperty(name)) {
      escapedAttrs[name] = escapeQuotes(attrs[name], null);
    }
  }

  return escapedAttrs;
};

/**
 * Determine if the thing is not undefined and not null.
 *
 * @param {*} thing The thing to test
 * @returns {boolean} True if the thing is not undefined and not null.
 */
function existy(thing) {
  return thing !== void 0 && thing !== null;
}

/**
 * Is this a function?
 *
 * @param {*} x The variable to test
 * @returns {boolean} True if the variable is a function
 */
function isFunction(x) {
  return 'function' === typeof x;
}

/**
 * Loop over each key/value pair in a hash.
 *
 * @param {Object} obj The object
 * @param {Function} fn The function to call
 * @param {?Object} target The object to bind to the function
 */
function eachKey(obj, fn, target) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      fn.call(target, key, obj[key]);
    }
  }
}

/**
 * Set default options where some option was not specified.
 *
 * @param {Object} options The destination
 * @param {Object} _defaults The defaults
 * @returns {Object}
 */
function defaults(options, _defaults) {
  options = options || {};
  eachKey(_defaults, function(key, val) {
    if (!existy(options[key])) {
      options[key] = val;
    }
  });
  return options;
}

/**
 * Get the last item in an array
 *
 * @param {Array<*>} array The array
 * @returns {*} The last item in the array
 */
function last(array) {
  return array[array.length - 1];
}

/**
 * Test if token is a script tag.
 *
 * @param {Object} tok The token
 * @param {String} tag The tag name
 * @returns {boolean} True if the token is a script tag
 */
function isTag(tok, tag) {
  return !tok ||
    !(tok.type === 'startTag' || tok.type === 'atomicTag') ||
    !('tagName' in tok) ? false : tok.tagName.toLowerCase() === tag;
}

/**
 * Test if token is a script tag.
 *
 * @param {Object} tok The token
 * @returns {boolean} True if the token is a script tag
 */
function isScript(tok) {
  return isTag(tok, 'script');
}

/**
 * Test if token is a style tag.
 *
 * @param {Object} tok The token
 * @returns {boolean} True if the token is a style tag
 */
function isStyle(tok) {
  return isTag(tok, 'style');
}

/**
 * Prefix for data attributes on DOM elements.
 * @type {string}
 */
const BASEATTR = 'data-ps-';

/**
 * ID for the style proxy
 * @type {string}
 */
const PROXY_STYLE = 'ps-style';

/**
 * ID for the script proxy
 * @type {string}
 */
const PROXY_SCRIPT = 'ps-script';

/**
 * Get data attributes
 *
 * @param {Object} el The DOM element.
 * @param {String} name The attribute name.
 * @returns {String}
 */
function getData(el, name) {
  return el.getAttribute(BASEATTR + name);
}

/**
 * Set data attributes
 *
 * @param {Object} el The DOM element.
 * @param {String} name The attribute name.
 * @param {null|*} value The attribute value.
 */
function setData(el, name, value = null) {
  const attr = BASEATTR + name;

  if (existy(value) && value !== '') {
    el.setAttribute(attr, value);
  } else {
    el.removeAttribute(attr);
  }
}

// Epom fork: the script types a browser runs: HTML's "JavaScript MIME type essence match" (the whole trimmed
// value, case-insensitive; a value with parameters such as "; charset=utf-8" does not run), plus module.
const JS_TYPE = /^(?:module|(?:application|text)\/(?:x-)?(?:ecmascript|javascript)|text\/javascript1\.[0-5]|text\/(?:jscript|livescript))$/i;

function isJavaScript(tok) {
  const type = tok.attrs.type || tok.attrs.TYPE;
  return !type || !type.trim() || JS_TYPE.test(type.trim());
}

// Epom fork: a copy of a tag token with one more attribute.
function withAttr(tok, name, value) {
  const copy = Object.create(tok);
  copy.attrs = Object.assign({}, tok.attrs, {[name]: String(value)});
  return copy;
}

// Epom fork: <template> start/end tag tokens.
function isTemplateStart(tok) {
  return tok.type === 'startTag' && !tok.unary && (/^template$/i).test(tok.tagName);
}

function isTemplateEnd(tok) {
  return tok.type === 'endTag' && (/^template$/i).test(tok.tagName);
}

/**
 * Stream static html to an element, where "static html" denotes "html
 * without scripts".
 *
 * This class maintains a *history of writes devoid of any attributes* or
 * "proxy history".
 *
 * Injecting the proxy history into a temporary div has no side-effects,
 * other than to create proxy elements for previously written elements.
 *
 * Given the `staticHtml` of a new write, a `tempDiv`'s innerHTML is set to
 * `proxy_history + staticHtml`.
 * The *structure* of `tempDiv`'s contents, (i.e., the placement of new nodes
 * beside or inside of proxy elements), reflects the DOM structure that would
 * have resulted if all writes had been squashed into a single write.
 *
 * For each descendent `node` of `tempDiv` whose parentNode is a *proxy*,
 * `node` is appended to the corresponding *real* element within the DOM.
 *
 * Proxy elements are mapped to *actual* elements in the DOM by injecting a
 * `data-id` attribute into each start tag in `staticHtml`.
 *
 */
class WriteStream {
  /**
   * Constructor.
   *
   * @param {Object} root The root element
   * @param {?Object} options The options
   */
  constructor(root, options = {}) {
    this.root = root;
    this.options = options;
    this.doc = root.ownerDocument;
    this.win = this.doc.defaultView;
    this.parser = new HtmlParser('', {autoFix: options.autoFix});

    // Actual elements by id.
    this.actuals = [root];

    // Embodies the "structure" of what's been written so far,
    // devoid of attributes.
    this.proxyHistory = '';

    // Create a proxy of the root element.
    this.proxyRoot = this.doc.createElement(root.nodeName);

    this.scriptStack = [];
    this.writeQueue = [];

    // Epom fork: a <template> left unterminated by one write, completed by a later one.
    this.pendingTemplate = null;

    setData(this.proxyRoot, 'proxyof', 0);
  }

  /**
   * Writes the given strings.
   *
   * @param {...String} str The strings to write
   */
  write(...str) {
    // Epom fork: a cancelled stream writes nothing more, whatever its scripts still try to write.
    if (this.aborted) {
      return;
    }

    this.writeQueue.push(...str);

    // Process writes
    // When new script gets pushed or pending this will stop
    // because new writeQueue gets pushed
    while (!this.deferredRemote && this.writeQueue.length) {
      const arg = this.writeQueue.shift();

      if (isFunction(arg)) {
        // Epom fork: the stream ends with a function, so a template still open by now never gets closed, and
        // whatever the parser still holds (an unterminated textarea or iframe) is written as the browser would.
        this._flushPendingTemplate();
        this._flushParser();
        this._callFunction(arg);
      } else {
        this._writeImpl(arg);
      }
    }
  }

  /**
   * Epom fork: stop the stream (postscribe's cancel()). Nothing more is written, no callback of it fires, and the page
   * gets document.write back so the next stream can run. A script already in flight still runs; what it writes is
   * dropped.
   */
  abort() {
    if (this.aborted) {
      return;
    }
    this.aborted = true;
    this.writeQueue = [];
    this.scriptStack = [];
    this.deferredRemote = null;
    this.pendingTemplate = null;
    if (this.finish) {
      this.finish(true);
    }
  }

  /**
   * Calls the given function.
   *
   * @param {Function} fn The function to call
   * @private
   */
  _callFunction(fn) {
    const tok = {type: 'function', value: fn.name || fn.toString()};
    this._onScriptStart(tok);
    fn.call(this.win, this.doc);
    this._onScriptDone(tok);
  }

  /**
   * The write implementation
   *
   * @param {String} html The HTML to write.
   * @private
   */
  _writeImpl(html) {
    this.parser.append(this._normalizeNewlines(html));

    let tok;
    let script;
    let style;
    const tokens = [];

    // Epom fork: a template an earlier write left open goes on from where it stopped.
    if (this.pendingTemplate) {
      const template = this._readTemplate();
      if (!template) {
        return;
      }
      tokens.push(template);
    }

    // stop if we see a script token
    while ((tok = this._readToken())) {
      // Epom fork: a template's content is inert, so take it whole instead of running the scripts in it.
      if (isTemplateStart(tok)) {
        this.pendingTemplate = {start: tok, inner: [], depth: 1};
        const template = this._readTemplate();
        if (!template) {
          break;
        }
        tokens.push(template);
        continue;
      }

      if ((script = isScript(tok)) || (style = isStyle(tok))) {
        break;
      }

      tok = this.options.beforeWriteToken(tok);

      if (tok) {
        tokens.push(tok);
      }
    }

    if (tokens.length > 0) {
      this._writeStaticTokens(tokens);
    }

    if (script) {
      this._handleScriptToken(tok);
    }

    if (style) {
      this._handleStyleToken(tok);
    }
  }

  /**
   * Epom fork: CR LF and lone CR become LF before anything is parsed, as the browser preprocesses its input, also when
   * the CR and the LF arrive in different writes. Script and style text skipped that and kept the CRs; split writes
   * got an extra newline.
   *
   * @param {String} html A chunk of the stream
   * @returns {String}
   * @private
   */
  _normalizeNewlines(html) {
    let text = String(html);
    if (this.endsWithCR && text.charAt(0) === '\n') {
      text = text.slice(1);
    }
    this.endsWithCR = (/\r$/).test(text);
    return text.replace(/\r\n?/g, '\n');
  }

  /**
   * Epom fork: the parser's next token, skipping a <!DOCTYPE ...> or <?xml ...?> it has no token for (it would
   * stop there and drop the rest). A browser ignores both inside a document's body anyway.
   *
   * @returns {Object|undefined}
   * @private
   */
  _readToken() {
    const tok = this.parser.readToken();
    const stream = this.parser.stream;
    if (!tok && (/^<(?:![^-]|\?)/).test(stream)) {
      const end = stream.indexOf('>');
      if (end !== -1) {
        // A doctype is dropped; anything else the browser keeps as a comment: <?xml ?> as <!--?xml ?-->,
        // <![CDATA[x]]> as <!--[CDATA[x]]-->.
        const rest = stream.slice(end + 1);
        this.parser.stream = (/^<!doctype/i).test(stream) ? rest
          : `<!--${stream.slice(stream.charAt(1) === '?' ? 1 : 2, end)}-->${rest}`;
        return this._readToken();
      }
    }
    return tok;
  }

  /**
   * Epom fork: read the rest of the template in this.pendingTemplate, nested ones included, into a single inert token.
   * Returns null when the html ends inside it: what was read stays in this.pendingTemplate (and an incomplete token
   * in the parser) for the next write to go on from. Tokens are never read twice: the parser's auto-fix keeps a
   * stack of open tags, and reading them again doubled it.
   *
   * @returns {Object|null}
   * @private
   */
  _readTemplate() {
    const pending = this.pendingTemplate;
    let tok;

    while ((tok = this._readToken())) {
      if (isTemplateStart(tok)) {
        pending.depth++;
      } else if (isTemplateEnd(tok) && --pending.depth === 0) {
        this.pendingTemplate = null;
        return {type: 'template', start: pending.start, inner: pending.inner.join(''), end: tok.toString()};
      }
      pending.inner.push(tok.toString());
    }

    return null;
  }

  /**
   * Epom fork: write what the parser still holds at the end of the stream, as static html: an unterminated textarea,
   * iframe or noscript (which wait for their end tag) is still created, as in the browser. An unterminated script is
   * written too and, as in the browser, does not run.
   *
   * @private
   */
  _flushParser() {
    const rest = this.parser.clear();
    if (rest) {
      this._writeStaticTokens([{type: 'chars', text: rest, toString: () => rest}]);
    }
  }

  /**
   * Epom fork: write a template still open when the stream ends, as the browser would: closed at the end.
   *
   * @private
   */
  _flushPendingTemplate() {
    if (this.pendingTemplate) {
      const {start, inner} = this.pendingTemplate;
      this.pendingTemplate = null;
      this._writeStaticTokens([{type: 'template', start, inner: inner.join('') + (this.parser.clear() || ''), end: ''}]);
    }
  }

  /**
   * Write contiguous non-script tokens (a chunk)
   *
   * @param {Array<Object>} tokens The tokens
   * @returns {{tokens, raw, actual, proxy}|null}
   * @private
   */
  _writeStaticTokens(tokens) {
    const chunk = this._buildChunk(tokens);

    if (!chunk.actual) {
      // e.g., no tokens
      return null;
    }

    chunk.html = this.proxyHistory + chunk.actual;
    this.proxyHistory += chunk.proxy;
    this.proxyRoot.innerHTML = chunk.html;

    this._walkChunk();

    return chunk;
  }

  /**
   * Build a chunk.
   *
   * @param {Array<Object>} tokens The tokens to use.
   * @returns {{tokens: *, raw: string, actual: string, proxy: string}}
   * @private
   */
  _buildChunk(tokens) {
    let nextId = this.actuals.length;

    // The raw html of this chunk.
    const raw = [];

    // The html to create the nodes in the tokens (with id's injected).
    const actual = [];

    // Html that can later be used to proxy the nodes in the tokens.
    const proxy = [];

    const len = tokens.length;
    for (let i = 0; i < len; i++) {
      const tok = tokens[i];

      // Epom fork: only the template element itself is tracked; its content is parsed into template.content,
      // out of reach of the walk, so it is written as is and leaves nothing in the proxy history.
      if (tok.type === 'template') {
        const id = nextId++;
        const startRaw = tok.start.toString();
        raw.push(startRaw + tok.inner + tok.end);
        actual.push(startRaw.replace(/(\/?>)$/, ` ${BASEATTR}id=${id}>`) + tok.inner + tok.end);
        proxy.push(`<template ${BASEATTR}proxyof=${id}></template>`);
        continue;
      }

      const tokenRaw = tok.toString();

      raw.push(tokenRaw);

      if (tok.attrs) { // tok.attrs <==> startTag or atomicTag or cursor
        // Epom fork: a noscript is written with its content (inert text with scripting on, as in the browser); it was
        // dropped here, and before that taken for a script, since "noscript" contains "script".
        {
          const id = nextId++;

          // Actual: inject id attribute. Epom fork: as one more attribute of the token, not before the first '>',
          // which can sit inside a quoted value.
          actual.push(withAttr(tok, `${BASEATTR}id`, id).toString());

          // Don't proxy scripts: they have no bearing on DOM structure.
          if (tok.attrs.id !== PROXY_SCRIPT && tok.attrs.id !== PROXY_STYLE) {
            // Proxy: strip all attributes and inject proxyof attribute
            proxy.push(
              // ignore atomic tags (e.g., style): they have no "structural" effect
              tok.type === 'atomicTag' ? '' :
              `<${tok.tagName} ${BASEATTR}proxyof=${id}` + (tok.unary ? ' />' : '>')
            );
          }
        }
      } else {
        // Visit any other type of token
        // Actual: append.
        actual.push(tokenRaw);

        // Proxy: append endTags. Ignore everything else.
        proxy.push(tok.type === 'endTag' ? tokenRaw : '');
      }
    }

    return {
      tokens,
      raw: raw.join(''),
      actual: actual.join(''),
      proxy: proxy.join('')
    };
  }

  /**
   * Walk the chunks.
   *
   * @private
   */
  _walkChunk() {
    let node;
    const stack = [this.proxyRoot];

    // use shift/unshift so that children are walked in document order
    while (existy(node = stack.shift())) {
      const isElement = node.nodeType === 1;
      const isProxy = isElement && getData(node, 'proxyof');

      // Ignore proxies
      if (!isProxy) {
        if (isElement) {
          // New actual element: register it and remove the the id attr.
          this.actuals[getData(node, 'id')] = node;
          setData(node, 'id');
        }

        // Is node's parent a proxy?
        const parentIsProxyOf = node.parentNode &&
          getData(node.parentNode, 'proxyof');
        if (parentIsProxyOf) {
          // Move node under actual parent.
          this.actuals[parentIsProxyOf].appendChild(node);
        }
      }

      // prepend childNodes to stack
      stack.unshift(...node.childNodes);
    }
  }

  /**
   * Handles Script tokens
   *
   * @param {Object} tok The token
   */
  _handleScriptToken(tok) {
    const remainder = this.parser.clear();

    if (remainder) {
      // Write remainder immediately behind this script.
      this.writeQueue.unshift(remainder);
    }

    tok.src = this._decodeEntities(tok.attrs.src || tok.attrs.SRC);
    // Epom fork: a script the browser will not run (type="text/plain"...) is never loaded either, so there is
    // no load event to wait for: write it like an inline one.
    tok.inert = !isJavaScript(tok);

    tok = this.options.beforeWriteToken(tok);
    if (!tok) {
      // User has removed this token
      return;
    }

    if (tok.src && !tok.inert && this.scriptStack.length) {
      // Defer this script until scriptStack is empty.
      // Assumption 1: This script will not start executing until
      // scriptStack is empty.
      this.deferredRemote = tok;
    } else {
      this._onScriptStart(tok);
    }

    // Put the script node in the DOM.
    this._writeScriptToken(tok, () => {
      this._onScriptDone(tok);
    });
  }

  /**
   * Handles style tokens
   *
   * @param {Object} tok The token
   */
  _handleStyleToken(tok) {
    const remainder = this.parser.clear();

    if (remainder) {
      // Write remainder immediately behind this style.
      this.writeQueue.unshift(remainder);
    }

    tok.type = tok.attrs.type || tok.attrs.TYPE || 'text/css';

    tok = this.options.beforeWriteToken(tok);

    if (tok) {
      // Put the style node in the DOM.
      this._writeStyleToken(tok);
    }

    if (remainder) {
      this.write();
    }
  }

  /**
   * Build a style and insert it into the DOM.
   *
   * @param {Object} tok The token
   */
  _writeStyleToken(tok) {
    const el = this._buildStyle(tok);

    this._insertCursor(el, PROXY_STYLE);

    // Set content
    if (tok.content) {
      el.appendChild(this.doc.createTextNode(tok.content));
    }
  }

  /**
   * Build a style element from an atomic style token.
   *
   * @param {Object} tok The token
   * @returns {Element}
   */
  _buildStyle(tok) {
    const el = this.doc.createElement(tok.tagName);

    // Epom fork: the page's CSP nonce, when given.
    if (this.options.nonce) {
      el.nonce = this.options.nonce;
    }

    // Set attributes
    eachKey(tok.attrs, (name, value) => {
      el.setAttribute(name, this._decodeEntities(value));
    });

    return el;
  }

  /**
   * Append a span to the stream. That span will act as a cursor
   * (i.e. insertion point) for the element.
   *
   * @param {Object} el The element
   * @param {string} which The type of proxy element
   */
  _insertCursor(el, which) {
    this._writeImpl(`<span id="${which}"/>`);

    const cursor = this.doc.getElementById(which);

    if (cursor) {
      cursor.parentNode.replaceChild(el, cursor);
    }
  }

  /**
   * Called when a script is started.
   *
   * @param {Object} tok The token
   * @private
   */
  _onScriptStart(tok) {
    tok.outerWrites = this.writeQueue;
    this.writeQueue = [];
    this.scriptStack.unshift(tok);
  }

  /**
   * Called when a script is done.
   *
   * @param {Object} tok The token
   * @private
   */
  _onScriptDone(tok) {
    // Epom fork: a script of a cancelled stream finishing late.
    if (this.aborted) {
      return;
    }

    // Pop script and check nesting.
    if (tok !== this.scriptStack[0]) {
      this.options.error({msg: 'Bad script nesting or script finished twice'});
      return;
    }

    this.scriptStack.shift();

    // Append outer writes to queue and process them.
    this.write.apply(this, tok.outerWrites);

    // Check for pending remote

    // Assumption 2: if remote_script1 writes remote_script2 then
    // the we notice remote_script1 finishes before remote_script2 starts.
    // I think this is equivalent to assumption 1
    if (!this.scriptStack.length && this.deferredRemote) {
      this._onScriptStart(this.deferredRemote);
      this.deferredRemote = null;
    }
  }

  /**
   * Build a script and insert it into the DOM.
   * Done is called once script has executed.
   *
   * @param {Object} tok The token
   * @param {Function} done The callback when complete
   */
  _writeScriptToken(tok, done) {
    const el = this._buildScript(tok);
    const asyncRelease = this._shouldRelease(el);
    // Epom fork: not for a stream cancelled while the script loaded.
    const afterAsync = () => {
      if (!this.aborted) {
        this.options.afterAsync();
      }
    };

    if (tok.src) {
      // the src as decoded and in any case (SRC=)
      el.src = tok.src;
      if (!tok.inert) {
        this._scriptLoadHandler(el, !asyncRelease ? () => {
          done();
          afterAsync();
        } : afterAsync);
      }
    }

    try {
      this._insertCursor(el, PROXY_SCRIPT);
      if (!el.src || asyncRelease || tok.inert) {
        done();
      }
    } catch (e) {
      this.options.error(e);
      done();
    }
  }

  /**
   * Build a script element from an atomic script token.
   *
   * @param {Object} tok The token
   * @returns {Element}
   */
  _buildScript(tok) {
    const el = this.doc.createElement(tok.tagName);

    // Set attributes
    eachKey(tok.attrs, (name, value) => {
      el.setAttribute(name, this._decodeEntities(value));
    });

    // Epom fork: the page's CSP nonce, when given.
    if (this.options.nonce) {
      el.nonce = this.options.nonce;
    }

    // Set content
    if (tok.content) {
      el.text = tok.content;
    }

    return el;
  }

  /**
   * Epom fork: decode the HTML entities of an attribute value the way the parser would. Values reach setAttribute
   * straight from the markup, where `&amp;` (as `outerHTML` writes it) must become `&`; a textarea decodes
   * without running anything.
   *
   * @param {String} value The attribute value as written
   * @returns {String}
   * @private
   */
  _decodeEntities(value) {
    if (!value || value.indexOf('&') === -1) {
      return value;
    }
    const textarea = this.doc.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  /**
   * Setup the script load handler on an element.
   *
   * @param {Object} el The element
   * @param {Function} done The callback
   * @private
   */
  _scriptLoadHandler(el, done) {
    function cleanup() {
      el = el.onload = el.onerror = null;
    }

    const error = this.options.error;

    function success() {
      cleanup();
      if (done != null) {
        done();
      }
      done = null;
    }

    function failure(err) {
      cleanup();
      error(err);
      if (done != null) {
        done();
      }
      done = null;
    }

    function reattachEventListener(el, evt) {
      const handler = el[`on${evt}`];
      if (handler != null) {
        el[`_on${evt}`] = handler;
      }
    }

    reattachEventListener(el, 'load');
    reattachEventListener(el, 'error');

    Object.assign(el, {
      onload() {
        if (el._onload) {
          try {
            el._onload.apply(this, Array.prototype.slice.call(arguments, 0));
          } catch (err) {
            failure({msg: `onload handler failed ${err} @ ${el.src}`});
          }
        }
        success();
      },

      onerror() {
        if (el._onerror) {
          try {
            el._onerror.apply(this, Array.prototype.slice.call(arguments, 0));
          } catch (err) {
            failure({msg: `onerror handler failed ${err} @ ${el.src}`});
            return;
          }
        }
        failure({msg: `remote script failed ${el.src}`});
      }
    });
  }

  /**
   * Determines whether to release.
   *
   * @param {Object} el The element
   * @returns {boolean}
   * @private
   */
  _shouldRelease(el) {
    const isScript = (/^script$/i).test(el.nodeName);
    return !isScript || !!(this.options.releaseAsync && el.src && el.hasAttribute('async'));
  }

}

/**
 * A function that intentionally does nothing.
 */
function doNothing() {
}

/**
 * Available options and defaults.
 *
 * @type {Object}
 */
const OPTIONS = {
  /**
   * Called when an async script has loaded.
   */
  afterAsync: doNothing,

  /**
   * Called immediately before removing from the write queue.
   */
  afterDequeue: doNothing,

  /**
   * Called sync after a stream's first thread release.
   */
  afterStreamStart: doNothing,

  /**
   * Called after writing buffered document.write calls.
   */
  afterWrite: doNothing,

  /**
   * Allows disabling the autoFix feature of prescribe
   */
  autoFix: true,

  /**
   * Called immediately before adding to the write queue.
   */
  beforeEnqueue: doNothing,

  /**
   * Called before writing a token.
   *
   * @param {Object} tok The token
   */
  beforeWriteToken: tok => tok,

  /**
   * Called before writing buffered document.write calls.
   *
   * @param {String} str The string
   */
  beforeWrite: str => str,

  /**
   * Called when evaluation is finished.
   */
  done: doNothing,

  /**
   * Called when a write results in an error.
   *
   * @param {Error} e The error
   */
  error(e) { throw new Error(e.msg); },

  /**
   * Whether to let scripts w/ async attribute set fall out of the queue.
   */
  releaseAsync: false,

  /**
   * Epom fork: the page's Content-Security-Policy nonce, put on every script and style postscribe creates.
   */
  nonce: null
};

let nextId = 0;
let queue = [];
let active = null;

function nextStream() {
  const args = queue.shift();
  if (args) {
    const options = last(args);

    options.afterDequeue();
    args.stream = runStream(...args);
    options.afterStreamStart();
  }
}

function runStream(el, html, options) {
  active = new WriteStream(el, options);

  // Identify this stream.
  active.id = nextId++;
  active.name = options.name || active.id;
  postscribe.streams[active.name] = active;

  // Override document.write.
  const doc = el.ownerDocument;

  const stash = {
    close: doc.close,
    open: doc.open,
    write: doc.write,
    writeln: doc.writeln
  };

  function write(str) {
    str = options.beforeWrite(str);
    active.write(str);
    options.afterWrite(str);
  }

  Object.assign(doc, {
    close: doNothing,
    open: doNothing,
    write: (...str) => write(str.join('')),
    writeln: (...str) => write(str.join('') + '\n')
  });

  // Override window.onerror
  const oldOnError = active.win.onerror || doNothing;

  // This works together with the try/catch around WriteStream::insertScript
  // In modern browsers, exceptions in tag scripts go directly to top level
  active.win.onerror = (msg, url, line) => {
    options.error({msg: `${msg} - ${url}: ${line}`});
    oldOnError.apply(active.win, [msg, url, line]);
  };

  const stream = active;

  // Epom fork: put the page back and start the next stream; done is not called for a cancelled stream.
  function finish(cancelled) {
    // restore document.write
    Object.assign(doc, stash);

    // restore window.onerror
    stream.win.onerror = oldOnError;

    if (!cancelled) {
      options.done();
    }
    active = null;
    nextStream();
  }

  stream.finish = finish;

  // Write to the stream
  stream.write(html, () => finish(false));

  return stream;
}

function postscribe(el, html, options) {
  if (isFunction(options)) {
    options = {done: options};
  } else if (options === 'clear') {
    queue = [];
    active = null;
    nextId = 0;
    return;
  }

  options = defaults(options, OPTIONS);

  // id selector
  if ((/^#/).test(el)) {
    el = window.document.getElementById(el.substr(1));
  } else {
    el = el.jquery ? el[0] : el;
  }

  const args = [el, html, options];

  el.postscribe = {
    cancel: () => {
      if (args.stream) {
        args.stream.abort();
      } else {
        args[1] = doNothing;
      }
    }
  };

  options.beforeEnqueue(args);
  queue.push(args);

  if (!active) {
    nextStream();
  }

  return el.postscribe;
}

Object.assign(postscribe, {
  // Streams by name.
  streams: {},
  // Queue of streams.
  queue,
  // Expose internal classes.
  WriteStream
});

export { postscribe as default };
