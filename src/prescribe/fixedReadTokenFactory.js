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
export default function fixedReadTokenFactory(parser, options, readTokenImpl) {
  const stack = newStack();

  const handlers = {
    startTag(tok) {
      const tagName = tok.tagName;

      if (tagName.toUpperCase() === 'TR' && stack.lastTagNameEq('TABLE')) {
        parser.prepend('<TBODY>');
        prepareNextToken();
      } else if (options.selfCloseFix && CLOSESELF.test(tagName) &&
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
      } else if (options.tagSoupFix) {
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
