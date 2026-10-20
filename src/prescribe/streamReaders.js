import {CommentToken, CharsToken, StartTagToken,
    AtomicTagToken, EndTagToken} from './tokens.js';

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
export function comment(stream) {
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
export function chars(stream) {
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
export function startTag(stream) {
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
export function atomicTag(stream) {
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
export function endTag(stream) {
  const match = stream.match(REGEXES.endTag);
  if (match) {
    return new EndTagToken(match[1], match[0].length);
  }
}
