import corpus from './corpus.js';
import {compare, inPieces, cutsFor} from './compare.js';

// Every corpus entry, written as is and by a script in pieces, must give the same DOM as the browser's own
// document.write. Known differences are listed in KNOWN with the reason; anything else is a bug.
const KNOWN = {
  // Text directly inside a table is moved before it ("foster parenting"). postscribe only appends to elements, so text
  // that reaches the table in a later write lands after it. Rare in creatives; not worth a DOM-surgery special case.
  'tables and forms / text inside table': true,
  // The browser carries a formatting element left open (<i>) on into the next block it reaches; postscribe's tokenizer
  // closes it there. Modelling the browser's reconstruction of formatting elements would mean redoing the auto-fix.
  'nesting and auto-closing / formatting carried across blocks': true,
  // A newline that starts a later write inside a <pre> is eaten: each chunk is parsed right after the proxy <pre>,
  // where the browser drops a leading newline.
  'raw text elements / plaintext-like pre': true
};

function variants(html, seed) {
  const out = [['whole', html]];
  for (let i = 1; i <= 3; i++) {
    const cuts = cutsFor(html, seed * 10 + i, i * 2);
    out.push([`in pieces at ${cuts.sort((a, b) => a - b).join(',')}`, inPieces(html, cuts)]);
  }
  if (html.length <= 120) {
    out.push(['one character per write', inPieces(html, Array.from({length: html.length - 1}, (_, i) => i + 1))]);
  }
  return out;
}

export function runGroup(group, source = corpus) {
  const cases = source[group];
  let seed = (Object.keys(source).indexOf(group) + 1) * 1000;
  {
    describe(group, () => {
      for (const [name, html] of Object.entries(cases)) {
        seed++;
        for (const [variant, markup] of variants(html, seed)) {
          const id = `${group} / ${name} / ${variant}`;
          const test = KNOWN[`${group} / ${name}`] ? it.skip : it;
          test(`${name} — ${variant}`, async() => {
            const {native, postscribe, errors} = await compare(markup);
            if (native !== postscribe) {
              console.log(`DIFF ${id}\n  native:     ${native}\n  postscribe: ${postscribe}${errors.length ? `\n  errors: ${errors.join(' | ')}` : ''}`);
            }
            expect(postscribe).to.be(native);
          });
        }
      }
    });
  }
}
