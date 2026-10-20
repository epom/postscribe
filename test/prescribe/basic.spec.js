import HtmlParser from '../../src/prescribe/HtmlParser.js';

describe('HtmlParser', () => {
  describe('#constructor', () => {
    it('constructs', () => {
      const parser = new HtmlParser('input', {});
      expect(parser).to.be.ok();
      expect(parser).to.have.property('stream', 'input');
    });
  });
});
