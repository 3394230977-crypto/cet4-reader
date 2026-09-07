(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);

  // Ordered from concise/common exam senses to broader coverage.
  const DICT_URLS = [
    { url: 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/926.json', label: '核心词义', rank: 0 },
    { url: 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/CET4_T.json', label: 'CET-4', rank: 1 },
    { url: 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/CET6_T.json', label: 'CET-6', rank: 2 },
    { url: 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/GaoKao_3500.json', label: '高频基础词', rank: 3 },
    { url: 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/Oxford5000.json', label: 'Oxford 5000', rank: 4 },
    { url: 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/2024HongBao_T2.json', label: '扩展词义', rank: 5 }
  ];

  // Lingva is an open-source Google Translate front-end. These are public instances
  // listed by the project. They are used only when Chrome's on-device Translator API
  // is unavailable. Requests may fail if an instance is down or blocks CORS.
  const LINGVA_INSTANCES = [
    'https://translate.plausibility.cloud',
    'https://lingva.lunar.icu',
    'https://translate.dr460nf1r3.org',
    'https://translate.jae.fi'
  ];

  let dictionaryPromise = null;
  let chromeTranslatorPromise = null;
  let lastAutoToken = 0;

  const CONTEXT_CACHE_KEY = 'cet4_reader_context_cache_v4';
  let contextCache = readJSON(CONTEXT_CACHE_KEY, {});

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function cleanWord(value) {
    return String(value || '').trim().toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isSingleWord(value) {
    return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(String(value || '').trim());
  }

  function lemmaCandidates(word) {
    const w = cleanWord(word);
    const out = [w];
    const irregular = {
      went: 'go', gone: 'go', came: 'come', made: 'make', took: 'take', taken: 'take',
      thought: 'think', found: 'find', felt: 'feel', knew: 'know', known: 'know',
      gave: 'give', given: 'give', saw: 'see', seen: 'see', wrote: 'write', written: 'write',
      grew: 'grow', grown: 'grow', ran: 'run', run: 'run', began: 'begin', begun: 'begin',
      brought: 'bring', bought: 'buy', caught: 'catch', taught: 'teach', left: 'leave',
      held: 'hold', kept: 'keep', lost: 'lose', paid: 'pay', said: 'say', told: 'tell',
      became: 'become', built: 'build', chose: 'choose', chosen: 'choose', drove: 'drive', driven: 'drive',
      children: 'child', people: 'person', men: 'man', women: 'woman', mice: 'mouse',
      feet: 'foot', teeth: 'tooth', geese: 'goose'
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

  function tidyMeaning(value) {
    return String(value || '')
      .replace(/\r?\n+/g, '；')
      .replace(/\s+/g, ' ')
      .replace(/；{2,}/g, '；')
      .replace(/^[-•]\s*/, '')
      .trim();
  }

  async function loadDictionary() {
    if (dictionaryPromise) return dictionaryPromise;
    dictionaryPromise = (async () => {
      const map = new Map();
      await Promise.all(DICT_URLS.map(async source => {
        try {
          const res = await nativeFetch(source.url, { cache: 'force-cache' });
          if (!res.ok) return;
          const list = await res.json();
          if (!Array.isArray(list)) return;
          for (const item of list) {
            const key = cleanWord(item?.name);
            if (!key) continue;
            const trans = Array.isArray(item.trans) ? item.trans.map(tidyMeaning).filter(Boolean) : [];
            if (!trans.length) continue;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push({
              rank: source.rank,
              label: source.label,
              trans,
              usphone: item.usphone || '',
              ukphone: item.ukphone || ''
            });
          }
        } catch (_) {}
      }));
      return map;
    })();
    return dictionaryPromise;
  }

  async function dictionaryLookup(word) {
    const map = await loadDictionary();
    for (const candidate of lemmaCandidates(word)) {
      const entries = (map.get(candidate) || []).sort((a, b) => a.rank - b.rank);
      if (!entries.length) continue;

      const allMeanings = [];
      let phone = '';
      let primaryLabel = entries[0].label;
      for (const entry of entries) {
        if (!phone) phone = entry.usphone || entry.ukphone || '';
        for (const meaning of entry.trans) {
          if (!allMeanings.some(x => x.toLowerCase() === meaning.toLowerCase())) allMeanings.push(meaning);
        }
      }

      // Prefer concise meanings first; avoid overwhelming the learner with rare senses.
      allMeanings.sort((a, b) => {
        const apos = /(^|\s)(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.)/i.test(a) ? -1 : 0;
        const bpos = /(^|\s)(n\.|v\.|vt\.|vi\.|adj\.|adv\.|prep\.|conj\.)/i.test(b) ? -1 : 0;
        return (apos - bpos) || (a.length - b.length);
      });

      const top = allMeanings.slice(0, 5);
      const lines = [];
      if (candidate !== cleanWord(word)) lines.push(`原形：${candidate}`);
      if (phone) lines.push(`音标：/${phone}/`);
      lines.push(`常用义：${top.join('；')}`);
      lines.push(`来源：${primaryLabel}${entries.length > 1 ? ' + 多词库校对' : ''}`);
      return lines.join('\n');
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
      } catch (_) { return null; }
    })();
    return chromeTranslatorPromise;
  }

  async function chromeTranslate(text) {
    const translator = await getChromeTranslator();
    if (!translator) return '';
    try {
      return normalizeText(await translator.translate(text));
    } catch (_) { return ''; }
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  async function lingvaTranslate(text) {
    // Lingva's route is path-based; slashes can break routing, so normalize them.
    const safeQuery = normalizeText(text).replace(/[\/\\]+/g, ' ');
    if (!safeQuery) return '';
    for (const base of LINGVA_INSTANCES) {
      try {
        const url = `${base}/api/v1/en/zh/${encodeURIComponent(safeQuery)}`;
        const res = await withTimeout(nativeFetch(url, { cache: 'no-store', mode: 'cors' }), 4500);
        if (!res.ok) continue;
        const data = await res.json();
        const translated = normalizeText(data?.translation || '');
        if (translated && translated.toLowerCase() !== safeQuery.toLowerCase()) return translated;
      } catch (_) {}
    }
    return '';
  }

  async function highQualityTranslate(text) {
    text = normalizeText(text);
    if (!text) return { translation: '', engine: 'none' };

    // Best no-key option: Chrome's official on-device Translator API.
    const chrome = await chromeTranslate(text);
    if (chrome) return { translation: chrome, engine: 'Chrome 本地翻译' };

    // Cross-browser fallback: Lingva public API, which proxies Google Translate.
    const lingva = await lingvaTranslate(text);
    if (lingva) return { translation: lingva, engine: 'Lingva / Google Translate' };

    return { translation: '', engine: 'unavailable' };
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
    } catch (_) { return null; }
  }

  // Accuracy upgrade: discard old low-quality translation cache once.
  try {
    const upgradeKey = 'cet4_translation_accuracy_upgrade_20260907_v2';
    if (!localStorage.getItem(upgradeKey)) {
      localStorage.removeItem('cet4_reader_translation_cache_v2');
      localStorage.setItem(upgradeKey, '1');
    }
  } catch (_) {}

  window.fetch = async function(input, init) {
    const q = extractMyMemoryQuery(input);
    if (q == null) return nativeFetch(input, init);

    const text = normalizeText(q);
    if (!text) return nativeFetch(input, init);

    if (isSingleWord(text)) {
      const dictionaryResult = await dictionaryLookup(text);
      if (dictionaryResult) return fakeTranslationResponse(dictionaryResult, '多词库常用义');
    }

    const result = await highQualityTranslate(text);
    if (result.translation) return fakeTranslationResponse(result.translation, result.engine);

    // Accuracy over availability: do NOT silently fall back to MyMemory.
    throw new Error('No high-quality translation engine is available in this browser.');
  };

  function getSentenceFromTarget(target) {
    const word = target?.closest?.('.word');
    const sentence = word?.closest?.('.sentence');
    return normalizeText(sentence?.dataset?.sentence || sentence?.textContent || '');
  }

  async function autoTranslateSentence(sentence) {
    sentence = normalizeText(sentence);
    if (!sentence || sentence.length < 2) return;
    const sentenceBox = document.getElementById('sentenceTranslation');
    const sentenceText = document.getElementById('sentenceTranslationText');
    if (!sentenceBox || !sentenceText) return;

    const key = sentence.toLowerCase();
    const token = ++lastAutoToken;

    // Let app.js finish rendering the lookup card first.
    await new Promise(resolve => setTimeout(resolve, 260));
    if (token !== lastAutoToken) return;

    if (contextCache[key]?.translation) {
      sentenceText.textContent = contextCache[key].translation;
      sentenceBox.classList.remove('hidden');
      return;
    }

    sentenceText.textContent = '正在结合上下文翻译本句…';
    sentenceBox.classList.remove('hidden');
    const result = await highQualityTranslate(sentence);
    if (token !== lastAutoToken) return;

    if (result.translation) {
      sentenceText.textContent = result.translation;
      sentenceText.title = `翻译引擎：${result.engine}`;
      contextCache[key] = { translation: result.translation, engine: result.engine, savedAt: Date.now() };
      const entries = Object.entries(contextCache);
      if (entries.length > 600) {
        entries.sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
        contextCache = Object.fromEntries(entries.slice(0, 450));
      }
      writeJSON(CONTEXT_CACHE_KEY, contextCache);
    } else {
      sentenceText.textContent = '当前浏览器没有可用的高精度翻译引擎。建议使用桌面版 Chrome 138 及以上打开本网站。';
      sentenceText.title = '';
    }
  }

  document.addEventListener('click', event => {
    const sentence = getSentenceFromTarget(event.target);
    if (sentence) autoTranslateSentence(sentence);
  });

  document.addEventListener('dblclick', event => {
    const sentence = getSentenceFromTarget(event.target);
    if (sentence) autoTranslateSentence(sentence);
  });

  document.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const node = selection.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode?.parentElement;
      const sentenceEl = node?.closest?.('.sentence');
      const sentence = normalizeText(sentenceEl?.dataset?.sentence || sentenceEl?.textContent || '');
      if (sentence) autoTranslateSentence(sentence);
    }, 60);
  });

  const style = document.createElement('style');
  style.textContent = '.translation{white-space:pre-line}.sentence-translation{white-space:normal}.sentence-translation #sentenceTranslationText{line-height:1.75}';
  document.head.appendChild(style);

  window.CET4TranslationEngine = {
    dictionaryReady: () => loadDictionary().then(map => map.size),
    hasChromeTranslator: () => 'Translator' in self,
    translate: highQualityTranslate,
    version: '2026.09-context-accuracy-v2'
  };
})();