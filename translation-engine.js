(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const DICT_URLS = [
    'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/CET4_T.json',
    'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/CET6_T.json'
  ];

  let dictionaryPromise = null;
  let chromeTranslatorPromise = null;

  function cleanWord(value) {
    return String(value || '').trim().toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
  }

  function isSingleWord(value) {
    return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(String(value || '').trim());
  }

  function lemmaCandidates(word) {
    const w = cleanWord(word);
    const out = [w];
    const irregular = {
      went: 'go', gone: 'go', came: 'come', come: 'come', made: 'make', took: 'take', taken: 'take',
      thought: 'think', found: 'find', felt: 'feel', knew: 'know', known: 'know', gave: 'give', given: 'give',
      saw: 'see', seen: 'see', wrote: 'write', written: 'write', grew: 'grow', grown: 'grow',
      children: 'child', people: 'person', men: 'man', women: 'woman', mice: 'mouse', feet: 'foot', teeth: 'tooth'
    };
    if (irregular[w]) out.push(irregular[w]);
    if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y');
    if (w.endsWith('ves') && w.length > 4) { out.push(w.slice(0, -3) + 'f'); out.push(w.slice(0, -3) + 'fe'); }
    if (w.endsWith('es') && w.length > 4) { out.push(w.slice(0, -2)); out.push(w.slice(0, -1)); }
    if (w.endsWith('s') && w.length > 3) out.push(w.slice(0, -1));
    if (w.endsWith('ied') && w.length > 4) out.push(w.slice(0, -3) + 'y');
    if (w.endsWith('ing') && w.length > 5) {
      const stem = w.slice(0, -3);
      out.push(stem, stem + 'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
    }
    if (w.endsWith('ed') && w.length > 4) {
      const stem = w.slice(0, -2);
      out.push(stem, stem + 'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
    }
    if (w.endsWith('er') && w.length > 4) out.push(w.slice(0, -2));
    if (w.endsWith('est') && w.length > 5) out.push(w.slice(0, -3));
    return [...new Set(out.filter(Boolean))];
  }

  async function loadDictionary() {
    if (dictionaryPromise) return dictionaryPromise;
    dictionaryPromise = (async () => {
      const map = new Map();
      for (const url of DICT_URLS) {
        try {
          const res = await nativeFetch(url, { cache: 'force-cache' });
          if (!res.ok) continue;
          const list = await res.json();
          if (!Array.isArray(list)) continue;
          for (const item of list) {
            const key = cleanWord(item?.name);
            if (!key) continue;
            const trans = Array.isArray(item.trans) ? item.trans.filter(Boolean) : [];
            if (!trans.length) continue;
            if (!map.has(key)) map.set(key, { ...item, trans: [...trans] });
            else {
              const old = map.get(key);
              old.trans = [...new Set([...(old.trans || []), ...trans])];
              if (!old.usphone && item.usphone) old.usphone = item.usphone;
              if (!old.ukphone && item.ukphone) old.ukphone = item.ukphone;
            }
          }
        } catch (_) {}
      }
      return map;
    })();
    return dictionaryPromise;
  }

  async function dictionaryLookup(word) {
    const map = await loadDictionary();
    for (const candidate of lemmaCandidates(word)) {
      const item = map.get(candidate);
      if (!item) continue;
      const meanings = [...new Set((item.trans || []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean))];
      const phone = item.usphone || item.ukphone || '';
      const prefix = candidate !== cleanWord(word) ? `原形 ${candidate}` : '四/六级词典';
      const phonetic = phone ? ` /${phone}/` : '';
      return `${prefix}${phonetic}｜${meanings.join('；')}`;
    }
    return '';
  }

  async function getChromeTranslator() {
    if (!('Translator' in self)) return null;
    if (chromeTranslatorPromise) return chromeTranslatorPromise;
    chromeTranslatorPromise = (async () => {
      try {
        const availability = await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'zh' });
        if (availability === 'unavailable') return null;
        return await Translator.create({ sourceLanguage: 'en', targetLanguage: 'zh' });
      } catch (_) {
        return null;
      }
    })();
    return chromeTranslatorPromise;
  }

  async function chromeTranslate(text) {
    const translator = await getChromeTranslator();
    if (!translator) return '';
    try {
      return String(await translator.translate(text)).trim();
    } catch (_) {
      return '';
    }
  }

  function fakeTranslationResponse(text, engine) {
    const body = JSON.stringify({
      responseData: { translatedText: text },
      responseStatus: 200,
      cet4Engine: engine
    });
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-CET4-Translation-Engine': engine
      }
    });
  }

  function extractMyMemoryQuery(input) {
    try {
      const url = typeof input === 'string' ? new URL(input, location.href) : new URL(input.url, location.href);
      if (url.hostname !== 'api.mymemory.translated.net' || !url.pathname.includes('/get')) return null;
      return url.searchParams.get('q') || '';
    } catch (_) {
      return null;
    }
  }

  // Remove only the old machine-translation cache once, so poor previous results do not keep reappearing.
  try {
    const upgradeKey = 'cet4_translation_engine_upgrade_20260907';
    if (!localStorage.getItem(upgradeKey)) {
      localStorage.removeItem('cet4_reader_translation_cache_v2');
      localStorage.setItem(upgradeKey, '1');
    }
  } catch (_) {}

  window.fetch = async function(input, init) {
    const q = extractMyMemoryQuery(input);
    if (q == null) return nativeFetch(input, init);

    const text = String(q).trim();
    if (!text) return nativeFetch(input, init);

    // For a single word, prefer a learning-oriented CET-4/CET-6 dictionary with common senses and phonetics.
    if (isSingleWord(text)) {
      const dictionaryResult = await dictionaryLookup(text);
      if (dictionaryResult) return fakeTranslationResponse(dictionaryResult, 'cet-dictionary');
    }

    // For phrases and sentences, prefer Chrome's built-in Translator API on supported desktop Chrome.
    // It is contextual and avoids exposing any API key in this public GitHub Pages site.
    const chromeResult = await chromeTranslate(text);
    if (chromeResult) return fakeTranslationResponse(chromeResult, 'chrome-translator');

    // Compatibility fallback for browsers without the built-in Translator API.
    return nativeFetch(input, init);
  };

  window.CET4TranslationEngine = {
    dictionaryReady: () => loadDictionary().then(map => map.size),
    hasChromeTranslator: () => 'Translator' in self
  };
})();