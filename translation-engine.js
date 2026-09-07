(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const VERSION = '2026.09-context-accuracy-v3';

  const SOURCES = [
    { file: 'PETS_3.json', label: '基础学习词典', rank: 0 },
    { file: 'CET4_T.json', label: 'CET-4', rank: 1 },
    { file: 'CET6_T.json', label: 'CET-6', rank: 2 },
    { file: 'NCE_3.json', label: '综合英语词典', rank: 3 },
    { file: 'GaoKao_3500.json', label: '高频基础词', rank: 4 },
    { file: 'raz-L.json', label: '扩展常用词典', rank: 5 },
    { file: '2024HongBao_T2.json', label: '扩展词义', rank: 6 }
  ];

  const RAW_ROOT = 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts/';
  const CDN_ROOT = 'https://cdn.jsdelivr.net/gh/RealKai42/qwerty-learner@master/public/dicts/';

  const LINGVA_INSTANCES = [
    'https://translate.plausibility.cloud',
    'https://lingva.lunar.icu',
    'https://translate.dr460nf1r3.org',
    'https://translate.jae.fi'
  ];

  // Small same-page safety net for very common CET reading words. This prevents a basic
  // word from becoming unqueryable just because a remote dictionary/CDN is unavailable.
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

  const sourcePromises = new Map();
  let chromeTranslatorPromise = null;
  let lastAutoToken = 0;
  let lastPhraseToken = 0;
  const CONTEXT_CACHE_KEY = 'cet4_reader_context_cache_v5';
  let contextCache = readJSON(CONTEXT_CACHE_KEY, {});

  function readJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function normalizeText(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function cleanWord(value) { return normalizeText(value).toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, ''); }
  function isSingleWord(value) { return /^[A-Za-z]+(?:['’-][A-Za-z]+)*$/.test(normalizeText(value)); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  }

  function lemmaCandidates(word) {
    const w = cleanWord(word);
    const out = [w];
    const irregular = {
      went:'go', gone:'go', came:'come', made:'make', took:'take', taken:'take', thought:'think', found:'find',
      felt:'feel', knew:'know', known:'know', gave:'give', given:'give', saw:'see', seen:'see', wrote:'write',
      written:'write', grew:'grow', grown:'grow', ran:'run', began:'begin', begun:'begin', brought:'bring', bought:'buy',
      caught:'catch', taught:'teach', left:'leave', held:'hold', kept:'keep', lost:'lose', paid:'pay', said:'say', told:'tell',
      became:'become', built:'build', chose:'choose', chosen:'choose', drove:'drive', driven:'drive', children:'child',
      people:'person', men:'man', women:'woman', mice:'mouse', feet:'foot', teeth:'tooth', geese:'goose'
    };
    if (irregular[w]) out.push(irregular[w]);
    if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0,-3)+'y');
    if (w.endsWith('ves') && w.length > 4) { out.push(w.slice(0,-3)+'f'); out.push(w.slice(0,-3)+'fe'); }
    if (w.endsWith('es') && w.length > 4) { out.push(w.slice(0,-2)); out.push(w.slice(0,-1)); }
    if (w.endsWith('s') && w.length > 3) out.push(w.slice(0,-1));
    if (w.endsWith('ied') && w.length > 4) out.push(w.slice(0,-3)+'y');
    if (w.endsWith('ing') && w.length > 5) {
      const stem=w.slice(0,-3); out.push(stem,stem+'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0,-1));
    }
    if (w.endsWith('ed') && w.length > 4) {
      const stem=w.slice(0,-2); out.push(stem,stem+'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0,-1));
    }
    return [...new Set(out.filter(Boolean))];
  }

  function tidyMeaning(v) {
    return String(v||'').replace(/\r?\n+/g,'；').replace(/\s+/g,' ').replace(/；{2,}/g,'；').replace(/^[-•]\s*/,'').trim();
  }

  async function fetchJsonWithMirror(file) {
    const urls = [RAW_ROOT + file, CDN_ROOT + file];
    for (const url of urls) {
      try {
        const res = await withTimeout(nativeFetch(url, { cache:'force-cache', mode:'cors' }), 6000);
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data) && data.length) return data;
      } catch (_) {}
    }
    return [];
  }

  async function loadSource(source) {
    if (sourcePromises.has(source.file)) return sourcePromises.get(source.file);
    const p = (async () => {
      const list = await fetchJsonWithMirror(source.file);
      const map = new Map();
      for (const item of list) {
        const key = cleanWord(item?.name);
        const trans = Array.isArray(item?.trans) ? item.trans.map(tidyMeaning).filter(Boolean) : [];
        if (!key || !trans.length) continue;
        map.set(key, { trans, usphone:item.usphone||'', ukphone:item.ukphone||'' });
      }
      return map;
    })();
    sourcePromises.set(source.file, p);
    return p;
  }

  function formatEntry(word, candidate, phone, meanings, sourceLabel, multi=false) {
    const lines=[];
    if (candidate !== cleanWord(word)) lines.push(`原形：${candidate}`);
    if (phone) lines.push(`音标：/${phone}/`);
    lines.push(`常用义：${meanings.slice(0,5).join('；')}`);
    lines.push(`来源：${sourceLabel}${multi?' + 多词库校对':''}`);
    return lines.join('\n');
  }

  async function dictionaryLookup(word) {
    const candidates = lemmaCandidates(word);

    // Same-page safety net first: instant and immune to network/CDN failures.
    for (const candidate of candidates) {
      const item = BASIC[candidate];
      if (item) return formatEntry(word,candidate,item.phone,item.meanings,'本地高频词典');
    }

    // Load the broad/common dictionaries first; they cover normal reading vocabulary better
    // than a pure CET list. Continue to exam/extended dictionaries only if necessary.
    const firstWave = SOURCES.slice(0,4);
    const firstMaps = await Promise.all(firstWave.map(loadSource));
    for (const candidate of candidates) {
      const hits=[];
      firstMaps.forEach((map,i)=>{ const item=map.get(candidate); if(item) hits.push({item,source:firstWave[i]}); });
      if (hits.length) {
        const meanings=[]; let phone='';
        hits.sort((a,b)=>a.source.rank-b.source.rank).forEach(h=>{
          if(!phone) phone=h.item.usphone||h.item.ukphone||'';
          h.item.trans.forEach(m=>{ if(!meanings.includes(m)) meanings.push(m); });
        });
        return formatEntry(word,candidate,phone,meanings,hits[0].source.label,hits.length>1);
      }
    }

    for (const source of SOURCES.slice(4)) {
      const map=await loadSource(source);
      for (const candidate of candidates) {
        const item=map.get(candidate);
        if(item) return formatEntry(word,candidate,item.usphone||item.ukphone||'',item.trans,source.label);
      }
    }
    return '';
  }

  function armChromeTranslator() {
    if (!('Translator' in self) || chromeTranslatorPromise) return;
    // Call create() directly while the click/pointer user activation is still alive.
    try {
      chromeTranslatorPromise = Translator.create({ sourceLanguage:'en', targetLanguage:'zh' }).catch(()=>null);
    } catch (_) { chromeTranslatorPromise = Promise.resolve(null); }
  }

  async function getChromeTranslator() {
    if (!('Translator' in self)) return null;
    if (!chromeTranslatorPromise) {
      try {
        const availability=await Translator.availability({sourceLanguage:'en',targetLanguage:'zh'});
        if(availability==='unavailable') return null;
        chromeTranslatorPromise=Translator.create({sourceLanguage:'en',targetLanguage:'zh'}).catch(()=>null);
      } catch (_) { return null; }
    }
    return chromeTranslatorPromise;
  }

  async function chromeTranslate(text) {
    const translator=await getChromeTranslator();
    if(!translator) return '';
    try { return normalizeText(await translator.translate(text)); }
    catch (_) { return ''; }
  }

  async function lingvaTranslate(text) {
    const q=normalizeText(text).replace(/[\/\\]+/g,' ');
    if(!q) return '';
    for(const base of LINGVA_INSTANCES){
      try{
        const res=await withTimeout(nativeFetch(`${base}/api/v1/en/zh/${encodeURIComponent(q)}`,{cache:'no-store',mode:'cors'}),4500);
        if(!res.ok) continue;
        const data=await res.json();
        const translated=normalizeText(data?.translation||'');
        if(translated && translated.toLowerCase()!==q.toLowerCase()) return translated;
      }catch(_){}
    }
    return '';
  }

  async function highQualityTranslate(text, retries=1) {
    text=normalizeText(text);
    if(!text) return {translation:'',engine:'none'};
    for(let attempt=0;attempt<=retries;attempt++){
      const chrome=await chromeTranslate(text);
      if(chrome) return {translation:chrome,engine:'Chrome 内置翻译'};
      const lingva=await lingvaTranslate(text);
      if(lingva) return {translation:lingva,engine:'Lingva / Google Translate'};
      if(attempt<retries) await sleep(450);
    }
    return {translation:'',engine:'unavailable'};
  }

  function fakeTranslationResponse(text,engine){
    return new Response(JSON.stringify({responseData:{translatedText:text},responseStatus:200,cet4Engine:engine}),{
      status:200,headers:{'Content-Type':'application/json; charset=utf-8','X-CET4-Translation-Engine':engine}
    });
  }

  function extractMyMemoryQuery(input){
    try{
      const url=typeof input==='string'?new URL(input,location.href):new URL(input.url,location.href);
      if(url.hostname!=='api.mymemory.translated.net'||!url.pathname.includes('/get')) return null;
      return url.searchParams.get('q')||'';
    }catch(_){return null;}
  }

  // Drop old poor results once after this upgrade. Other study data stays untouched.
  try{
    const k='cet4_translation_accuracy_upgrade_20260907_v3';
    if(!localStorage.getItem(k)){
      localStorage.removeItem('cet4_reader_translation_cache_v2');
      localStorage.removeItem('cet4_reader_context_cache_v4');
      localStorage.setItem(k,'1');
    }
  }catch(_){}

  window.fetch=async function(input,init){
    const q=extractMyMemoryQuery(input);
    if(q==null) return nativeFetch(input,init);
    const text=normalizeText(q);
    if(!text) return nativeFetch(input,init);

    if(isSingleWord(text)){
      const dictionaryResult=await dictionaryLookup(text);
      if(dictionaryResult) return fakeTranslationResponse(dictionaryResult,'学习词典');
    }

    const result=await highQualityTranslate(text,2);
    if(result.translation) return fakeTranslationResponse(result.translation,result.engine);
    throw new Error('No high-quality translation engine is available.');
  };

  function getSentenceFromTarget(target){
    const word=target?.closest?.('.word');
    const sentence=word?.closest?.('.sentence');
    return normalizeText(sentence?.dataset?.sentence||sentence?.textContent||'');
  }

  function getPhraseFromTarget(target){
    const word=target?.closest?.('.word');
    const sentence=word?.closest?.('.sentence');
    if(!word||!sentence) return '';
    const words=[...sentence.querySelectorAll('.word')];
    const index=words.indexOf(word);
    if(index<0) return '';
    const start=Math.max(0,index-2), end=Math.min(words.length,index+4);
    const phrase=words.slice(start,end).map(x=>x.textContent).join(' ');
    return normalizeText(phrase);
  }

  function ensurePhraseBox(){
    const card=document.getElementById('contextCard');
    if(!card) return null;
    let box=document.getElementById('contextPhraseTranslation');
    if(box) return box;
    box=document.createElement('div');
    box.id='contextPhraseTranslation';
    box.className='context-phrase-translation hidden';
    const label=document.createElement('div');
    label.className='context-label'; label.textContent='上下文短语';
    const en=document.createElement('div'); en.id='contextPhraseEn'; en.className='context-phrase-en';
    const zh=document.createElement('div'); zh.id='contextPhraseZh'; en.after();
    box.append(label,en,zh);
    const sentenceBox=document.getElementById('sentenceTranslation');
    card.insertBefore(box,sentenceBox||null);
    return box;
  }

  async function autoTranslatePhrase(phrase){
    phrase=normalizeText(phrase);
    if(!phrase||phrase.split(' ').length<2) return;
    const token=++lastPhraseToken;
    await sleep(220);
    if(token!==lastPhraseToken) return;
    const box=ensurePhraseBox(); if(!box) return;
    const en=document.getElementById('contextPhraseEn');
    const zh=document.getElementById('contextPhraseZh');
    en.textContent=phrase; zh.textContent='正在翻译上下文短语…'; box.classList.remove('hidden');
    const result=await highQualityTranslate(phrase,1);
    if(token!==lastPhraseToken) return;
    if(result.translation){ zh.textContent=result.translation; zh.title=`翻译引擎：${result.engine}`; }
    else { box.classList.add('hidden'); }
  }

  async function autoTranslateSentence(sentence){
    sentence=normalizeText(sentence);
    if(!sentence||sentence.length<2) return;
    const box=document.getElementById('sentenceTranslation');
    const textEl=document.getElementById('sentenceTranslationText');
    if(!box||!textEl) return;
    const key=sentence.toLowerCase(); const token=++lastAutoToken;
    await sleep(300); if(token!==lastAutoToken) return;
    if(contextCache[key]?.translation){
      textEl.textContent=contextCache[key].translation; textEl.title=`翻译引擎：${contextCache[key].engine||'缓存'}`; box.classList.remove('hidden'); return;
    }
    textEl.textContent='正在结合上下文翻译本句…'; box.classList.remove('hidden');
    const result=await highQualityTranslate(sentence,2); if(token!==lastAutoToken) return;
    if(result.translation){
      textEl.textContent=result.translation; textEl.title=`翻译引擎：${result.engine}`;
      contextCache[key]={translation:result.translation,engine:result.engine,savedAt:Date.now()};
      const entries=Object.entries(contextCache).sort((a,b)=>(b[1].savedAt||0)-(a[1].savedAt||0));
      if(entries.length>500) contextCache=Object.fromEntries(entries.slice(0,380));
      writeJSON(CONTEXT_CACHE_KEY,contextCache);
    }else{
      textEl.textContent='当前没有可用的高质量整句翻译引擎。'; textEl.title='';
    }
  }

  // Arm Chrome's model at the earliest point of a real user gesture.
  document.addEventListener('pointerdown',e=>{
    if(e.target?.closest?.('.word')||e.target?.closest?.('#searchForm')||e.target?.closest?.('#translateSentenceBtn')) armChromeTranslator();
  },true);

  document.addEventListener('click',event=>{
    const sentence=getSentenceFromTarget(event.target); if(sentence) autoTranslateSentence(sentence);
    const phrase=getPhraseFromTarget(event.target); if(phrase) autoTranslatePhrase(phrase);
  });
  document.addEventListener('dblclick',event=>{
    const sentence=getSentenceFromTarget(event.target); if(sentence) autoTranslateSentence(sentence);
    const phrase=getPhraseFromTarget(event.target); if(phrase) autoTranslatePhrase(phrase);
  });

  const style=document.createElement('style');
  style.textContent=`
    .translation{white-space:pre-line}
    .sentence-translation{white-space:normal}
    .sentence-translation #sentenceTranslationText{line-height:1.75}
    .context-phrase-translation{margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)}
    .context-phrase-en{margin-top:6px;font-family:Georgia,"Times New Roman",serif;font-size:13px;line-height:1.55;color:var(--muted)}
    #contextPhraseZh{margin-top:5px;font-size:14px;line-height:1.65;color:var(--text)}
  `;
  document.head.appendChild(style);

  window.CET4TranslationEngine={
    dictionaryReady:async()=>{const maps=await Promise.all(SOURCES.slice(0,4).map(loadSource));return maps.reduce((n,m)=>n+m.size,Object.keys(BASIC).length);},
    hasChromeTranslator:()=>('Translator' in self),
    translate:highQualityTranslate,
    version:VERSION
  };
})();