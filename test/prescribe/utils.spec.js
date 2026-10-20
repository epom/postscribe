import {escapeQuotes} from '../../src/prescribe/utils.js';

describe('escapeQuotes', () => {
  it('escapes quotes in js', () => {
    expect(escapeQuotes('var s=""')).to.equal('var s=\\"\\"');
    expect(escapeQuotes('"something"')).to.equal('\\"something\\"');
    expect(escapeQuotes('"WAT')).to.equal('\\"WAT');
  });

  it("doesn't escape quotes that're already escaped", () => {
    expect(escapeQuotes('\"WAT')).to.equal('\\"WAT');
  });
});
