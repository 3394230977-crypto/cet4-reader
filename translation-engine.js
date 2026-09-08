(() => {
  'use strict';

  const VERSION = '2026.09.08-accuracy-v4';
  const CACHE_KEY = 'cet4_reader_engine_cache_v4';
  const CACHE_LIMIT = 300;
  const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  const MAX_TEXT_LENGTH = 6000;
  const nativeFetch = window.fetch.bind(window);
  const LINGVA_INSTANCES = [
    'https://translate.plausibility.cloud',
    'https://lingva.lunar.icu',
    'https://translate.dr460nf1r3.org',
    'https://translate.jae.fi'
  ];

  // Safety net when the same-origin dictionary cannot be loaded.
const BASIC = {
    human: { phone: 'ˈhjuːmən', meanings: ['adj. 人的；人类的', 'n. 人；人类'] },
    nature: { phone: 'ˈneɪtʃər', meanings: ['n. 自然；大自然；本性'] },
    natural: { phone: 'ˈnætʃrəl', meanings: ['adj. 自然的；天然的；正常的'] },
    connection: { phone: 'kəˈnekʃn', meanings: ['n. 联系；连接；关联'] },
    connect: { phone: 'kəˈnekt', meanings: ['v. 连接；联系；把……关联起来'] },
    economic: { phone: 'ˌiːkəˈnɑːmɪk', meanings: ['adj. 经济的；经济学的'] },
    economy: { phone: 'ɪˈkɑːnəmi', meanings: ['n. 经济；节约'] },
    growth: { phone: 'ɡroʊθ', meanings: ['n. 增长；发展；生长'] },
    grow: { phone: 'ɡroʊ', meanings: ['v. 生长；增长；种植；逐渐变得'] },
    people: { phone: 'ˈpiːpl', meanings: ['n. 人们；人民'] },
    person: { phone: 'ˈpɜːrsn', meanings: ['n. 人；个人'] },
    public: { phone: 'ˈpʌblɪk', meanings: ['adj. 公共的；公众的', 'n. 公众'] },
    community: { phone: 'kəˈmjuːnəti', meanings: ['n. 社区；群体；共同体'] },
    climate: { phone: 'ˈklaɪmət', meanings: ['n. 气候；风气；环境'] },
    change: { phone: 'tʃeɪndʒ', meanings: ['n. 变化；改变', 'v. 改变；变化'] },
    species: { phone: 'ˈspiːʃiːz', meanings: ['n. 物种；种类'] },
    loss: { phone: 'lɔːs', meanings: ['n. 丧失；损失；损耗'] },
    benefit: { phone: 'ˈbenɪfɪt', meanings: ['n. 好处；益处', 'v. 使受益；得益于'] },
    cultivate: { phone: 'ˈkʌltɪveɪt', meanings: ['v. 耕种；栽培；培养；陶冶'] },
    cultivation: { phone: 'ˌkʌltɪˈveɪʃn', meanings: ['n. 耕种；栽培；培养'] },
    garden: { phone: 'ˈɡɑːrdn', meanings: ['n. 花园；菜园', 'v. 从事园艺'] },
    gardening: { phone: 'ˈɡɑːrdnɪŋ', meanings: ['n. 园艺；种植活动'] },
    land: { phone: 'lænd', meanings: ['n. 土地；陆地', 'v. 登陆；降落'] },
    soil: { phone: 'sɔɪl', meanings: ['n. 土壤；土地'] },
    food: { phone: 'fuːd', meanings: ['n. 食物；食品'] },
    plant: { phone: 'plænt', meanings: ['n. 植物；工厂', 'v. 种植；安置'] },
    material: { phone: 'məˈtɪriəl', meanings: ['n. 材料；资料', 'adj. 物质的；重要的'] },
    culture: { phone: 'ˈkʌltʃər', meanings: ['n. 文化；文明；培养'] },
    social: { phone: 'ˈsoʊʃl', meanings: ['adj. 社会的；社交的'] },
    urban: { phone: 'ˈɜːrbən', meanings: ['adj. 城市的；都市的'] },
    local: { phone: 'ˈloʊkl', meanings: ['adj. 当地的；本地的', 'n. 当地人'] },
    support: { phone: 'səˈpɔːrt', meanings: ['v. 支持；支撑；供养', 'n. 支持；支撑'] },
    provide: { phone: 'prəˈvaɪd', meanings: ['v. 提供；供应'] },
    allow: { phone: 'əˈlaʊ', meanings: ['v. 允许；使可能'] },
    possible: { phone: 'ˈpɑːsəbl', meanings: ['adj. 可能的；可行的'] },
    important: { phone: 'ɪmˈpɔːrtnt', meanings: ['adj. 重要的；有重大影响的'] },
    research: { phone: 'rɪˈsɜːrtʃ', meanings: ['n. 研究；调查', 'v. 研究；调查'] },
    researcher: { phone: 'rɪˈsɜːrtʃər', meanings: ['n. 研究人员'] },
    suggest: { phone: 'səˈdʒest', meanings: ['v. 建议；表明；暗示'] },
    increase: { phone: 'ɪnˈkriːs', meanings: ['v. 增加；增长', 'n. 增加；增长'] },
    reduce: { phone: 'rɪˈduːs', meanings: ['v. 减少；降低；使缩小'] },
    improve: { phone: 'ɪmˈpruːv', meanings: ['v. 改善；提高'] },
    respond: { phone: 'rɪˈspɑːnd', meanings: ['v. 回应；作出反应；应对'] },
    response: { phone: 'rɪˈspɑːns', meanings: ['n. 回应；反应；答复'] },
    practice: { phone: 'ˈpræktɪs', meanings: ['n. 实践；练习；惯例', 'v. 练习；实践'] },
    right: { phone: 'raɪt', meanings: ['n. 权利；右边', 'adj. 正确的；右边的', 'adv. 正好；向右'] },
    common: { phone: 'ˈkɑːmən', meanings: ['adj. 常见的；共同的；普通的'] },
    spread: { phone: 'spred', meanings: ['v. 传播；扩散；铺开', 'n. 传播；范围'] },
    movement: { phone: 'ˈmuːvmənt', meanings: ['n. 运动；活动；动作'] }
  };

  const PHRASES = Object.freeze({
    'as a result': '因此；结果',
    'as a result of': '由于；作为……的结果',
    'in terms of': '就……而言；在……方面',
    'in spite of': '尽管；不顾',
    'rather than': '而不是；与其……不如……',
    'instead of': '代替；而不是',
    'due to': '由于；因为',
    'owing to': '由于；因为',
    'according to': '根据；按照',
    'in addition to': '除……之外（还）',
    'in addition': '此外；而且',
    'for instance': '例如',
    'for example': '例如',
    'on the other hand': '另一方面',
    'on the contrary': '相反',
    'in contrast': '相比之下',
    'in particular': '尤其；特别',
    'in general': '一般来说；总体上',
    'take into account': '考虑到；把……纳入考虑',
    'take advantage of': '利用（机会、条件等）；占……的便宜',
    'play a role in': '在……中起作用',
    'be likely to': '很可能……',
    'be responsible for': '对……负责；是……的原因',
    'be aware of': '意识到；知道',
    'keep in mind': '记住；牢记',
    'make a difference': '产生影响；起作用',
    'a wide range of': '各种各样的；范围广泛的',
    'with regard to': '关于；就……而言',
    'regardless of': '不管；不顾',
    'by no means': '绝不；一点也不',
    'no longer': '不再',
    'in the long run': '从长远来看'
  });

  const FORM_NOTES = Object.freeze({
    saw: '也可作 see（看见）的过去式；需结合原句判断。',
    axes: '可作 axis（轴；轴线）或 axe / ax（斧）的复数；需结合原句判断。',
    does: '通常是 do 的第三人称单数；也可为 doe（雌鹿等）的复数。',
    left: '也可作 leave（离开；留下）的过去式或过去分词。',
    found: '也可作 find（发现）的过去式或过去分词。',
    lay: '也可作 lie（躺）的过去式；需结合原句判断。'
  });
  const ACRONYMS = Object.freeze({
    US: 'abbr. 美国（United States）；注意与代词 us（我们）的宾格区分。',
    USA: 'abbr. 美利坚合众国；美国（United States of America）。',
    UK: 'abbr. 英国；联合王国（United Kingdom）。',
    EU: 'abbr. 欧洲联盟；欧盟（European Union）。',
    UN: 'abbr. 联合国（United Nations）。',
    GDP: 'abbr. 国内生产总值（Gross Domestic Product）。',
    AI: 'abbr. 人工智能（Artificial Intelligence）。',
    IT: 'abbr. 信息技术（Information Technology）；注意与代词 it（它）区分。'
  });
  const AMBIGUOUS_FORMS = {
    saw: { trans: ['n. 锯；v. 锯', 'v. see（看见）的过去式'] },
    axes: { trans: ['n. axis（轴；轴线）的复数', 'n. axe / ax（斧）的复数'] },
    does: { trans: ['v. do 的第三人称单数', 'n. doe（雌鹿等）的复数'] }
  };
  const IRREGULAR = Object.freeze({
    am:'be', is:'be', are:'be', was:'be', were:'be', been:'be', being:'be',
    has:'have', had:'have', did:'do', done:'do',
    went:'go', gone:'go', came:'come', made:'make', took:'take', taken:'take',
    thought:'think', felt:'feel', knew:'know', known:'know', gave:'give', given:'give',
    seen:'see', wrote:'write', written:'write', grew:'grow', grown:'grow', ran:'run',
    began:'begin', begun:'begin', brought:'bring', bought:'buy', caught:'catch',
    taught:'teach', held:'hold', kept:'keep', lost:'lose', paid:'pay', said:'say',
    told:'tell', became:'become', built:'build', chose:'choose', chosen:'choose',
    drove:'drive', driven:'drive', children:'child', men:'man', women:'woman',
    mice:'mouse', feet:'foot', teeth:'tooth', geese:'goose',
    dying:'die', lying:'lie', tying:'tie', leaves:'leaf', lives:'life',
    wives:'wife', knives:'knife', wolves:'wolf', shelves:'shelf', halves:'half'
  });

  let dictionary = null;
  let dictionaryPromise = null;
  let dictionaryFailedAt = 0;
  let translator = null;
  let creation = null;
  let lingvaCursor = 0;
  const pending = new Map();
  const cache = new Map();

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    if (code === 'ABORTED') error.name = 'AbortError';
    return error;
  }
  function abortReason(signal) {
    return signal?.reason?.code && typeof signal.reason.code === 'string'
      ? signal.reason : fail('ABORTED', '查询已取消。');
  }
  function assertActive(signal) {
    if (signal?.aborted) throw abortReason(signal);
  }
  function normalize(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }
  function inputText(value) {
    const text = normalize(value);
    if (!text) throw fail('EMPTY_INPUT', '请先输入英文单词、短语或句子。');
    if (text.length > MAX_TEXT_LENGTH) throw fail('TEXT_TOO_LONG', '请将选中的文本控制在 6000 个字符以内。');
    return text;
  }
  function wordKey(value) {
    return normalize(value).toLowerCase().replace(/’/g, "'");
  }
  function isWord(value) {
    return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(value);
  }
  function validTranslation(value, original) {
    if (typeof value !== 'string') return false;
    const result = normalize(value);
    return result.length > 0
      && result.length <= Math.max(1600, original.length * 8)
      && /[\u3400-\u9fff]/.test(result)
      && result.toLowerCase() !== normalize(original).toLowerCase()
      && !/<\s*\/?\s*[a-z!][^>]*>/i.test(result)
      && !/\b(?:502 bad gateway|503 service unavailable|504 gateway time.?out|too many requests|rate limit(?:ed| exceeded)?|access denied|captcha|cloudflare|invalid api key)\b/i.test(result)
      && !/^(?:error\b|translation (?:failed|error)|翻译(?:失败|出错)|请求(?:失败|过于频繁)|服务(?:不可用|繁忙)|访问被拒绝)/i.test(result);
  }
  function status(state, extra = {}) {
    try {
      window.dispatchEvent(new CustomEvent('cet4-engine-status', {
        detail: { status: state, engine: 'Chrome 内置翻译', ...extra }
      }));
    } catch (_) { /* Status reporting must never interrupt a lookup. */ }
  }

  // Bound the fetch and body read, aborting the underlying operation on expiry.
  function bounded(operation, timeout, parentSignal) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let timer;
      let settled = false;
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        parentSignal?.removeEventListener('abort', cancel);
        controller.signal.removeEventListener('abort', aborted);
        if (error) reject(error);
        else resolve(value);
      }
      function cancel() { controller.abort(abortReason(parentSignal)); }
      function aborted() { finish(abortReason(controller.signal)); }
      controller.signal.addEventListener('abort', aborted, { once: true });
      if (parentSignal?.aborted) { cancel(); return; }
      parentSignal?.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => controller.abort(fail('TIMEOUT', '翻译服务响应超时，请重试。')), timeout);
      try {
        Promise.resolve(operation(controller.signal)).then(
          value => finish(null, value), error => finish(error)
        );
      } catch (error) { finish(error); }
    });
  }

  // Only stop this caller waiting; shared downloads and subscribers continue.
  function waitFor(promise, signal) {
    if (!signal) return promise;
    return new Promise((resolve, reject) => {
      function cancel() {
        signal.removeEventListener('abort', cancel);
        reject(abortReason(signal));
      }
      if (signal.aborted) { cancel(); return; }
      signal.addEventListener('abort', cancel, { once: true });
      promise.then(value => {
        signal.removeEventListener('abort', cancel);
        resolve(value);
      }, error => {
        signal.removeEventListener('abort', cancel);
        reject(error);
      });
    });
  }

  function loadDictionary(force = false) {
    if (dictionary) return Promise.resolve(dictionary);
    if (dictionaryPromise) return dictionaryPromise;
    if (!force && dictionaryFailedAt && Date.now() - dictionaryFailedAt < 10000) {
      return Promise.resolve(null);
    }
    dictionaryPromise = bounded(async signal => {
      const response = await nativeFetch('data/dictionary.json', {
        signal, cache: force ? 'reload' : 'default', credentials: 'same-origin'
      });
      if (!response.ok) throw fail('DICTIONARY_UNAVAILABLE', '本地词典暂时无法加载。');
      const entries = await response.json();
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
        throw fail('DICTIONARY_INVALID', '词典文件格式有误。');
      }
      const map = new Map();
      for (const [rawKey, item] of Object.entries(entries)) {
        if (!item || !Array.isArray(item.trans)) continue;
        const trans = [...new Set(item.trans.filter(value => typeof value === 'string')
          .map(normalize).filter(value => value && /[\u3400-\u9fff]/.test(value)))];
        if (!trans.length) continue;
        map.set(wordKey(rawKey), {
          trans,
          usphone: typeof item.usphone === 'string' ? item.usphone : '',
          ukphone: typeof item.ukphone === 'string' ? item.ukphone : ''
        });
      }
      if (!map.size) throw fail('DICTIONARY_INVALID', '词典文件为空。');
      return map;
    }, 5000).then(map => {
      dictionary = map;
      dictionaryFailedAt = 0;
      return map;
    }, () => {
      dictionaryFailedAt = Date.now();
      return null;
    }).finally(() => { dictionaryPromise = null; });
    return dictionaryPromise;
  }

  function basicEntry(key) {
    if (Object.hasOwn(AMBIGUOUS_FORMS, key)) return AMBIGUOUS_FORMS[key];
    if (!Object.hasOwn(BASIC, key)) return null;
    return { trans: BASIC[key].meanings, usphone: BASIC[key].phone };
  }
  function entryFor(map, key) {
    const full = map?.get(key);
    if (full) return { entry: full, source: 'ECDICT 学习词典' };
    const basic = basicEntry(key);
    return basic ? { entry: basic, source: '内置基础词典' } : null;
  }
  function inflections(word) {
    if (['news', 'series', 'species', 'means', 'physics', 'economics', 'mathematics', 'headquarters'].includes(word)) return [];
    const out = [];
    if (Object.hasOwn(IRREGULAR, word)) out.push(IRREGULAR[word]);
    if (word.endsWith("'s") && word.length > 3) out.push(word.slice(0, -2));
    if (/ies$/.test(word) && word.length > 4) out.push(word.slice(0, -3) + 'y');
    if (/s$/.test(word) && word.length > 3 && !/(ss|us|is)$/.test(word)) {
      out.push(word.slice(0, -1));
      if (/(?:s|x|z|ch|sh)es$/.test(word)) out.push(word.slice(0, -2));
    }
    if (/ied$/.test(word) && word.length > 4) out.push(word.slice(0, -3) + 'y');
    if (/(?:ing|ed)$/.test(word) && word.length > 4) {
      const stem = word.replace(/(?:ing|ed)$/, '');
      if (stem.length > 2) {
        out.push(stem + 'e');
        // A one-vowel CVC verb normally doubles its consonant: hop -> hopped,
        // not hoped; car must not become a candidate for caring.
        if (!/^[^aeiou]*[aeiou][bdgmnprt]$/.test(stem)) out.push(stem);
        if (/([bdglmnprt])\1$/.test(stem)) out.push(stem.slice(0, -1));
      }
    }
    return [...new Set(out)].filter(candidate => candidate !== word);
  }
  function formatEntry(requested, headword, hit) {
    const { entry, source } = hit;
    const lines = [];
    if (requested !== headword) lines.push('词形还原：' + headword + '（常用义，需结合原句判断）');
    if (entry.ukphone) lines.push('英 /' + entry.ukphone.replace(/^\/|\/$/g, '') + '/');
    if (entry.usphone) lines.push('美 /' + entry.usphone.replace(/^\/|\/$/g, '') + '/');
    lines.push('常用义：' + entry.trans.join('；'));
    if (Object.hasOwn(FORM_NOTES, requested)) lines.push('词形提示：' + FORM_NOTES[requested]);
    return { translation: lines.join('\n'), engine: source, kind: 'dictionary', headword };
  }
  async function dictionaryLookup(text, options) {
    const map = await waitFor(loadDictionary(options.force), options.signal);
    assertActive(options.signal);
    const word = wordKey(text);
    const exact = entryFor(map, word);
    if (exact) return formatEntry(word, word, exact);
    const hits = inflections(word).map(candidate => ({
      candidate, hit: entryFor(map, candidate)
    })).filter(item => {
      if (!item.hit) return false;
      if (!/(?:ing|ed)$/.test(word)) return true;
      const meanings = item.hit.entry.trans.join(' ');
      // A documented noun-only entry is not a base verb for -ed / -ing.
      return /(?:\bvi?\.?t?\.|\bvt\.|动词|动\.)/.test(meanings)
        || !/(?:\bn\.|\ba(?:dj)?\.|名词|形容词)/.test(meanings);
    });
    if (!hits.length) return null;
    if (hits.length === 1) return formatEntry(word, hits[0].candidate, hits[0].hit);
    // Ambiguous spellings must not silently choose a different word's meaning.
    return {
      translation: '可能的原形（需结合原句判断）：\n' + hits.map(({ candidate, hit }) =>
        candidate + '：' + hit.entry.trans.join('；')).join('\n'),
      engine: [...new Set(hits.map(item => item.hit.source))].join(' / '),
      kind: 'dictionary'
    };
  }

  // Call from a click or keyboard submit before awaiting any other work.
  // Official API: https://developer.chrome.com/docs/ai/translator-api
  function prepare() {
    if (translator) return Promise.resolve(true);
    if (creation) return creation.promise;
    if (!window.Translator || typeof window.Translator.create !== 'function') {
      status('unavailable');
      return Promise.resolve(false);
    }
    const attempt = {};
    creation = attempt;
    status('preparing');
    attempt.promise = bounded(async signal => {
      // bounded invokes this synchronously, preserving user activation.
      const ready = await window.Translator.create({
        sourceLanguage: 'en',
        targetLanguage: 'zh',
        signal,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', event => {
            if (creation !== attempt || signal.aborted) return;
            const progress = Math.max(0, Math.min(1, Number(event.loaded) || 0));
            status('downloading', { progress });
          });
        }
      });
      if (signal.aborted) {
        try { ready.destroy?.(); } catch (_) {}
        throw abortReason(signal);
      }
      return ready;
    }, 120000).then(ready => {
      translator = ready;
      status('ready');
      return true;
    }, error => {
      status(error.code === 'TIMEOUT' ? 'timeout' : 'unavailable', {
        message: error.code === 'TIMEOUT'
          ? '浏览器翻译模型准备超时，可再次点击重试。'
          : '浏览器翻译暂不可用，将尝试在线翻译。'
      });
      return false;
    }).finally(() => {
      if (creation === attempt) creation = null;
    });
    return attempt.promise;
  }

  async function chromeTranslate(text, signal) {
    if (!translator && creation) {
      try {
        // Downloading a model never holds a sentence request indefinitely.
        await bounded(() => creation.promise, 1000, signal);
      } catch (_) { assertActive(signal); }
    }
    if (!translator) return null;
    try {
      const translation = normalize(await bounded(
        innerSignal => translator.translate(text, { signal: innerSignal }), 4500, signal
      ));
      if (validTranslation(translation, text)) {
        return { translation, engine: 'Chrome 内置翻译' };
      }
    } catch (_) { assertActive(signal); }
    return null;
  }

  async function requestLingva(base, text, signal) {
    return bounded(async innerSignal => {
      const response = await nativeFetch(base + '/api/v1/en/zh/' + encodeURIComponent(text), {
        signal: innerSignal, cache: 'no-store', mode: 'cors', credentials: 'omit'
      });
      if (!response.ok) throw fail('PROVIDER_HTTP', '在线翻译服务暂时不可用。');
      const data = await response.json();
      if (data?.error || !validTranslation(data?.translation, text)) {
        throw fail('INVALID_TRANSLATION', '翻译服务没有返回有效的中文译文。');
      }
      return { translation: normalize(data.translation), engine: 'Lingva（' + new URL(base).hostname + '）' };
    }, 3500, signal);
  }
  async function googleTranslate(text, signal) {
    // Public web-client endpoint; availability is not guaranteed. Never retry a
    // rate-limited response automatically or treat service messages as a result.
    return bounded(async innerSignal => {
      const response = await nativeFetch(
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=' + encodeURIComponent(text),
        { signal: innerSignal, cache: 'no-store', mode: 'cors', credentials: 'omit' }
      );
      if (!response.ok) throw fail('PROVIDER_HTTP', '在线翻译服务暂时不可用。');
      const data = await response.json();
      const segments = data?.[0];
      if (!Array.isArray(segments) || !segments.length || segments.some(segment =>
        !Array.isArray(segment) || typeof segment[0] !== 'string'
        || typeof segment[1] !== 'string' || !segment[0].trim()
      )) throw fail('INVALID_TRANSLATION', '翻译服务返回的数据不完整。');
      if (normalize(segments.map(segment => segment[1]).join('')) !== text) {
        throw fail('INVALID_TRANSLATION', '翻译服务未返回完整原文对应的译文。');
      }
      const translation = normalize(segments.map(segment => segment[0]).join(''));
      if (!validTranslation(translation, text)) throw fail('INVALID_TRANSLATION', '未获得有效的中文译文。');
      return { translation, engine: 'Google 在线翻译' };
    }, 5000, signal);
  }
  async function lingvaTranslate(text, signal) {
    // Use two fallback hosts per request; a user retry tries the other pair.
    const index = lingvaCursor;
    lingvaCursor = (lingvaCursor + 2) % LINGVA_INSTANCES.length;
    {
      assertActive(signal);
      const group = new AbortController();
      const cancel = () => group.abort(abortReason(signal));
      signal.addEventListener('abort', cancel, { once: true });
      try {
        // The first valid result wins; failed responses cannot enter the cache.
        return await Promise.any(LINGVA_INSTANCES.slice(index, index + 2)
          .map(base => requestLingva(base, text, group.signal)));
      } catch (_) {
        assertActive(signal);
      } finally {
        signal.removeEventListener('abort', cancel);
        group.abort(fail('ABORTED', '备用请求已结束。'));
      }
    }
    throw fail('TRANSLATION_UNAVAILABLE', '当前翻译服务暂不可用，请稍后重试。词典查询仍可使用。');
  }
  async function runTranslation(text, signal) {
    const chrome = await chromeTranslate(text, signal);
    assertActive(signal);
    if (chrome) return chrome;
    try { return await googleTranslate(text, signal); }
    catch (_) { assertActive(signal); }
    return lingvaTranslate(text, signal);
  }

  function sourceKnown(engine) {
    return engine === 'Chrome 内置翻译' || engine === 'Google 在线翻译'
      || LINGVA_INSTANCES.some(base => engine === 'Lingva（' + new URL(base).hostname + '）');
  }
  function restoreCache() {
    try {
      const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (stored?.version !== VERSION || !Array.isArray(stored.entries)) return;
      for (const entry of stored.entries.slice(-CACHE_LIMIT)) {
        if (typeof entry?.text !== 'string' || !sourceKnown(entry.engine)
          || !validTranslation(entry.translation, entry.text)
          || !Number.isFinite(entry.savedAt) || entry.savedAt > Date.now()
          || Date.now() - entry.savedAt > CACHE_MAX_AGE) continue;
        cache.set(entry.text, entry);
      }
    } catch (_) { /* Private mode and full storage do not prevent translation. */ }
  }
  function saveCache(text, result) {
    cache.delete(text);
    cache.set(text, { text, ...result, savedAt: Date.now() });
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version: VERSION, entries: [...cache.values()] }));
    } catch (_) {}
  }
  function subscribe(task, signal) {
    task.subscribers += 1;
    return new Promise((resolve, reject) => {
      let finished = false;
      function finish(error, value) {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', cancel);
        task.subscribers -= 1;
        if (!task.settled && task.subscribers === 0) task.controller.abort(fail('ABORTED', '查询已取消。'));
        if (error) reject(error);
        else resolve({ ...value });
      }
      function cancel() { finish(abortReason(signal)); }
      if (signal?.aborted) { cancel(); return; }
      signal?.addEventListener('abort', cancel, { once: true });
      task.promise.then(value => finish(null, value), error => finish(error));
    });
  }

  async function translate(value, { signal, force = false } = {}) {
    assertActive(signal);
    const text = inputText(value); // Preserve case: "US" and "us" differ.
    const existing = cache.get(text);
    if (!force && existing && Date.now() - existing.savedAt <= CACHE_MAX_AGE) {
      return { translation: existing.translation, engine: existing.engine, cached: true };
    }
    let task = pending.get(text);
    if (!task || task.controller.signal.aborted) {
      task = { controller: new AbortController(), subscribers: 0, settled: false };
      pending.set(text, task);
      task.promise = Promise.resolve().then(() =>
        bounded(innerSignal => runTranslation(text, innerSignal), 15000, task.controller.signal)
      ).then(result => {
        assertActive(task.controller.signal);
        if (!validTranslation(result?.translation, text)) throw fail('INVALID_TRANSLATION', '未获得有效的中文译文。');
        saveCache(text, result);
        return { ...result, cached: false };
      }).finally(() => {
        task.settled = true;
        if (pending.get(text) === task) pending.delete(text);
      });
    }
    return subscribe(task, signal);
  }

  async function lookup(value, { signal, force = false } = {}) {
    assertActive(signal);
    const text = inputText(value);
    if (Object.hasOwn(ACRONYMS, text)) {
      return { translation: '常用义：' + ACRONYMS[text] + '\n具体含义需结合完整句子判断。', engine: '内置缩写词典', kind: 'dictionary', headword: text };
    }
    if (isWord(text)) {
      const hit = await dictionaryLookup(text, { signal, force });
      if (hit) return hit;
    } else {
      const phrase = PHRASES[wordKey(text)];
      if (typeof phrase === 'string') {
        return { translation: '常用义：' + phrase + '\n具体含义需结合完整句子判断。', engine: '内置常用搭配', kind: 'phrase' };
      }
    }
    return { ...await translate(text, { signal, force }), kind: 'translation' };
  }

  restoreCache();
  window.CET4TranslationEngine = Object.freeze({
    version: VERSION,
    prepare,
    lookup,
    translate,
    dictionaryReady: async () => {
      const map = await loadDictionary();
      return map ? map.size : Object.keys(BASIC).length + Object.keys(AMBIGUOUS_FORMS).length;
    }
  });
})();
