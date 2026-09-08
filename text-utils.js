(() => {
  'use strict';
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();

  // Protect periods that are part of a number/name before finding sentence ends.
  function splitSentences(value) {
    const text = String(value || '');
    const marker = '\uE000';
    const protect = value => value.replace(/\./g, marker);
    let prepared = text.replace(/(?<=\d)\.(?=\d)/g, marker)
      .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e)\./gi, protect)
      .replace(/\b(?:[A-Z]\.){2,}/g, (match, offset, source) => {
        const after = source.slice(offset + match.length).trimStart();
        return /^(?:The|This|That|These|Those|It|They|He|She|We|However|But|And|A|An)\b/.test(after)
          ? protect(match.slice(0, -1)) + '.' : protect(match);
      })
      .replace(/(?<!\uE000)\b[A-Z]\.(?=\s+[A-Z][a-z])/g, protect);
    const segments = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(prepared)].map(item => item.segment)
      : prepared.match(/[^.!?]+(?:[.!?]+[”’"')\]]*\s*|$)|[.!?]+/g) || [prepared];
    return segments.map(segment => segment.replaceAll(marker, '.')).filter(Boolean);
  }

  window.CET4Text = { normalize, splitSentences };
})();
