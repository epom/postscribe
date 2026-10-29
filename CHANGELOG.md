# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## 3.1.2 - 2026-10-29
### Fixed
- Google Closure Compiler no longer warns `JSC_INVALID_PARAM` on three JSDoc tags (`options.tagSoupFix`,
  `options.selfCloseFix`, `options.autoFix`); the options are documented as record types. Comments only, no code
  changes.

### Added
- `npm run test:closure`, part of `npm run verify`: compiles `dist/postscribe.js` with Closure Compiler as the Epom
  ad server does and fails on any warning or error.

## 3.1.1 - 2026-10-21
### Changed
- Published on npm as `@epom-rnd/postscribe`; the `postscribe` name there still holds the unmaintained 2.0.8. No code
  changes.

## 3.1.0 - 2026-10-21
### Fixed
Found by differential testing: the same markup written through the browser's own `document.write` and through
postscribe, whole and in pieces, must give the same DOM.
- A double quote inside a single-quoted attribute value (`data-cfg='{"a":1}'`) no longer corrupts it.
  [#9](https://github.com/epom/postscribe/issues/9)
- Attribute names may hold any character HTML allows (`xlink:href`, `xmlns:xlink`, `@click`, `:class`).
  [#10](https://github.com/epom/postscribe/issues/10)
- Of a repeated attribute the first value is kept, as in the browser. [#11](https://github.com/epom/postscribe/issues/11)
- A write that ends inside a quoted value waits for the rest of the tag instead of ending it at a `>` in the value.
  [#12](https://github.com/epom/postscribe/issues/12)
- A `textarea`, `noscript` or `iframe` split across writes keeps its content as text; one left unterminated is still
  written. [#13](https://github.com/epom/postscribe/issues/13)
- A comment split across writes stays a comment. [#14](https://github.com/epom/postscribe/issues/14)
- `<?xml ?>` and `<![CDATA[ ]]>` become comments, as in the browser; a doctype is dropped.
  [#15](https://github.com/epom/postscribe/issues/15)
- A template written in many small pieces no longer doubles its tags. [#16](https://github.com/epom/postscribe/issues/16)
- CR LF and lone CR become LF, also in script and style text and when the CR and the LF arrive in different writes.
  [#17](https://github.com/epom/postscribe/issues/17)
- Styles no longer get `type="text/css"` added. [#18](https://github.com/epom/postscribe/issues/18)
- A character reference split across writes (`&cop` + `y;`) is completed instead of left literal.
  [#19](https://github.com/epom/postscribe/issues/19)
- `xmp`, `noembed`, `noframes` and `title` keep their content as raw text. [#20](https://github.com/epom/postscribe/issues/20)
- A `noscript` is written with its content; it was taken for a script ("noscript" contains "script") and lost.
  [#21](https://github.com/epom/postscribe/issues/21)
- Stray and misnested end tags are fixed as the browser fixes them: an end tag of nothing open is dropped instead of
  closing the parent, formatting elements closed out of order are reopened (`<b><i>x</b>y</i>`), and a stray `</p>`
  makes an empty `<p>`. [#22](https://github.com/epom/postscribe/issues/22)

### Added
- TypeScript types (`postscribe.d.ts`) and an ES module build (`dist/postscribe.mjs`), with `exports` in package.json.
- The suites run in Chromium, Firefox and WebKit in CI.
- `npm run test:differential`: some 130 kinds of markup, whole and cut into pieces, compared against the browser.

### Removed
- Internet Explorer support: `parentWindow`, `styleSheet.cssText`, `onreadystatechange`, the IE8 attribute coercion, the
  VBScript spec, and prescribe's feature tests of 2010s browsers (`autoFix` now turns its fixes on directly). Supported:
  Chrome 80+, Edge 80+, Firefox 78+, Safari 14+.

## 3.0.1 - 2026-10-21
### Changed
- The build banner and `package.json` name Epom as the author and maintainer of 3.x; the original authors and Krux's
  copyright stay, as the MIT license requires. `LICENSE` adds Epom's copyright, and `src/prescribe/LICENSE` carries
  prescribe's. No code change.

## 3.0.0 - 2026-10-21
First release of the Epom fork. Upstream stopped at 2.0.8 (November 2016) and was archived in 2024. The API is
unchanged and 3.0 is a drop-in for 2.0.8; the major version is for the behaviour fixes below and the new build.

### Fixed
- A `<script>` whose type the browser does not run (`text/plain`, as consent managers park tags; a type with MIME
  parameters) no longer stops the stream when it has a `src`. [#2](https://github.com/epom/postscribe/issues/2),
  upstream [krux/postscribe#513](https://github.com/krux/postscribe/issues/513)
- Attribute values of the scripts and styles postscribe builds are entity-decoded, so a script written through
  `document.write(el.outerHTML)` keeps the `&` in its URL. [#3](https://github.com/epom/postscribe/issues/3), upstream
  [krux/postscribe#346](https://github.com/krux/postscribe/issues/346)
- A `>` inside a quoted attribute value no longer ends the tag and corrupts the value.
  [#4](https://github.com/epom/postscribe/issues/4), upstream [krux/postscribe#509](https://github.com/krux/postscribe/issues/509)
- `<!DOCTYPE>` and `<?xml?>` no longer stop the stream, so a creative that is a whole HTML document renders.
  [#5](https://github.com/epom/postscribe/issues/5), upstream [krux/postscribe#358](https://github.com/krux/postscribe/issues/358)
- A stray end tag of an empty element (`</embed>`, `</img>`) no longer closes the enclosing element; `</br>` reads as
  `<br>`, as in the browser. [#7](https://github.com/epom/postscribe/issues/7), upstream's own skipped `selfclosing` spec
- `cancel()` on a running stream no longer throws `stream.abort is not a function` and no longer leaves
  `document.write` overridden with every later stream stuck: the stream stops, none of its callbacks fire, and the
  next one runs. [#8](https://github.com/epom/postscribe/issues/8), upstream
  [krux/postscribe#478](https://github.com/krux/postscribe/issues/478)

### Added
- `nonce` option: the scripts and styles postscribe creates carry the page's CSP nonce.
  [#6](https://github.com/epom/postscribe/issues/6), upstream [krux/postscribe#512](https://github.com/krux/postscribe/pull/512)

### Changed
- The HTML tokenizer, [prescribe](https://github.com/krux/prescribe) (archived too), lives in `src/prescribe/` and is
  maintained here, with its own test suite.
- Built with rollup from native ES modules; `dist/` is ES2015+ (2.0.8 was ES3/ES5). The minified build is about 15 KB,
  down from 18 KB.
- gulp, webpack 1, Babel 6, Karma, PhantomJS, JSCS and semantic-release are replaced by rollup, ESLint 10 and Web Test
  Runner on Playwright Chromium. The original suite runs again, every case of it: three specs skipped upstream for old
  IE now pass, and the fourth found #7.

## 2.0.8-epom.1 - 2026-10-20
### Fixed
- `<template>` content is written as inert HTML. Upstream ran every script inside it, left the template empty, and
  stalled the stream on an external script inside one. [#1](https://github.com/epom/postscribe/issues/1)

## 2.0.3 - 2016-04-22
### Fixed
- Fixed #159 - Chrome producing Unexpected token ILLEGAL when iframe src contains escaped double quotes

## 2.0.2 - 2016-04-22
### Fixed
- Fixed the export setup for browser-based

## 2.0.1 - 2016-04-19
### Fixed
- Fixed race condition in release resulting in an empty package

## 2.0.0 - 2016-04-18
### Changed
- Porting to ES6, Gulp, Karma and Webpack
- Rearrange source files
- Pull in some fixes from various PRs and downstream forks
- Publish as a UMD module
- Extracted htmlParser out as a new module called `prescribe`

## 1.4.0 - 2015-04-25
### Fixed
- Fix incomplete tags blocking UI thread
- beforeWriteToken hook
- Handle boolean attrs
- Comments fix
- Make autoFix a postscribe option

## 1.3.2 - 2014-06-06
### Changed
- Screwed up the tagging. (automation coming soon...)

## 1.3.0 - 2015-06-06
### Added
- Adds hooks around queuing and stream starting.

## 1.2.0 - 2014-03-03
### Added
- Adds option to not overwrite doc.write while script[async] is loading.

## 1.1.2 - 2014-03-03
### Fixed
- iframe and textarea fix

## 1.1.1 - UNKNOWN
### Changed
- Error handling mod

## 1.1.0 - 2013-06-13
### Changed
- major refactoring to simplify code and fix rare bugs related to script tag handling
- scripts are now written inline

## 1.0.5 - 2013-01-09
### Fixed
- htmlParser performance fix

## 1.0.3 - UNKNOWN
### Added
- Test framework improvements
### Fixed
- Lots of things

## 1.0.2 - UNKNOWN
### Changed
- Documentation release

## 1.0.1 - UNKNOWN
### Changed
- Documentation

## 1.0.0  - 2012-10-12
### Added
- Initial open source release
- Write tags asynchronously, yo. Initial release after 2+ years of development internally at Krux

