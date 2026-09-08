const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const server = require('../scripts/serve.cjs');
const out = path.join(__dirname, '../artifacts');
fs.mkdirSync(out, { recursive: true });
const passed = [];
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    await page.goto(base);
    await page.locator('#sampleArticle').click();
    assert.equal(await page.locator('#articleDialog').evaluate(el => el.open), true);
    await page.locator('#articleForm button[type=submit]').click();
    assert.match(await page.locator('#readerTitle').textContent(), /Small habits/);
    passed.push('新用户示例导入与保存');
    await page.reload();
    assert.match(await page.locator('#readerTitle').textContent(), /Small habits/);
    passed.push('原有浏览器文章持久保存');
    const dictionary = await page.evaluate(async () => ({
      count: await window.CET4TranslationEngine.dictionaryReady(),
      address: await window.CET4TranslationEngine.lookup('address'),
      saw: await window.CET4TranslationEngine.lookup('saw'),
      axes: await window.CET4TranslationEngine.lookup('axes')
    }));
    assert.equal(dictionary.count, 8870);
    assert.match(dictionary.address.translation, /处理/);
    assert.match(dictionary.saw.translation, /锯/);
    assert.match(dictionary.saw.translation, /see/);
    assert.match(dictionary.axes.translation, /axis/);
    passed.push('真实同源词典加载与多义词释义');
    await page.locator('#autoTranslate').uncheck();
    await page.locator('.word[data-word="Students"]').first().click();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('ECDICT'));
    assert.match(await page.locator('#translation').textContent(), /学生/);
    await page.screenshot({ path: path.join(out, 'dictionary-desktop.png') });
    passed.push('真实词典在查询界面显示中文释义');

    // Install a deterministic translator at the engine boundary to test UI races.
    // This does not claim to test live translation quality.
    await page.evaluate(() => {
      window.__calls = [];
      window.CET4TranslationEngine = {
        prepare() {}, dictionaryReady: async () => 8870,
        lookup: (term, opts) => new Promise(resolve => {
          window.__calls.push({ kind: 'lookup', term, force: opts?.force });
          setTimeout(() => resolve({ translation: '常用义：' + term, engine: '测试词典', kind: 'dictionary' }), term === 'Students' ? 800 : 20);
        }),
        translate: (text, opts) => new Promise(resolve => {
          window.__calls.push({ kind: 'sentence', text, force: opts?.force });
          setTimeout(() => resolve({ translation: '本句译文：' + text, engine: '测试译文' }), text.startsWith('Students') ? 800 : 30);
        })
      };
    });
    await page.locator('#autoTranslate').check();
    await page.locator('.word[data-word="Students"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('.word[data-word="Small"]').first().click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#term').textContent(), 'Small');
    assert.match(await page.locator('#translation').textContent(), /Small/);
    assert.match(await page.locator('#sentenceTranslationText').textContent(), /Small changes/);
    assert.doesNotMatch(await page.locator('#sentenceTranslationText').textContent(), /Students/);
    passed.push('快速切词不混用词义或句译');

    await page.locator('#translateSentenceBtn').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__calls.filter(x => x.kind === 'sentence').at(-1).force), true);
    passed.push('重新译整句绕过旧缓存');

    await page.locator('#saveBtn').click();
    let vocab = await page.evaluate(() => JSON.parse(localStorage.getItem('cet4_reader_vocab_v2')));
    assert.match(vocab[0].sentenceTranslation, /Small changes/);
    await page.locator('#markMistakeBtn').click();
    await page.locator('#mistakeNoteInput').fill('练习理解完整语境');
    await page.locator('#mistakeForm button[type=submit]').click();
    const mistakes = await page.evaluate(() => JSON.parse(localStorage.getItem('cet4_reader_mistakes_v3')));
    assert.match(mistakes[0].translation, /Small changes/);
    passed.push('自动译文随生词和错题一起保存');
    await page.locator('.word[data-word="Students"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('#markMistakeBtn').click();
    await page.locator('#mistakeNoteInput').fill('在等待译文时写下备注');
    await page.waitForTimeout(1000);
    await page.locator('#mistakeForm button[type=submit]').click();
    const lateMistake = await page.evaluate(() => JSON.parse(localStorage.getItem('cet4_reader_mistakes_v3')).find(item => item.text.startsWith('Students')));
    assert.match(lateMistake.translation, /Students/);
    passed.push('填写备注期间完成的译文也能保存');

    await page.locator('#searchInput').fill('The bank raised rates by 3.5%.');
    await page.locator('#searchForm button').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__calls.filter(x => x.kind === 'lookup').at(-1).term), 'The bank raised rates by 3.5%.');
    passed.push('查询原文保留小数与标点');
    await page.locator('#retryLookup').click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__calls.filter(x => x.kind === 'lookup').at(-1).force), true);
    passed.push('重新查询绕过旧缓存');

    await page.locator('.word[data-word="Students"]').first().click();
    await page.waitForTimeout(450);
    await page.locator('#vocabTab').click();
    await page.locator('#vocabList .card').first().click();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#term').textContent(), 'Small');
    assert.match(await page.locator('#sentenceTranslationText').textContent(), /Small changes/);
    passed.push('打开生词卡会取消旧的查询显示');

    await page.locator('#autoTranslate').uncheck();
    const before = await page.evaluate(() => window.__calls.filter(x => x.kind === 'sentence').length);
    await page.locator('.word[data-word="Students"]').first().click();
    await page.waitForTimeout(1050);
    assert.equal(await page.evaluate(() => window.__calls.filter(x => x.kind === 'sentence').length), before);
    passed.push('关闭自动句译后不再自动发送整句');

    await page.locator('#autoTranslate').check();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, 'desktop.png') });
    for (const width of [390, 768, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(100);
      const bounds = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, reader: document.querySelector('.reader-shell').getBoundingClientRect().height, side: document.querySelector('.side-shell').getBoundingClientRect().height }));
      assert.equal(bounds.overflow, false, 'horizontal overflow at ' + width);
      assert.ok(bounds.reader > 100 && bounds.side > 100);
      if (width === 390) await page.screenshot({ path: path.join(out, 'mobile.png') });
    }
    passed.push('手机、平板和桌面布局无水平溢出');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: path.join(out, 'dark.png') });
    assert.deepEqual(errors, []);
    passed.push('浏览器没有未捕获脚本错误');
    console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
