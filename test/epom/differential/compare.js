import postscribe from '../../../src/postscribe.js';

// Differential testing: the same markup goes through the browser's own document.write (in a fresh iframe) and through
// postscribe (into a fresh div); the two resulting DOM trees must serialize the same. The browser is the oracle.

let n = 0;

/** A stable serialization of a node's children: sorted attributes, template content, no postscribe bookkeeping. */
export function serialize(parent) {
  let out = '';
  if (parent.tagName === 'TEMPLATE') {
    parent.content.normalize();
  }
  const children = parent.tagName === 'TEMPLATE' ? parent.content.childNodes : parent.childNodes;
  for (const node of children) {
    if (node.nodeType === 3) {
      out += JSON.stringify(node.data);
    } else if (node.nodeType === 8) {
      out += `<!--${node.data}-->`;
    } else if (node.nodeType === 1) {
      if (node.hasAttribute('data-diff-skip')) {
        continue;
      }
      const name = node.localName;
      const attrs = Array.from(node.attributes)
        .filter(a => !/^data-ps-/.test(a.name))
        .map(a => `${a.name}=${JSON.stringify(a.value)}`)
        .sort();
      out += `<${name}${attrs.length ? ` ${attrs.join(' ')}` : ''}>${serialize(node)}</${name}>`;
    }
  }
  return out;
}

/**
 * Markup written by the browser's document.write into a fresh iframe; resolves with the serialized body once the
 * document is complete (its scripts run and loaded). Not a marker element written after the markup: an unterminated
 * comment or tag at its end would swallow it.
 */
function nativeWrite(html) {
  const frame = document.createElement('iframe');
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  return new Promise((resolve, reject) => {
    let poll = null;
    const timer = setTimeout(() => {
      clearInterval(poll);
      frame.remove();
      reject(new Error('native write never finished'));
    }, 4000);
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body>');
    doc.write(html);
    doc.close();
    poll = setInterval(() => {
      if (doc.readyState === 'complete') {
        clearInterval(poll);
        clearTimeout(timer);
        doc.body.normalize();
        const result = serialize(doc.body);
        frame.remove();
        resolve(result);
      }
    }, 2);
  });
}

/** The same markup through postscribe into a fresh div; resolves with the serialized div and any reported errors. */
function postscribeWrite(html) {
  const div = document.createElement('div');
  div.id = `diff-${++n}`;
  document.body.appendChild(div);
  const errors = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('postscribe never finished')), 4000);
    postscribe(div, html, {
      error: e => errors.push(e && e.msg),
      done() {
        clearTimeout(timer);
        // postscribe writes text in as many nodes as it got chunks; the DOM text is what counts
        div.normalize();
        const result = serialize(div);
        div.remove();
        resolve({result, errors});
      }
    });
  });
}

/** Writes `html` both ways and resolves with {native, postscribe, errors}. */
export async function compare(html) {
  const native = await nativeWrite(html);
  const {result, errors} = await postscribeWrite(html);
  return {native, postscribe: result, errors};
}

/** The markup written by one script in pieces, cut at the given offsets: how real tags write. */
export function inPieces(html, cuts) {
  const pieces = [];
  let from = 0;
  for (const cut of [...cuts].sort((a, b) => a - b)) {
    pieces.push(html.slice(from, cut));
    from = cut;
  }
  pieces.push(html.slice(from));
  const js = pieces.map(p => `document.write(${JSON.stringify(p).replace(/<\//g, '<\\/')});`).join('\n');
  return `<script>${js}</script>`;
}

/**
 * Deterministic pseudo-random cut points, so a failure reproduces. mulberry32 in 32-bit integer arithmetic: an LCG in
 * floating point lost precision past 2^53, fell into a short cycle and never found enough distinct cuts.
 */
export function cutsFor(html, seed, count) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cuts = new Set();
  const want = Math.min(count, html.length - 1);
  for (let tries = 0; cuts.size < want && tries < 1000; tries++) {
    cuts.add(1 + Math.floor(next() * (html.length - 1)));
  }
  return [...cuts];
}
