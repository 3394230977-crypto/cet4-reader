const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = { window: {}, Intl };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../text-utils.js'), 'utf8'), ctx);
const split = text => Array.from(ctx.window.CET4Text.splitSentences(text));
test('decimals, titles and abbreviations keep the whole sentence', () => {
  const sentence = 'Dr. Smith paid $3.5 million in the U.S. last year.';
  assert.deepEqual(split(sentence), [sentence]);
});
test('sentences preserve all punctuation, numbers and whitespace', () => {
  for (const text of ['The figure was 3.5%. It fell by 10%.', 'Use A/B testing, e.g. for two versions. This works.', '“Why?” she asked. He said, “It works!”', 'J. Smith studied in the U.S. The work helped.']) {
    assert.equal(split(text).join(''), text);
  }
});
test('separate sentences after acronyms remain separate', () => {
  assert.deepEqual(split('She moved to the U.S. The next year, she returned.'), ['She moved to the U.S. ', 'The next year, she returned.']);
});
