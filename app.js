(() => {
  'use strict';

  const KEYS = {
    articles: 'cet4_reader_articles_v2',
    active: 'cet4_reader_active_v2',
    vocab: 'cet4_reader_vocab_v2',
    history: 'cet4_reader_history_v2',
    cache: 'cet4_reader_translation_cache_v2',
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
  let cache = readJSON(KEYS.cache, {});
  let lookupLog = readJSON(KEYS.lookupLog, []);
  let mistakes = readJSON(KEYS.mistakes, []);
  let scrolls = readJSON(KEYS.scrolls, {});
  let activeId = localStorage.getItem(KEYS.active) || '';
  let currentLookup = null;
  let activeWordSpan = null;
  let requestToken = 0;
  let fontSize = Number(localStorage.getItem(KEYS.font)) || 19;
  let clickTimer = null;
  let scrollSaveTimer = null;

  articles = articles.map(a => ({ category: '未分类', source: '', ...a }));
  document.documentElement.style.setProperty('--reader-font-size', fontSize + 'px');

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizeTerm(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/^[\s“”‘’'".,;:!?()\[\]{}—–-]+|[\s“”‘’'".,;:!?()\[\]{}—–-]+$/g, '')
      .trim();
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

  function decodeHtml(str) {
    const box = document.createElement('textarea');
    box.innerHTML = safeText(str);
    return box.value;
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
    const matches = safeText(text).match(/[^.!?]+[.!?]+(?:[”’"')\]]*)|[^.!?]+$/g);
    return matches && matches.length ? matches : [text];
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
    refreshArticleSelect();
    const item = activeArticle();
    articleEl.innerHTML = '';
    activeWordSpan = null;

    if (!item) {
      readerTitle.textContent = '尚未导入文章';
      readerMeta.innerHTML = '导入四级阅读后即可开始精读';
      articleEl.innerHTML = '<div class="empty"><strong>把你的四级阅读放进来</strong>长文章只在左侧独立滚动。单击或双击词汇查词，拖选多个词查短语；右侧可翻译整句、记生词和做错题。</div>';
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
    return text.length > 420 ? text.slice(0, 417) + '…' : text;
  }

  function cacheKey(term) { return normalizeTerm(term).toLowerCase(); }

  async function rawTranslate(term) {
    term = normalizeTerm(term);
    if (!term) throw new Error('empty');
    const key = cacheKey(term);
    if (cache[key]?.translation) return { translation: cache[key].translation, cached: true };
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(term) + '&langpair=en|zh-CN';
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    let translated = data?.responseData?.translatedText ? decodeHtml(data.responseData.translatedText).trim() : '';
    if (!translated) throw new Error('empty translation');
    cache[key] = { translation: translated, savedAt: Date.now() };
    const entries = Object.entries(cache);
    if (entries.length > 1200) {
      entries.sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
      cache = Object.fromEntries(entries.slice(0, 900));
    }
    writeJSON(KEYS.cache, cache);
    return { translation: translated, cached: false };
  }

  async function translateTerm(term, context = '', sourceSpan = null) {
    term = normalizeTerm(term);
    if (!term || !/[A-Za-z]/.test(term)) return;
    if (term.length > 450) {
      showLookup(term.slice(0, 100) + '…', '选择内容过长', '一次请选择一个单词、短语或较短句子。', context, false);
      return;
    }

    if (activeWordSpan && activeWordSpan !== sourceSpan) activeWordSpan.classList.remove('active');
    activeWordSpan = sourceSpan || null;
    if (activeWordSpan) activeWordSpan.classList.add('active');

    const myToken = ++requestToken;
    showLookup(term, '正在查询…', '连接在线翻译服务', context, false, true);
    try {
      const result = await rawTranslate(term);
      if (myToken !== requestToken) return;
      showLookup(term, result.translation, result.cached ? '本地缓存 · 无需再次联网' : '在线翻译 · 已缓存到本机', context, true);
      recordLookup(term, result.translation, context);
    } catch (_) {
      if (myToken !== requestToken) return;
      showLookup(term, '暂时没有查到中文', '网络或翻译服务当前不可用，请稍后再试。已经查过的词仍可从本地缓存读取。', context, false);
    }
  }

  function showLookup(term, translation, status, context, canSave, loading = false) {
    switchTab('lookup');
    currentLookup = {
      term,
      translation,
      context: context || '',
      articleId: activeArticle()?.id || '',
      articleTitle: activeArticle()?.title || ''
    };
    termEl.textContent = term;
    translationEl.textContent = translation;
    translationEl.classList.toggle('loading', loading);
    statusEl.textContent = status;
    sentenceTranslation.classList.add('hidden');
    sentenceTranslationText.textContent = '';
    if (context) {
      contextCard.classList.remove('hidden');
      contextEl.textContent = context;
      translateSentenceBtn.disabled = false;
    } else {
      contextCard.classList.add('hidden');
      contextEl.textContent = '';
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
    history = history.filter(x => safeText(x.term).toLowerCase() !== term.toLowerCase());
    history.unshift({ term, translation, context: context || '', time: now, article: activeArticle()?.title || '' });
    history = history.slice(0, 20);
    lookupLog.unshift({ term, translation, context: context || '', time: now, articleId: activeArticle()?.id || '', article: activeArticle()?.title || '' });
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
    card.addEventListener('click', () => showLookup(item.term, item.translation, label, item.context || '', true));
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
    else vocab.unshift({ ...currentLookup, time: Date.now(), article: activeArticle()?.title || '' });
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

  async function translateCurrentSentence() {
    const sentence = normalizeTerm(currentLookup?.context || '');
    if (!sentence) return;
    translateSentenceBtn.disabled = true;
    translateSentenceBtn.textContent = '翻译中…';
    sentenceTranslation.classList.remove('hidden');
    sentenceTranslationText.textContent = '正在翻译整句…';
    try {
      const result = await rawTranslate(sentence);
      sentenceTranslationText.textContent = result.translation;
      if (currentLookup) currentLookup.sentenceTranslation = result.translation;
    } catch (_) {
      sentenceTranslationText.textContent = '整句翻译暂时不可用，请稍后重试。';
    } finally {
      translateSentenceBtn.disabled = false;
      translateSentenceBtn.textContent = '译整句';
    }
  }

  function selectedReaderText() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !articleEl.contains(selection.anchorNode)) return '';
    return normalizeTerm(selection.toString());
  }

  function openMistakeDialog(prefill = '') {
    let text = normalizeTerm(prefill || selectedReaderText() || currentLookup?.context || currentLookup?.term || '');
    if (!text) {
      alert('请先在文章中选择一句话，或先查一个词。');
      return;
    }
    mistakeTextInput.value = text;
    mistakeCategoryInput.value = '长难句';
    mistakeNoteInput.value = '';
    mistakeDialog.showModal();
    setTimeout(() => mistakeNoteInput.focus(), 50);
  }

  function saveMistake() {
    const text = normalizeTerm(mistakeTextInput.value);
    if (!text) return false;
    const item = activeArticle();
    const existing = mistakes.find(m => m.articleId === (item?.id || '') && normalizeTerm(m.text) === text);
    if (existing) {
      existing.category = mistakeCategoryInput.value;
      existing.note = mistakeNoteInput.value.trim();
      existing.updatedAt = Date.now();
    } else {
      mistakes.unshift({
        id: uid(),
        text,
        category: mistakeCategoryInput.value,
        note: mistakeNoteInput.value.trim(),
        translation: currentLookup?.context && normalizeTerm(currentLookup.context) === text ? (currentLookup.sentenceTranslation || '') : '',
        articleId: item?.id || '',
        articleTitle: item?.title || '',
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
      card.addEventListener('click', () => showLookup(item.text, item.translation || '已记录为错题/难句', `错题本 · ${item.category}`, item.text, false));
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
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && normalizeTerm(selection.toString()).length > span.textContent.length + 1) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => translateTerm(span.dataset.word, getContext(span), span), 180);
  });

  articleEl.addEventListener('dblclick', event => {
    const span = event.target.closest('.word');
    if (!span) return;
    clearTimeout(clickTimer);
    translateTerm(span.dataset.word, getContext(span), span);
  });

  articleEl.addEventListener('mouseup', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !articleEl.contains(selection.anchorNode)) return;
      const term = normalizeTerm(selection.toString());
      if (!term || !/[A-Za-z]/.test(term)) return;
      if ((term.match(/\s+/g) || []).length >= 1) translateTerm(term, getContext(selection.anchorNode));
    }, 0);
  });

  articleEl.addEventListener('touchend', () => {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !articleEl.contains(selection.anchorNode)) return;
      const term = normalizeTerm(selection.toString());
      if (term && /[A-Za-z]/.test(term)) translateTerm(term, getContext(selection.anchorNode));
    }, 100);
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
    const term = normalizeTerm(searchInput.value);
    if (!term) return;
    translateTerm(term, '');
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
  translateSentenceBtn.addEventListener('click', translateCurrentSentence);
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
  if (!articles.length) setTimeout(() => openArticleDialog(false), 250);
})();