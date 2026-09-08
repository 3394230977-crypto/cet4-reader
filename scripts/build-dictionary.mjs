#!/usr/bin/env node
// Build the bundled ECDICT subset with Node.js 18 or newer; no packages required.
// Source data: MIT License, Copyright (c) 2025 Linwei. See data/LICENSE-ECDICT.txt.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA = path.join(ROOT, 'data');
const VERSION = 'bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b';
const SOURCE_URL = `https://raw.githubusercontent.com/skywind3000/ECDICT/${VERSION}/ecdict.csv`;
const SOURCE_SHA256 = '1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf';
const LICENSE_SHA256 = 'f8552dd246f61a4e064569eae6194a01c6b3d63b03bf27c6ca863593c549ed0f';
const FREQUENCY_LIMIT = 6000;
const EXTRA_WORDS = new Set((
  'am is are was were been being has had having did does done doing gone went ' +
  'saw seen took taken gave given made got gotten came become became began begun ' +
  'broke broken brought bought caught chose chosen drank drunk drove driven ate eaten ' +
  'fell fallen felt found flew flown forgot forgotten grew grown heard held kept knew ' +
  'known laid lain led left lent lost met paid put ran read ridden rode rang rung rose ' +
  'risen said sold sent shook shaken showed shown sang sung sank sunk sat slept spoke ' +
  'spoken spent stood stole stolen swam swum taught told thought threw thrown understood ' +
  'woke woken wore worn won wrote written better best worse worst farther further ' +
  'farthest furthest less least more most men women children feet teeth mice geese ' +
  'oxen people sheep deer fish axes ax axis indices index criteria criterion analyses ' +
  'analysis phenomena phenomenon data datum studies study address charge rate issue interest'
).split(/\s+/));

const sha256 = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value) + '\n';
const normalize = value => value.normalize('NFC').trim().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');

// RFC 4180 quoting, including commas/newlines inside quoted fields and doubled quotes.
function* csvRows(text) {
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field === '') quoted = !quoted;
      else field += char;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(Boolean)) yield row;
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error('Unterminated CSV quoted field.');
  if (field || row.length) { row.push(field); yield row; }
}

function selectRows(csv) {
  const iterator = csvRows(csv.replace(/^\uFEFF/, ''));
  const header = iterator.next().value;
  const index = Object.fromEntries(header.map((name, i) => [name, i]));
  for (const name of ['word', 'phonetic', 'translation', 'tag', 'bnc', 'frq']) {
    if (!(name in index)) throw new Error(`Missing CSV column: ${name}`);
  }
  const selected = [];
  let sourceEntries = 0;
  for (const row of iterator) {
    sourceEntries++;
    if (row.length !== header.length) throw new Error(`Invalid CSV row ${sourceEntries + 1}.`);
    const word = normalize(row[index.word]).toLowerCase();
    const tags = row[index.tag].split(/\s+/);
    const bnc = Number(row[index.bnc]) || 0, frq = Number(row[index.frq]) || 0;
    const tagged = tags.some(tag => ['zk', 'gk', 'cet4', 'cet6'].includes(tag));
    const common = (bnc > 0 && bnc <= FREQUENCY_LIMIT) || (frq > 0 && frq <= FREQUENCY_LIMIT);
    if (!(tagged || common || EXTRA_WORDS.has(word))) continue;
    if (!/^[a-z][a-z' -]*$/.test(word) || !/[\u3400-\u9fff]/u.test(row[index.translation])) continue;
    selected.push([row[index.word], row[index.phonetic], row[index.translation], row[index.tag], bnc, frq]);
  }
  return { sourceEntries, rows: selected };
}

function compile(rows, overrides) {
  const dictionary = Object.create(null);
  for (const [rawWord, phonetic, translation] of rows) {
    const word = normalize(rawWord).toLowerCase();
    const trans = translation.replace(/\\r/g, '\n').replace(/\\t/g, ' ').split(/\\n|\r?\n/).map(normalize).filter(Boolean);
    if (!trans.length) continue;
    const entry = dictionary[word] ??= { usphone: '', ukphone: normalize(phonetic), trans: [] };
    // ECDICT documents a single phonetic field, mainly British. Never invent US IPA.
    if (!entry.ukphone && phonetic) entry.ukphone = normalize(phonetic);
    for (const definition of trans) if (!entry.trans.includes(definition)) entry.trans.push(definition);
  }
  for (const [word, correction] of Object.entries(overrides)) {
    if (!dictionary[word]) throw new Error(`Override has no source entry: ${word}`);
    dictionary[word] = { ...dictionary[word], ...correction };
  }
  return Object.fromEntries(Object.keys(dictionary).sort().map(word => [word, dictionary[word]]));
}

const args = process.argv.slice(2);
const verify = args.includes('--verify');
const inputIndex = args.indexOf('--source');
if (args.some((arg, i) => !['--source', '--download', '--verify'].includes(arg) && !(inputIndex >= 0 && i === inputIndex + 1))) {
  throw new Error('Usage: node scripts/build-dictionary.mjs [--source /path/to/ecdict.csv | --download] [--verify]');
}
if (inputIndex >= 0 && (!args[inputIndex + 1] || args[inputIndex + 1].startsWith('--'))) {
  throw new Error('--source requires a CSV path.');
}
if (verify && (inputIndex >= 0 || args.includes('--download'))) throw new Error('--verify uses the bundled sources only.');
await mkdir(path.join(DATA, 'sources'), { recursive: true });
let selected;
if (inputIndex >= 0 || args.includes('--download')) {
  let source;
  if (inputIndex >= 0) source = await readFile(path.resolve(args[inputIndex + 1]));
  else {
    const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    source = Buffer.from(await response.arrayBuffer());
  }
  if (sha256(source) !== SOURCE_SHA256) throw new Error('Full source SHA-256 does not match the pinned ECDICT version.');
  selected = selectRows(source.toString('utf8'));
  await writeFile(path.join(DATA, 'sources', 'ecdict-selected.json'), json(selected));
} else selected = JSON.parse(await readFile(path.join(DATA, 'sources', 'ecdict-selected.json'), 'utf8'));

const overridesSource = await readFile(path.join(DATA, 'dictionary-overrides.json'));
const license = await readFile(path.join(DATA, 'LICENSE-ECDICT.txt'));
if (sha256(license) !== LICENSE_SHA256) throw new Error('ECDICT license must be preserved verbatim.');
const overrides = JSON.parse(overridesSource.toString('utf8'));
const dictionary = compile(selected.rows, overrides);
const output = json(dictionary);
if (Buffer.byteLength(output) > 3_000_000) throw new Error('Dictionary exceeds the 3 MB download budget.');
const metadata = {
  name: 'ECDICT 学习词典',
  license: 'MIT',
  repository: 'https://github.com/skywind3000/ECDICT',
  version: VERSION,
  sourceUrl: SOURCE_URL,
  sourceSha256: SOURCE_SHA256,
  licenseSha256: LICENSE_SHA256,
  sourceEntries: selected.sourceEntries,
  selection: { tags: ['zk', 'gk', 'cet4', 'cet6'], maximumBncOrFrqRank: FREQUENCY_LIMIT, extraWords: [...EXTRA_WORDS].sort() },
  sourceSubsetSha256: sha256(json(selected)),
  overridesSha256: sha256(overridesSource),
  entries: Object.keys(dictionary).length,
  dictionaryBytes: Buffer.byteLength(output),
  dictionarySha256: sha256(output),
  modified: '2026-09-08',
};
if (verify) {
  const actual = await readFile(path.join(DATA, 'dictionary.json'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(DATA, 'dictionary.meta.json'), 'utf8'));
  if (actual !== output || JSON.stringify(manifest) !== JSON.stringify(metadata)) throw new Error('Dictionary or manifest is not reproducible from bundled sources.');
} else {
  await writeFile(path.join(DATA, 'dictionary.json'), output);
  await writeFile(path.join(DATA, 'dictionary.meta.json'), JSON.stringify(metadata, null, 2) + '\n');
}
console.log(`${verify ? 'Verified' : 'Built'} ${metadata.entries} entries; ${metadata.dictionaryBytes} bytes; SHA-256 ${metadata.dictionarySha256}`);
