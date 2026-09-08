(() => {
  'use strict';

  const KEYS = {
    articles: 'cet4_reader_articles_v2',
    active: 'cet4_reader_active_v2',
    vocab: 'cet4_reader_vocab_v2',
    history: 'cet4_reader_history_v2',
    autoTranslate: 'cet4_reader_auto_translate_v4',
    font: 'cet4_reader_font_v2',
    lookupLog: 'cet4_reader_lookup_log_v3',
    mistakes: 'cet4_reader_mistakes_v3',
    scrolls: 'cet4_reader_scrolls_v3'
  };

  const $ = id => document.getElementById(id);
  const articleEl = $('article');
  const articleSelect = $('articleSelect');
  const readerTitle = $('readerTitle');
  const readerMeta = $('readerMeta');
  const readerScroll = $('readerScroll');
  const articleDialog = $('articleDialog');
  const articleForm = $('articleForm');
  const titleInput = $('articleTitleInput');
  const categoryInput = $('articleCategoryInput');
  const sourceInput = $('articleSourceInput');
  const textInput = $('articleTextInput');
  const mistakeDialog = $('mistakeDialog');
  const mistakeForm = $('mistakeForm');
  const mistakeTextInput = $('mistakeTextInput');
  const mistakeCategoryInput = $('mistakeCategoryInput');
  const mistakeNoteInput = $('mistakeNoteInput');
  const termEl = $('term');
  const translationEl = $('translation');
  const statusEl = $('status');
  const contextCard = $('contextCard');
  const contextEl = $('context');
  const sentenceTranslation = $('sentenceTranslation');
  const sentenceTranslationText = $('sentenceTranslationText');
  const saveBtn = $('saveBtn');
  const speakBtn = $('speakBtn');
  const translateSentenceBtn = $('translateSentenceBtn');
  const markMistakeBtn = $('markMistakeBtn');
  const searchInput = $('searchInput');
  const historyEl = $('history');
  const todayList = $('todayList');
  const todaySummary = $('todaySummary');
  const vocabList = $('vocabList');
  const vocabCount = $('vocabCount');
  const vocabSummary = $('vocabSummary');
  const mistakeList = $('mistakeList');
  const mistakeCount = $('mistakeCount');
  const mistakeFilter = $('mistakeFilter');
  const panels = {
    lookup: $('lookupPanel'),
    today: $('todayPanel'),
    vocab: $('vocabPanel'),
    mistake: $('mistakePanel')
  };
  const tabs = {
    lookup: $('lookupTab'),
    today: $('todayTab'),
    vocab: $('vocabTab'),
    mistake: $('mistakeTab')
  };

  let articles = readJSON(KEYS.articles, []);
  let vocab = readJSON(KEYS.vocab, []);
  let history = readJSON(KEYS.history, []);
  let lookupLog = readJSON(KEYS.lookupLog, []);
  let mistakes = readJSON(KEYS.mistakes, []);
  let scrolls = readJSON(KEYS.scrolls, {});
  let activeId = localStorage.getItem(KEYS.active) || '';
  let currentLookup = null;
  let activeWordSpan = null;
  let requestToken = 0;
  let lookupController = null;
  let sentenceController = null;
  let sentenceTimer = null;
  let sentenceRequest = 0;
  let fontSize = Number(localStorage.getItem(KEYS.font)) || 19;
  let clickTimer = null;
  let scrollSaveTimer = null;

  articles = (Array.isArray(articles) ? articles : []).filter(a => a && typeof a.text === 'string').map(a => ({ category: '未分类', source: '', ...a }));
  vocab = Array.isArray(vocab) ? vocab : [];
  history = Array.isArray(history) ? history : [];
  lookupLog = Array.isArray(lookupLog) ? lookupLog : [];
  mistakes = Array.isArray(mistakes) ? mistakes : [];
  scrolls = scrolls && typeof scrolls === 'object' && !Array.isArray(scrolls) ? scrolls : {};
  $('autoTranslate').checked = readJSON(KEYS.autoTranslate, true) !== false;
  document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { $('engineStatus').textContent = '浏览器存储空间不足或不可用，本次更改未保存。请保留当前页面。'; return false; }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizeTerm(value) {
    return window.CET4Text.normalize(value);
  }

  function safeText(text) { return String(text == null ? '' : text); }
  function countWords(text) { return (safeText(text).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length; }
  function activeArticle() { return articles.find(a => a.id === activeId) || null; }
  function dayKey(ts = Date.now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function refreshArticleSelect() {
    articleSelect.innerHTML = '';
    if (!articles.length) {
      const option = document.createElement('option');
      option.textContent = '暂无文章';
      option.value = '';
      articleSelect.appendChild(option);
      articleSelect.disabled = true;
      $('editBtn').disabled = true;
      return;
    }
    articleSelect.disabled = false;
    $('editBtn').disabled = false;
    for (const item of articles) {
      const option = document.createElement('option');
      option.value = item.id;
      const tag = item.category && item.category !== '未分类' ? `[${item.category}] ` : '';
      option.textContent = tag + item.title;
      if (item.id === activeId) option.selected = true;
      articleSelect.appendChild(option);
    }
  }

  function splitSentences(text) {
    return window.CET4Text.splitSentences(text);
  }

  function renderTokenized(text, parent) {
    const tokens = safeText(text).match(/[A-Za-z]+(?:['’-][A-Za-z]+)*|[^A-Za-z]+/g) || [text];
    for (const token of tokens) {
      if (/^[A-Za-z]/.test(token)) {
        const span = document.createElement('span');
        span.className = 'word';
        span.textContent = token;
        span.dataset.word = token;
        parent.appendChild(span);
      } else {
        parent.appendChild(document.createTextNode(token));
      }
    }
  }

  function renderActiveArticle() {
    clearTimeout(clickTimer);
    if (currentLookup) showLookup('', '点击文章中的单词，开始精读', '常用释义与整句译文分开显示。', '', false);
    refreshArticleSelect();
    const item = activeArticle();
    articleEl.innerHTML = '';
    activeWordSpan = null;

    if (!item) {
      readerTitle.textContent = '尚未导入文章';
      readerMeta.innerHTML = '导入四级阅读后即可开始精读';
      articleEl.innerHTML = '<div class="empty"><span class="empty-eyebrow">每天读懂一篇英语</span><strong>从一篇文章开始</strong><p>点击单词看释义，拖选短语查搭配。<br>结合完整句子理解，再把值得记忆的内容留下。</p><button id="emptyImport" class="btn primary" type="button">导入我的文章</button><button id="sampleArticle" class="btn" type="button">试读一篇示例</button><div class="notice">文章和学习记录保存在当前浏览器</div></div>';
      $('emptyImport').addEventListener('click', () => openArticleDialog(false));
      $('sampleArticle').addEventListener('click', () => {
        openArticleDialog(false);
        titleInput.value = '每日精读 · Small habits, lasting change';
        sourceInput.value = '原创练习示例';
        textInput.value = 'Small changes can make a lasting difference to the way we learn. Students often believe that progress depends on studying for hours without a break. In fact, a short period of focused practice every day may be more effective than a long session once a week.\n\nThe key is not simply to spend more time, but to pay attention to what we find difficult. When reading in English, for example, we should consider how a word is used in a sentence. A familiar word may have a different meaning in a new context. Looking up every word is less useful than understanding the main idea and returning to the important details.\n\nProgress is not always obvious from one day to the next. However, keeping a record of what we have learned can help us see how far we have come. A small habit, repeated with care, can become the foundation for lasting change.';
      });
      return;
    }

    readerTitle.textContent = item.title;
    const wc = countWords(item.text);
    readerMeta.innerHTML = '';
    const metaText = document.createElement('span');
    metaText.textContent = `${wc} 词`;
    readerMeta.appendChild(metaText);
    const categoryChip = document.createElement('span');
    categoryChip.className = 'chip';
    categoryChip.textContent = item.category || '未分类';
    readerMeta.appendChild(categoryChip);
    if (item.source) {
      const sourceChip = document.createElement('span');
      sourceChip.className = 'chip';
      sourceChip.textContent = item.source;
      readerMeta.appendChild(sourceChip);
    }

    const blocks = safeText(item.text).replace(/\r\n/g, '\n').split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
    const paragraphs = blocks.length ? blocks : [item.text.trim()];
    for (const block of paragraphs) {
      const p = document.createElement('p');
      for (const sentenceText of splitSentences(block)) {
        const s = document.createElement('span');
        s.className = 'sentence';
        s.dataset.sentence = sentenceText.replace(/\s+/g, ' ').trim();
        if (mistakes.some(m => m.articleId === item.id && normalizeTerm(m.text) === normalizeTerm(s.dataset.sentence))) s.classList.add('marked');
        renderTokenized(sentenceText, s);
        p.appendChild(s);
      }
      articleEl.appendChild(p);
    }
    requestAnimationFrame(() => { readerScroll.scrollTop = Number(scrolls[item.id]) || 0; });
  }

  function getContext(node) {
    const el = node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    const sentence = el?.closest?.('.sentence');
    if (sentence) return safeText(sentence.dataset.sentence || sentence.textContent).replace(/\s+/g, ' ').trim();
    const p = el?.closest?.('p');
    if (!p) return '';
    const text = p.textContent.replace(/\s+/g, ' ').trim();
    return text;
  }

  function cancelQueries() {
    ++requestToken;
    ++sentenceRequest;
    lookupController?.abort();
    sentenceController?.abort();
    clearTimeout(sentenceTimer);
  }

  async function translateTerm(term, context = '', sourceSpan = null, force = false, origin = null) {
    term = normalizeTerm(term);
    if (!term || !/[A-Za-z]/.test(term)) return;
    if (term.length > 3000) {
      showLookup(term.slice(0, 100) + '…', '选择内容过长', '一次请选择不超过 3,000 字符的单词、短语或句子。', '', false);
      return;
    }
    showLookup(term, '正在查询…', '正在查找释义', context, false, true, origin);
    activeWordSpan = sourceSpan || null;
    activeWordSpan?.classList.add('active');
    activeWordSpan?.closest('.sentence')?.classList.add('current-sentence');
    const myToken = requestToken;
    const lookup = currentLookup;
    lookupController = new AbortController();
    if (context && $('autoTranslate').checked && normalizeTerm(context) !== term) {
      sentenceTimer = setTimeout(() => translateCurrentSentence(false), 250);
    }
    try {
      const result = await window.CET4TranslationEngine.lookup(term, { signal: lookupController.signal, force });
      if (myToken !== requestToken || lookup !== currentLookup) return;
      lookup.translation = result.translation;
      lookup.engine = result.engine;
      translationEl.textContent = result.translation;
      statusEl.textContent = `${result.engine}${result.cached ? ' · 已缓存' : ''}${result.kind === 'dictionary' ? ' · 常用义项，请结合本句判断' : ' · 参考译文'}`;
      saveBtn.disabled = false;
      updateSaveButton();
      if (context && normalizeTerm(context) === term) {
        lookup.sentenceTranslation = result.translation;
        lookup.sentenceEngine = result.engine;
        renderSentenceResult(result);
      }
      recordLookup(term, result.translation, context);
    } catch (error) {
      if (myToken !== requestToken || error.name === 'AbortError') return;
      translationEl.textContent = '暂时无法完成查询';
      statusEl.textContent = '请重试；也可以在下方打开对照翻译。已下载的词典仍可查词。';
    } finally {
      if (myToken === requestToken) {
        translationEl.classList.remove('loading');
        $('retryLookup').classList.remove('hidden');
      }
    }
  }

  function showLookup(term, translation, status, context, canSave, loading = false, origin = null) {
    cancelQueries();
    activeWordSpan?.classList.remove('active');
    activeWordSpan = null;
    articleEl.querySelectorAll('.current-sentence').forEach(el => el.classList.remove('current-sentence'));
    switchTab('lookup');
    currentLookup = {
      term,
      translation,
      context: context || '',
      articleId: origin ? origin.articleId || '' : activeArticle()?.id || '',
      articleTitle: origin ? origin.articleTitle || origin.article || '' : activeArticle()?.title || ''
    };
    termEl.textContent = term || '选一个词';
    translationEl.textContent = translation;
    translationEl.classList.toggle('loading', loading);
    statusEl.textContent = status;
    $('retryLookup').classList.add('hidden');
    sentenceTranslation.classList.add('hidden');
    sentenceTranslationText.textContent = '';
    $('sentenceSource').textContent = '';
    translateSentenceBtn.textContent = '译整句';
    const compareText = context || term;
    $('compareBing').href = 'https://www.bing.com/translator?from=en&to=zh-Hans&text=' + encodeURIComponent(compareText);
    $('compareGoogle').href = 'https://translate.google.com/?sl=en&tl=zh-CN&text=' + encodeURIComponent(compareText) + '&op=translate';
    contextCard.querySelector('.context-label').textContent = context ? '所在完整句子' : '查询原文';
    if (context) {
      contextCard.classList.remove('hidden');
      contextEl.textContent = context;
      translateSentenceBtn.disabled = false;
    } else {
      contextCard.classList.toggle('hidden', !term);
      contextEl.textContent = term;
      translateSentenceBtn.disabled = true;
    }
    speakBtn.disabled = !term || !/[A-Za-z]/.test(term);
    saveBtn.disabled = !canSave;
    markMistakeBtn.disabled = !(context || term);
    updateSaveButton();
    $('sideScroll').scrollTop = 0;
  }

  function recordLookup(term, translation, context) {
    const now = Date.now();
    const entry = { ...currentLookup, term, translation, context: context || '', time: now, article: currentLookup?.articleTitle || '' };
    history = history.filter(x => safeText(x.term).toLowerCase() !== term.toLowerCase());
    history.unshift(entry);
    history = history.slice(0, 20);
    lookupLog.unshift({ ...entry });
    lookupLog = lookupLog.slice(0, 1200);
    writeJSON(KEYS.history, history);
    writeJSON(KEYS.lookupLog, lookupLog);
    renderHistory();
    renderToday();
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    if (!history.length) {
      historyEl.innerHTML = '<div class="status">还没有查询记录。</div>';
      return;
    }
    for (const item of history.slice(0, 8)) historyEl.appendChild(makeLookupCard(item, '历史查询'));
  }

  function makeLookupCard(item, label) {
    const card = document.createElement('div');
    card.className = 'card';
    const en = document.createElement('div');
    en.className = 'card-title';
    en.textContent = item.term;
    const zh = document.createElement('div');
    zh.className = 'card-sub';
    zh.textContent = item.translation;
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.textContent = item.article ? `${label} · ${item.article}` : label;
    card.append(en, zh, meta);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    const open = () => {
      showLookup(item.term, item.translation, `${label}${item.engine ? ' · ' + item.engine : ''}`, item.context || '', true, false, item);
      currentLookup.engine = item.engine || '';
      $('retryLookup').classList.remove('hidden');
      if (item.sentenceTranslation) {
        currentLookup.sentenceTranslation = item.sentenceTranslation;
        currentLookup.sentenceEngine = item.sentenceEngine || '';
        renderSentenceResult({ translation: item.sentenceTranslation, engine: item.sentenceEngine || '已保存译文' });
      }
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    return card;
  }

  function renderToday() {
    const today = dayKey();
    const recent = lookupLog.filter(x => dayKey(x.time) === today);
    const map = new Map();
    for (const item of recent) {
      const key = safeText(item.term).toLowerCase();
      if (!map.has(key)) map.set(key, item);
    }
    const items = [...map.values()];
    $('todayTab').innerHTML = `今日 <span>(${items.length})</span>`;
    todaySummary.textContent = `今天查过 ${items.length} 个不同的单词/短语，共查询 ${recent.length} 次`;
    todayList.innerHTML = '';
    if (!items.length) {
      todayList.innerHTML = '<div class="status">今天还没有查词。你查过的词会自动出现在这里，不需要手动收藏。</div>';
      return;
    }
    for (const item of items) todayList.appendChild(makeLookupCard(item, new Date(item.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })));
  }

  function vocabHas(term) { return vocab.some(x => safeText(x.term).toLowerCase() === safeText(term).toLowerCase()); }

  function updateSaveButton() {
    if (!currentLookup || saveBtn.disabled) {
      saveBtn.classList.remove('saved');
      saveBtn.textContent = '＋ 加入生词本';
      return;
    }
    const saved = vocabHas(currentLookup.term);
    saveBtn.classList.toggle('saved', saved);
    saveBtn.textContent = saved ? '✓ 已加入生词本' : '＋ 加入生词本';
  }

  function toggleVocabCurrent() {
    if (!currentLookup || saveBtn.disabled) return;
    const key = currentLookup.term.toLowerCase();
    const idx = vocab.findIndex(x => safeText(x.term).toLowerCase() === key);
    if (idx >= 0) vocab.splice(idx, 1);
    else vocab.unshift({ ...currentLookup, time: Date.now(), article: currentLookup.articleTitle || '' });
    writeJSON(KEYS.vocab, vocab);
    renderVocab();
    updateSaveButton();
  }

  function renderVocab() {
    vocabCount.textContent = vocab.length ? `(${vocab.length})` : '';
    vocabSummary.textContent = `${vocab.length} 个已收藏生词`;
    vocabList.innerHTML = '';
    if (!vocab.length) {
      vocabList.innerHTML = '<div class="status">生词本还是空的。需要长期记忆的词再手动加入即可；每天查过的词会自动记录在“今日”。</div>';
      return;
    }
    for (const item of vocab) vocabList.appendChild(makeLookupCard(item, item.article ? `生词本 · ${item.article}` : '生词本'));
  }

  function switchTab(name) {
    Object.keys(panels).forEach(key => {
      panels[key].classList.toggle('hidden', key !== name);
      tabs[key].classList.toggle('active', key === name);
    });
  }

  function renderSentenceResult(result) {
    sentenceTranslation.classList.remove('hidden');
    sentenceTranslationText.textContent = result.translation;
    $('sentenceSource').textContent = `${result.engine || '参考译文'}${result.cached ? ' · 已缓存' : ''}`;
  }

  async function translateCurrentSentence(force = false) {
    const lookup = currentLookup;
    const sentence = normalizeTerm(lookup?.context || '');
    if (!sentence) return;
    clearTimeout(sentenceTimer);
    sentenceController?.abort();
    const controller = new AbortController();
    sentenceController = controller;
    const sentenceId = ++sentenceRequest;
    const token = requestToken;
    const stillCurrent = () => token === requestToken && sentenceId === sentenceRequest && lookup === currentLookup;
    translateSentenceBtn.disabled = true;
    translateSentenceBtn.textContent = '翻译中…';
    sentenceTranslation.classList.remove('hidden');
    sentenceTranslationText.textContent = '正在翻译整句…';
    $('sentenceSource').textContent = '保留完整原句、标点和数字';
    try {
      const result = await window.CET4TranslationEngine.translate(sentence, { signal: controller.signal, force });
      if (!stillCurrent()) return;
      lookup.sentenceTranslation = result.translation;
      lookup.sentenceEngine = result.engine;
      renderSentenceResult(result);
      for (const [list, key] of [[history, KEYS.history], [lookupLog, KEYS.lookupLog], [vocab, KEYS.vocab]]) {
        let changed = false;
        for (const item of list) {
          if (item.term === lookup.term && item.context === lookup.context && item.articleId === lookup.articleId) {
            item.sentenceTranslation = result.translation;
            item.sentenceEngine = result.engine;
            changed = true;
          }
        }
        if (changed) writeJSON(key, list);
      }
    } catch (error) {
      if (!stillCurrent() || error.name === 'AbortError') return;
      if (lookup.sentenceTranslation) {
        renderSentenceResult({ translation: lookup.sentenceTranslation, engine: lookup.sentenceEngine });
        $('sentenceSource').textContent += ' · 本次重译失败，保留上次译文';
      } else {
        sentenceTranslationText.textContent = '暂时无法翻译本句，请重试或使用下方对照翻译。';
        $('sentenceSource').textContent = '本机模型或在线服务当前不可用';
      }
    } finally {
      if (stillCurrent()) {
        translateSentenceBtn.disabled = false;
        translateSentenceBtn.textContent = lookup.sentenceTranslation ? '重新译整句' : '重试整句';
      }
    }
  }

  function selectedReaderText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !articleEl.contains(selection.anchorNode) || !articleEl.contains(selection.focusNode)) return '';
    return normalizeTerm(selection.toString());
  }

  function openMistakeDialog(prefill = '') {
    let text = normalizeTerm(prefill || selectedReaderText() || currentLookup?.context || currentLookup?.term || '');
    if (!text) {
      alert('请先在文章中选择一句话，或先查一个词。');
      return;
    }
    mistakeTextInput.value = text;
    const origin = currentLookup && (text === currentLookup.context || text === currentLookup.term) ? currentLookup : null;
    mistakeForm.dataset.articleId = origin ? origin.articleId : activeArticle()?.id || '';
    mistakeForm.dataset.articleTitle = origin ? origin.articleTitle : activeArticle()?.title || '';
    mistakeForm.dataset.translation = origin?.context === text ? origin.sentenceTranslation || '' : '';
    mistakeCategoryInput.value = '长难句';
    mistakeNoteInput.value = '';
    mistakeDialog.showModal();
    setTimeout(() => mistakeNoteInput.focus(), 50);
  }

  function saveMistake() {
    const text = normalizeTerm(mistakeTextInput.value);
    if (!text) return false;
    const originId = mistakeForm.dataset.articleId || '';
    const completedTranslation = currentLookup?.articleId === originId && currentLookup?.context === text
      ? currentLookup.sentenceTranslation || mistakeForm.dataset.translation || ''
      : mistakeForm.dataset.translation || '';
    const existing = mistakes.find(m => m.articleId === originId && normalizeTerm(m.text) === text);
    if (existing) {
      existing.category = mistakeCategoryInput.value;
      existing.note = mistakeNoteInput.value.trim();
      existing.updatedAt = Date.now();
      if (completedTranslation) existing.translation = completedTranslation;
    } else {
      mistakes.unshift({
        id: uid(),
        text,
        category: mistakeCategoryInput.value,
        note: mistakeNoteInput.value.trim(),
        translation: completedTranslation,
        articleId: originId,
        articleTitle: mistakeForm.dataset.articleTitle || '',
        createdAt: Date.now()
      });
    }
    mistakes = mistakes.slice(0, 500);
    writeJSON(KEYS.mistakes, mistakes);
    renderMistakes();
    renderActiveArticle();
    return true;
  }

  function renderMistakes() {
    const filter = mistakeFilter.value || '全部';
    const items = mistakes.filter(m => filter === '全部' || m.category === filter);
    mistakeCount.textContent = mistakes.length ? `(${mistakes.length})` : '';
    $('mistakeSummary').textContent = `${mistakes.length} 条错题/难句记录`;
    mistakeList.innerHTML = '';
    if (!items.length) {
      mistakeList.innerHTML = '<div class="status">这里还没有记录。选中难句或查词后点击“记错题/难句”，并标注是词汇、长难句、定位、推理等问题。</div>';
      return;
    }
    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'card';
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = item.text.length > 110 ? item.text.slice(0, 107) + '…' : item.text;
      const sub = document.createElement('div');
      sub.className = 'card-sub';
      sub.textContent = item.note || '未填写复盘备注';
      const meta = document.createElement('div');
      meta.className = 'card-meta';
      const tag = document.createElement('span');
      tag.className = 'chip';
      tag.textContent = item.category;
      const source = document.createElement('span');
      source.textContent = item.articleTitle || '未关联文章';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-btn';
      del.textContent = '删除';
      del.addEventListener('click', e => {
        e.stopPropagation();
        mistakes = mistakes.filter(m => m.id !== item.id);
        writeJSON(KEYS.mistakes, mistakes);
        renderMistakes();
        renderActiveArticle();
      });
      meta.append(tag, source, del);
      card.append(title, sub, meta);
      card.addEventListener('click', () => {
        showLookup(item.text, item.note || '已记录为错题/难句', `错题本 · ${item.category}`, item.text, false, false, item);
        if (item.translation) {
          currentLookup.sentenceTranslation = item.translation;
          renderSentenceResult({ translation: item.translation, engine: '已保存译文' });
        }
      });
      mistakeList.appendChild(card);
    }
  }

  function openArticleDialog(edit = false) {
    const item = edit ? activeArticle() : null;
    articleForm.dataset.editId = item?.id || '';
    titleInput.value = item?.title || '';
    categoryInput.value = item?.category || '仔细阅读';
    sourceInput.value = item?.source || '';
    textInput.value = item?.text || '';
    $('deleteArticleBtn').classList.toggle('hidden', !item);
    $('articleDialogTitle').textContent = item ? '编辑文章与分类' : '导入一篇英语文章';
    articleDialog.showModal();
    setTimeout(() => (item ? textInput : titleInput).focus(), 40);
  }

  function saveArticle() {
    const text = textInput.value.trim();
    let title = titleInput.value.trim();
    if (!text) { alert('请先粘贴英文文章。'); return false; }
    if (!title) title = '英语精读 ' + new Date().toLocaleDateString('zh-CN');
    const editId = articleForm.dataset.editId;
    if (editId) {
      const idx = articles.findIndex(a => a.id === editId);
      if (idx >= 0) articles[idx] = { ...articles[idx], title, text, category: categoryInput.value, source: sourceInput.value.trim(), updatedAt: Date.now() };
      activeId = editId;
    } else {
      const item = { id: uid(), title, text, category: categoryInput.value, source: sourceInput.value.trim(), createdAt: Date.now() };
      articles.unshift(item);
      articles = articles.slice(0, 60);
      activeId = item.id;
    }
    writeJSON(KEYS.articles, articles);
    localStorage.setItem(KEYS.active, activeId);
    renderActiveArticle();
    return true;
  }

  function deleteActiveArticle() {
    const item = activeArticle();
    if (!item || !confirm(`确定删除“${item.title}”吗？`)) return;
    articles = articles.filter(a => a.id !== item.id);
    delete scrolls[item.id];
    mistakes = mistakes.map(m => m.articleId === item.id ? { ...m, articleId: '', articleTitle: item.title } : m);
    activeId = articles[0]?.id || '';
    writeJSON(KEYS.articles, articles);
    writeJSON(KEYS.scrolls, scrolls);
    writeJSON(KEYS.mistakes, mistakes);
    localStorage.setItem(KEYS.active, activeId);
    articleDialog.close();
    renderActiveArticle();
    renderMistakes();
  }

  articleEl.addEventListener('click', event => {
    const span = event.target.closest('.word');
    if (!span) return;
    window.CET4TranslationEngine.prepare();
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && normalizeTerm(selection.toString()).length > span.textContent.length + 1) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => translateTerm(span.dataset.word, getContext(span), span), 180);
  });

  articleEl.addEventListener('dblclick', event => {
    const span = event.target.closest('.word');
    if (!span) return;
    window.CET4TranslationEngine.prepare();
    clearTimeout(clickTimer);
    translateTerm(span.dataset.word, getContext(span), span);
  });

  function querySelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !articleEl.contains(selection.anchorNode) || !articleEl.contains(selection.focusNode)) return;
    const term = normalizeTerm(selection.toString());
    if (!term || !/[A-Za-z]/.test(term) || !/\s/.test(term)) return;
    clearTimeout(clickTimer);
    const range = selection.getRangeAt(0);
    const sentences = [...articleEl.querySelectorAll('.sentence')].filter(el => range.intersectsNode(el));
    const context = normalizeTerm(sentences.map(el => el.dataset.sentence).join(' '));
    if (currentLookup?.term === term && currentLookup?.context === context) return;
    translateTerm(term, context);
  }

  articleEl.addEventListener('mouseup', () => {
    window.CET4TranslationEngine.prepare();
    setTimeout(() => {
      querySelection();
    }, 0);
  });

  articleEl.addEventListener('touchend', () => {
    window.CET4TranslationEngine.prepare();
    setTimeout(querySelection, 100);
  });

  readerScroll.addEventListener('scroll', () => {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
      if (!activeId) return;
      scrolls[activeId] = readerScroll.scrollTop;
      writeJSON(KEYS.scrolls, scrolls);
    }, 180);
  });

  $('searchForm').addEventListener('submit', event => {
    event.preventDefault();
    window.CET4TranslationEngine.prepare();
    const term = normalizeTerm(searchInput.value);
    if (!term) return;
    translateTerm(term, '', null, false, { articleId: '', articleTitle: '' });
    searchInput.select();
  });

  speakBtn.addEventListener('click', () => {
    if (!currentLookup || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(currentLookup.term);
    utter.lang = 'en-US';
    utter.rate = .88;
    speechSynthesis.speak(utter);
  });

  saveBtn.addEventListener('click', toggleVocabCurrent);
  translateSentenceBtn.addEventListener('click', () => {
    window.CET4TranslationEngine.prepare();
    translateCurrentSentence(true);
  });
  $('retryLookup').addEventListener('click', () => {
    if (!currentLookup?.term) return;
    window.CET4TranslationEngine.prepare();
    translateTerm(currentLookup.term, currentLookup.context, activeWordSpan, true, currentLookup);
  });
  $('autoTranslate').addEventListener('change', () => {
    writeJSON(KEYS.autoTranslate, $('autoTranslate').checked);
    if ($('autoTranslate').checked) {
      window.CET4TranslationEngine.prepare();
      translateCurrentSentence(false);
    } else {
      clearTimeout(sentenceTimer);
      ++sentenceRequest;
      sentenceController?.abort();
      translateSentenceBtn.disabled = !currentLookup?.context;
      translateSentenceBtn.textContent = '译整句';
      if (!currentLookup?.sentenceTranslation) sentenceTranslation.classList.add('hidden');
    }
  });
  $('prepareTranslator').addEventListener('click', () => window.CET4TranslationEngine.prepare());
  window.addEventListener('cet4-engine-status', event => {
    const detail = event.detail;
    const messages = {
      unavailable: '本机翻译暂不可用，将尝试在线翻译',
      preparing: '正在准备本机翻译，首次使用可能需要下载模型',
      downloading: `正在下载本机翻译模型 ${Math.round((detail?.progress || 0) * 100)}%`,
      ready: '本机翻译已就绪 · 整句可在浏览器中翻译'
    };
    $('engineStatus').textContent = typeof detail === 'string' ? detail : detail?.message || messages[detail?.status] || '词典释义优先 · 完整句子辅助理解';
    if (detail?.status === 'ready') {
      $('prepareTranslator').textContent = '本机翻译已启用';
      $('prepareTranslator').disabled = true;
    }
  });
  markMistakeBtn.addEventListener('click', () => openMistakeDialog());
  $('markReaderBtn').addEventListener('click', () => openMistakeDialog());

  Object.entries(tabs).forEach(([name, el]) => el.addEventListener('click', () => switchTab(name)));
  mistakeFilter.addEventListener('change', renderMistakes);

  $('clearVocab').addEventListener('click', () => {
    if (vocab.length && confirm('确定清空整个生词本吗？')) {
      vocab = [];
      writeJSON(KEYS.vocab, vocab);
      renderVocab();
      updateSaveButton();
    }
  });

  $('clearMistakes').addEventListener('click', () => {
    if (mistakes.length && confirm('确定清空全部错题/难句记录吗？')) {
      mistakes = [];
      writeJSON(KEYS.mistakes, mistakes);
      renderMistakes();
      renderActiveArticle();
    }
  });

  $('importBtn').addEventListener('click', () => openArticleDialog(false));
  $('editBtn').addEventListener('click', () => openArticleDialog(true));
  $('cancelDialog').addEventListener('click', () => articleDialog.close());
  $('deleteArticleBtn').addEventListener('click', deleteActiveArticle);
  articleForm.addEventListener('submit', event => {
    event.preventDefault();
    if (saveArticle()) articleDialog.close();
  });

  $('cancelMistakeDialog').addEventListener('click', () => mistakeDialog.close());
  mistakeForm.addEventListener('submit', event => {
    event.preventDefault();
    if (saveMistake()) mistakeDialog.close();
  });

  articleSelect.addEventListener('change', () => {
    clearTimeout(scrollSaveTimer);
    if (activeId) {
      scrolls[activeId] = readerScroll.scrollTop;
      writeJSON(KEYS.scrolls, scrolls);
    }
    activeId = articleSelect.value;
    localStorage.setItem(KEYS.active, activeId);
    renderActiveArticle();
  });

  $('fontDown').addEventListener('click', () => {
    fontSize = Math.max(15, fontSize - 1);
    document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');
    localStorage.setItem(KEYS.font, String(fontSize));
  });
  $('fontUp').addEventListener('click', () => {
    fontSize = Math.min(28, fontSize + 1);
    document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');
    localStorage.setItem(KEYS.font, String(fontSize));
  });

  // CET-4 reading timer
  const timerMode = $('timerMode');
  const timerDisplay = $('timerDisplay');
  const timerStart = $('timerStart');
  const timerReset = $('timerReset');
  let timerRemaining = Number(timerMode.value) || 600;
  let timerInterval = null;
  let timerDeadline = 0;

  function formatTimer(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function renderTimer() {
    timerDisplay.textContent = formatTimer(timerRemaining);
    timerDisplay.classList.toggle('running', !!timerInterval);
    timerDisplay.classList.toggle('done', timerRemaining <= 0);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerStart.textContent = timerRemaining <= 0 ? '重新开始' : '开始';
    renderTimer();
  }

  function tickTimer() {
    timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    renderTimer();
    if (timerRemaining <= 0) {
      stopTimer();
      timerStart.textContent = '重新开始';
      document.title = '时间到｜CET-4 精读划词助手';
      setTimeout(() => { document.title = 'CET-4 精读划词助手'; }, 5000);
    }
  }

  timerStart.addEventListener('click', () => {
    if (timerInterval) {
      timerRemaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      stopTimer();
      return;
    }
    if (timerRemaining <= 0) timerRemaining = Number(timerMode.value) || 600;
    timerDeadline = Date.now() + timerRemaining * 1000;
    timerStart.textContent = '暂停';
    timerInterval = setInterval(tickTimer, 250);
    tickTimer();
  });

  timerReset.addEventListener('click', () => {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerRemaining = Number(timerMode.value) || 600;
    timerStart.textContent = '开始';
    renderTimer();
  });

  timerMode.addEventListener('change', () => timerReset.click());

  if (articles.length && !activeArticle()) activeId = articles[0].id;
  if (activeId) localStorage.setItem(KEYS.active, activeId);
  writeJSON(KEYS.articles, articles);
  renderActiveArticle();
  renderHistory();
  renderToday();
  renderVocab();
  renderMistakes();
  renderTimer();
  if (!('Translator' in window)) {
    $('prepareTranslator').classList.add('hidden');
    $('engineStatus').textContent = '词典在本机查询 · 句译使用在线服务';
  }
  window.CET4TranslationEngine.dictionaryReady().catch(() => {});
})();
