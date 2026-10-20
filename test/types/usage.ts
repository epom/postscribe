// Compiled by `npm run lint` (tsc): the typings must accept every documented use and reject a wrong one.
import postscribe = require('../../postscribe');

const el = document.createElement('div');
const stream: postscribe.Stream = postscribe(el, '<script src="tag.js"></script>', {
  done: () => undefined,
  error: e => console.warn(e.msg),
  nonce: 'abc',
  releaseAsync: true,
  beforeWrite: html => html.toUpperCase(),
  beforeWriteToken: tok => (tok.tagName === 'img' ? null : tok)
});
stream.cancel();
postscribe('#ad', doc => doc.write('<p>x</p>'), () => undefined);

// @ts-expect-error: options are typed
postscribe(el, '<p>x</p>', {done: 42});
