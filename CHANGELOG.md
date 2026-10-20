# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

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

