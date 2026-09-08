'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'translation-engine.js'), 'utf8');
const google = 'https://translate.googleapis.com/';
const entry = (trans, ukphone = '') => ({ trans, ukphone, usphone: '' });
const response = data => ({ ok: true, json: async () => data });
const googleResponse = (text, translation = '这是完整的中文译文。') =>
  response([[[translation, text, null, null, 10]], null, 'en']);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function harness({ dict = { nature: entry(['n. 自然；本性']) }, remote, Translator, storage, timerLimit } = {}) {
  const calls = [];
  const events = [];
  const values = storage || new Map();
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url === 'data/dictionary.json') {
      if (dict instanceof Error) throw dict;
      return response(dict);
    }
    if (!remote) throw new Error('Unexpected remote request: ' + url);
    return remote(url, options, calls);
  };
  const window = { fetch, Translator, dispatchEvent: event => events.push(event) };
  const context = {
    window, AbortController, URL,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    localStorage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    },
    setTimeout: (fn, ms) => setTimeout(fn, timerLimit ? Math.min(ms, timerLimit) : ms),
    clearTimeout
  };
  vm.runInNewContext(code, context);
  return { engine: window.CET4TranslationEngine, window, fetch, calls, events, values };
}

test('loading the engine does not hijack fetch or cause background requests', () => {
  const h = harness();
  assert.equal(h.window.fetch, h.fetch);
  assert.equal(h.calls.length, 0);
  assert.equal(typeof h.engine.lookup, 'function');
  assert.equal(typeof h.engine.translate, 'function');
});

test('full dictionary meanings and exact forms outrank embedded fallback and lemmas', async () => {
  const h = harness({ dict: {
    nature: entry(['n. 自然；本性；种类；性质'], 'ˈneɪtʃə'),
    people: entry(['n. 人们；民族；平民']),
    person: entry(['n. 个人']),
    gardening: entry(['n. 园艺；园艺活动']),
    garden: entry(['n. 花园'])
  } });
  const nature = await h.engine.lookup('nature');
  assert.equal(nature.kind, 'dictionary');
  assert.equal(nature.engine, 'ECDICT 学习词典');
  assert.match(nature.translation, /种类；性质/);
  assert.match(nature.translation, /英 \//);
  assert.doesNotMatch(nature.translation, /美 \//);
  assert.equal((await h.engine.lookup('people')).headword, 'people');
  assert.equal((await h.engine.lookup('gardening')).headword, 'gardening');
  assert.equal(h.calls.length, 1);
});

test('ambiguous saw, axes and does retain exact entries and explain alternatives', async () => {
  const h = harness({ dict: {
    saw: entry(['n. 锯']), see: entry(['v. 看见']),
    axes: entry(['n. 轴的复数']), axe: entry(['n. 斧']), ax: entry(['n. 斧']),
    does: entry(['v. do 的第三人称单数']), doe: entry(['n. 雌鹿'])
  } });
  for (const word of ['saw', 'axes', 'does']) {
    const result = await h.engine.lookup(word);
    assert.equal(result.headword, word);
    assert.match(result.translation, /词形提示/);
    assert.doesNotMatch(result.translation, /^词形还原/);
  }
  assert.match((await h.engine.lookup('axes')).translation, /axis/);
  assert.match((await h.engine.lookup('does')).translation, /doe/);
});

test('safe inflections are annotated and conflicting possible headwords are not guessed', async () => {
  const h = harness({ dict: {
    study: entry(['v. 学习']), run: entry(['v. 跑']), hope: entry(['v. 希望']), hop: entry(['v. 跳']),
    leaf: entry(['n. 叶子']), leave: entry(['v. 离开']), travel: entry(['v. 旅行'])
  } });
  assert.equal((await h.engine.lookup('studies')).headword, 'study');
  assert.equal((await h.engine.lookup('running')).headword, 'run');
  assert.equal((await h.engine.lookup('hoped')).headword, 'hope');
  assert.equal((await h.engine.lookup('travelled')).headword, 'travel');
  const ambiguous = await h.engine.lookup('leaves');
  assert.equal(ambiguous.headword, undefined);
  assert.match(ambiguous.translation, /可能的原形/);
  assert.match(ambiguous.translation, /leaf：/);
  assert.match(ambiguous.translation, /leave：/);
});

test('capitalized abbreviations remain distinct from ordinary pronouns', async () => {
  const h = harness({ dict: { us: entry(['pron. 我们']), it: entry(['pron. 它']) } });
  assert.match((await h.engine.lookup('US')).translation, /美国/);
  assert.equal((await h.engine.lookup('US')).headword, 'US');
  assert.match((await h.engine.lookup('IT')).translation, /信息技术/);
  assert.equal((await h.engine.lookup('us')).translation, '常用义：pron. 我们');
  assert.equal((await h.engine.lookup('it')).translation, '常用义：pron. 它');
});

test('dictionary failures preserve embedded offline lookup and permit forced recovery', async () => {
  const h = harness({ dict: new Error('offline') });
  assert.match((await h.engine.lookup('human')).translation, /人类/);
  assert.match((await h.engine.lookup('does')).translation, /do 的第三人称/);
  assert.equal(h.calls.length, 1);
  await h.engine.lookup('human', { force: true });
  assert.equal(h.calls.length, 2);
});

test('known phrase definitions are separate from full sentence translation', async () => {
  const h = harness({ remote: url => {
    const text = new URL(url).searchParams.get('q');
    return googleResponse(text, '因此，我们继续。');
  } });
  const phrase = await h.engine.lookup('as a result');
  assert.equal(phrase.kind, 'phrase');
  assert.equal(h.calls.length, 0);
  const sentence = await h.engine.lookup('As a result, we continue.');
  assert.equal(sentence.kind, 'translation');
  assert.equal(h.calls.length, 1);
  assert.equal(new URL(h.calls[0].url).searchParams.get('q'), 'As a result, we continue.');
});

test('Google sentence segments are all joined and punctuation, slashes and case are preserved', async () => {
  const source = 'US/UK policy changed. We agree.';
  const h = harness({ remote: url => {
    assert.equal(new URL(url).searchParams.get('q'), source);
    return response([[['美英政策发生了变化。', 'US/UK policy changed. '], ['我们同意。', 'We agree.']]]);
  } });
  const result = await h.engine.translate(source);
  assert.equal(result.translation, '美英政策发生了变化。我们同意。');
  assert.equal(result.engine, 'Google 在线翻译');
  assert.equal(result.cached, false);
});

test('duplicate callers share one request; canceling one does not cancel another', async () => {
  const remote = deferred();
  const h = harness({ remote: () => remote.promise });
  const firstAbort = new AbortController();
  const first = h.engine.translate('We agree.', { signal: firstAbort.signal });
  const second = h.engine.translate('We agree.');
  const rejected = assert.rejects(first, { code: 'ABORTED', name: 'AbortError' });
  await tick();
  assert.equal(h.calls.length, 1);
  firstAbort.abort();
  await rejected;
  assert.equal(h.calls[0].options.signal.aborted, false);
  remote.resolve(googleResponse('We agree.', '我们同意。'));
  assert.equal((await second).translation, '我们同意。');
  assert.equal(h.calls.length, 1);
});

test('canceling the last caller aborts transport and cannot cache its late answer', async () => {
  const remote = deferred();
  const h = harness({ remote: () => remote.promise });
  const controller = new AbortController();
  const pending = h.engine.translate('We agree.', { signal: controller.signal });
  const rejected = assert.rejects(pending, { code: 'ABORTED' });
  await tick();
  controller.abort();
  await rejected;
  assert.equal(h.calls[0].options.signal.aborted, true);
  remote.resolve(googleResponse('We agree.', '我们同意。'));
  await tick();
  assert.equal(h.values.size, 0);
});

test('sentence cache preserves case, survives reload, and supports forced refresh', async () => {
  let count = 0;
  const storage = new Map([['cet4_reader_books_v1', 'keep study data']]);
  const remote = url => {
    count += 1;
    return googleResponse(new URL(url).searchParams.get('q'), count === 1 ? '美国政策。' : '我们的政策。');
  };
  const h = harness({ remote, storage });
  await h.engine.translate('US policy');
  assert.equal((await h.engine.translate('US policy')).cached, true);
  await h.engine.translate('us policy');
  assert.equal(count, 2);
  await h.engine.translate('US policy', { force: true });
  assert.equal(count, 3);
  const restored = harness({ storage });
  assert.equal((await restored.engine.translate('US policy')).cached, true);
  assert.equal(storage.get('cet4_reader_books_v1'), 'keep study data');
});

test('invalid Google and Lingva content is rejected and never cached', async () => {
  for (const invalid of [
    'The original sentence.',
    '<html>服务器错误</html>',
    '翻译失败，请稍后重试。',
    'Error: 服务不可用',
    'Too many requests：请稍后重试'
  ]) {
    const h = harness({ remote: url => url.startsWith(google)
      ? googleResponse('The original sentence.', invalid)
      : response({ translation: invalid }) });
    await assert.rejects(h.engine.translate('The original sentence.'), { code: 'TRANSLATION_UNAVAILABLE' });
    assert.equal(h.values.size, 0);
    assert.equal(h.calls.length, 3);
  }
});

test('malformed Google segment cannot produce a partial cached translation', async () => {
  const h = harness({ remote: url => url.startsWith(google)
    ? response([[['第一句。', 'First sentence.'], [null, 'Second sentence.']]])
    : response({ translation: '翻译失败' }) });
  await assert.rejects(h.engine.translate('First sentence. Second sentence.'), { code: 'TRANSLATION_UNAVAILABLE' });
  assert.equal(h.values.size, 0);
});

test('a provider cannot silently omit the second sentence', async () => {
  const h = harness({ remote: url => url.startsWith(google)
    ? googleResponse('First sentence.', '第一句。')
    : response({ translation: '翻译失败' }) });
  await assert.rejects(h.engine.translate('First sentence. Second sentence.'), { code: 'TRANSLATION_UNAVAILABLE' });
  assert.equal(h.values.size, 0);
});

test('a 429 is not retried; valid fallback wins and its competing request is aborted', async () => {
  const linger = deferred();
  const h = harness({ remote: url => {
    if (url.startsWith(google)) return { ok: false, status: 429 };
    if (url.includes('plausibility')) return response({ translation: '雨停后工人们才返回。' });
    return linger.promise;
  } });
  const result = await h.engine.translate('Not until the rain stopped did the workers return.');
  assert.match(result.engine, /Lingva（translate\.plausibility\.cloud）/);
  assert.equal(h.calls.filter(call => call.url.startsWith(google)).length, 1);
  assert.equal(h.calls[2].options.signal.aborted, true);
  linger.resolve(response({ translation: '另一个译文。' }));
});

test('user retry can use remaining existing Lingva hosts after a complete provider failure', async () => {
  const h = harness({ remote: () => ({ ok: false, status: 503 }) });
  await assert.rejects(h.engine.translate('Hello there.'), { code: 'TRANSLATION_UNAVAILABLE' });
  await assert.rejects(h.engine.translate('Hello there.', { force: true }), { code: 'TRANSLATION_UNAVAILABLE' });
  const hosts = new Set(h.calls.filter(call => !call.url.startsWith(google)).map(call => new URL(call.url).host));
  assert.equal(hosts.size, 4);
});

test('prepare synchronously creates Chrome translator, emits monitor progress and retries failures', async () => {
  let attempts = 0;
  const instance = { translate: async () => '我们同意。' };
  const h = harness({ Translator: { create: options => {
    attempts += 1;
    assert.equal(options.sourceLanguage, 'en');
    assert.equal(options.targetLanguage, 'zh');
    options.monitor({ addEventListener: (type, cb) => { assert.equal(type, 'downloadprogress'); cb({ loaded: 0.5 }); } });
    return attempts === 1 ? Promise.reject(new Error('activation required')) : Promise.resolve(instance);
  } } });
  const failed = h.engine.prepare();
  assert.equal(attempts, 1);
  assert.equal(await failed, false);
  assert.equal(await h.engine.prepare(), true);
  assert.equal((await h.engine.translate('We agree.')).engine, 'Chrome 内置翻译');
  assert.equal(h.calls.length, 0);
  assert.equal(h.events.find(event => event.detail.status === 'downloading').detail.progress, 0.5);
  assert.equal(await h.engine.prepare(), true);
  assert.equal(attempts, 2);
});

test('model download never blocks a translation and late model creation is safely discarded', async () => {
  const creation = deferred();
  let destroyed = false;
  const h = harness({
    timerLimit: 8,
    Translator: { create: () => creation.promise },
    remote: url => googleResponse(new URL(url).searchParams.get('q'), '在线译文。')
  });
  const preparing = h.engine.prepare();
  const translated = await h.engine.translate('This is a sentence.');
  assert.equal(translated.engine, 'Google 在线翻译');
  assert.equal(await preparing, false);
  creation.resolve({ destroy: () => { destroyed = true; } });
  await tick();
  assert.equal(destroyed, true);
});

test('timeouts finish callers and abort every outstanding network request', async () => {
  const h = harness({ timerLimit: 10, remote: () => new Promise(() => {}) });
  await assert.rejects(h.engine.translate('This never completes.'), { code: 'TIMEOUT' });
  assert.ok(h.calls.length > 0);
  assert.ok(h.calls.every(call => call.options.signal.aborted));
});

test('empty, oversized and already aborted inputs never contact a provider', async () => {
  const h = harness();
  await assert.rejects(h.engine.translate(' '), { code: 'EMPTY_INPUT' });
  await assert.rejects(h.engine.lookup('x'.repeat(6001)), { code: 'TEXT_TOO_LONG' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.engine.lookup('nature', { signal: controller.signal }), { code: 'ABORTED' });
  assert.equal(h.calls.length, 0);
});
