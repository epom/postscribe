import HtmlParser from 'prescribe';
import * as utils from './utils';

/**
 * Turn on to debug how each chunk affected the DOM.
 * @type {boolean}
 */
const DEBUG_CHUNK = false;

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
  const attr = BASEATTR + name;

  const val = el.getAttribute(attr);

  // IE 8 returns a number if it's a number
  return !utils.existy(val) ? val : String(val);
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

  if (utils.existy(value) && value !== '') {
    el.setAttribute(attr, value);
  } else {
    el.removeAttribute(attr);
  }
}

// Epom fork: the script types a browser runs (HTML spec "JavaScript MIME type essence match", plus module).
const JS_TYPE = /^(?:module|(?:application|text)\/(?:x-)?(?:ecmascript|javascript)|text\/javascript1\.[0-5]|text\/(?:jscript|livescript))$/i;

function isJavaScript(tok) {
  const type = tok.attrs.type || tok.attrs.TYPE;
  return !type || !type.trim() || JS_TYPE.test(type.split(';')[0].trim());
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
export default class WriteStream {
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
    this.win = this.doc.defaultView || this.doc.parentWindow;
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
    this.writeQueue.push(...str);

    // Process writes
    // When new script gets pushed or pending this will stop
    // because new writeQueue gets pushed
    while (!this.deferredRemote && this.writeQueue.length) {
      const arg = this.writeQueue.shift();

      if (utils.isFunction(arg)) {
        // Epom fork: the stream ends with a function, so a template still open by now never gets closed.
        this._flushPendingTemplate();
        this._callFunction(arg);
      } else {
        this._writeImpl(arg);
      }
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
    if (this.pendingTemplate) {
      html = this.pendingTemplate.start.toString() + this.pendingTemplate.inner + html;
      this.pendingTemplate = null;
    }
    this.parser.append(html);

    let tok;
    let script;
    let style;
    const tokens = [];

    // stop if we see a script token
    while ((tok = this.parser.readToken())) {
      // Epom fork: a template's content is inert, so take it whole instead of running the scripts in it.
      if (isTemplateStart(tok)) {
        const template = this._readTemplate(tok);
        if (!template) {
          break;
        }
        tokens.push(template);
        continue;
      }

      if ((script = utils.isScript(tok)) || (style = utils.isStyle(tok))) {
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
   * Epom fork: read the rest of a template, nested ones included, into a single inert token. Returns null when
   * the html ends inside it: what was read is kept and put in front of the next write.
   *
   * @param {Object} start The template start tag token
   * @returns {Object|null}
   * @private
   */
  _readTemplate(start) {
    const inner = [];
    let depth = 1;
    let tok;

    while ((tok = this.parser.readToken())) {
      if (isTemplateStart(tok)) {
        depth++;
      } else if (isTemplateEnd(tok) && --depth === 0) {
        return {type: 'template', start, inner: inner.join(''), end: tok.toString()};
      }
      inner.push(tok.toString());
    }

    this.pendingTemplate = {start, inner: inner.join('') + (this.parser.clear() || '')};
    return null;
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
      this._writeStaticTokens([{type: 'template', start, inner, end: ''}]);
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
      // e.g., no tokens, or a noscript that got ignored
      return null;
    }

    chunk.html = this.proxyHistory + chunk.actual;
    this.proxyHistory += chunk.proxy;
    this.proxyRoot.innerHTML = chunk.html;

    if (DEBUG_CHUNK) {
      chunk.proxyInnerHTML = this.proxyRoot.innerHTML;
    }

    this._walkChunk();

    if (DEBUG_CHUNK) {
      chunk.actualInnerHTML = this.root.innerHTML;
    }

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
        // Ignore noscript tags. They are atomic, so we don't have to worry about children.
        if (!(/^noscript$/i).test(tok.tagName)) {
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
    while (utils.existy(node = stack.shift())) {
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
      stack.unshift.apply(stack, utils.toArray(node.childNodes));
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
      if (el.styleSheet && !el.sheet) {
        el.styleSheet.cssText = tok.content;
      } else {
        el.appendChild(this.doc.createTextNode(tok.content));
      }
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

    el.setAttribute('type', tok.type);

    // Set attributes
    utils.eachKey(tok.attrs, (name, value) => {
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
    const afterAsync = this.options.afterAsync;

    if (tok.src) {
      // Fix for attribute "SRC" (capitalized). IE does not recognize it.
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
    utils.eachKey(tok.attrs, (name, value) => {
      el.setAttribute(name, this._decodeEntities(value));
    });

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
      el = el.onload = el.onreadystatechange = el.onerror = null;
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
      },

      onreadystatechange() {
        if (/^(loaded|complete)$/.test(el.readyState)) {
          success();
        }
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
