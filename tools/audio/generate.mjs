import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AUDIO_ROOT = path.join(ROOT, 'audio');
const TMP_ROOT = path.join(ROOT, 'tools/audio/.tmp');
const VOICES = {
  'en-us-m': 'en-US-AndrewNeural',
  'en-us-f': 'en-US-JennyNeural',
  'en-gb-m': 'en-GB-RyanNeural',
  'en-gb-f': 'en-GB-SoniaNeural',
  'zh-m': 'zh-CN-YunyangNeural',
  'zh-f': 'zh-CN-XiaoxuanNeural'
};

function speakerRole(sentence) {
  const text = sentence.text || '';
  const cn = sentence.cn || '';
  const match = text.match(/^\s*([AB])\s*[:：]/) || cn.match(/^\s*([AB])\s*[:：]/);
  return match ? match[1] : 'B';
}

function voiceFor(lang, sentence) {
  return `${lang}-${speakerRole(sentence) === 'A' ? 'm' : 'f'}`;
}

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const topicArg = process.argv.indexOf('--topic');
const TOPIC = topicArg >= 0 ? process.argv[topicArg + 1] : '';

function loadSentences() {
  const src = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
  const marker = 'const SENTENCES = ';
  const code = `globalThis.SENTENCES = ${src.slice(src.indexOf(marker) + marker.length)}`;
  const run = new Function(code);
  run();
  return globalThis.SENTENCES;
}

function letterName(letter, variant) {
  const names = {
    a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'gee', h: 'aitch',
    i: 'eye', j: 'jay', k: 'kay', l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee',
    q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee', w: 'double you',
    x: 'ex', y: 'why', z: variant === 'uk' ? 'zed' : 'zee'
  };
  return names[(letter || '').toLowerCase()] || letter;
}

function normalizeJoinedLetterSpeech(text, variant) {
  return (text || '').replace(/\b(?:[A-Za-z]\s*&\s*)+[A-Za-z]\b/g, match => {
    const letters = match.match(/[A-Za-z]/g) || [];
    return letters.map(letter => letterName(letter, variant)).join(' and ');
  });
}

function buildClearEnglishSpeechText(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([,;:])\s*/g, '$1 ')
    .replace(/([.!?])\s*/g, '$1 ')
    .replace(/\s*[—-]\s*/g, ', ');
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wordSlug(token) {
  const lower = String(token || '').toLowerCase();
  const spoken = lower === 'a' ? 'uh' : (lower === 'i' ? 'eye' : lower);
  return spoken.replace(/[^a-z0-9-]+/g, '') || 'word';
}

function spokenWord(token) {
  const lower = String(token || '').toLowerCase();
  if (lower === 'a') return 'uh';
  if (lower === 'i') return 'eye';
  return token;
}

// Dialogue lines start with a role marker ("A: ..." / "B：..."). It is shown on screen but not spoken.
function stripSpeakerLabel(text) {
  return (text || '').replace(/^\s*[A-Z]\s*[:：]\s*/, '');
}

function englishText(sentence, variant) {
  let text = normalizeJoinedLetterSpeech(stripSpeakerLabel(sentence.text), variant);
  const isCategoryParent = sentence.type === 'category' && (sentence.parentId === undefined || sentence.parentId === null);
  if (isCategoryParent) text = text.replace(/\ba(?=\s*[.!?,;:]?\s*$)/gi, 'uh');
  return buildClearEnglishSpeechText(text);
}

function listStems(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.m4a'))
    .map(name => name.slice(0, -4));
}

function sentenceRank(sentence) {
  const level = sentence.level === 'elementary' ? 0 : sentence.level === 'intermediate' ? 1 : 2;
  const type = sentence.type === 'category' ? 0 : 1;
  return level * 100000 + type * 10000 + Number(sentence.id || 0);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeCatalog(catalog) {
  const file = path.join(AUDIO_ROOT, 'catalog.json');
  const payload = {
    'en-us': [...catalog['en-us']].sort((a, b) => Number(a) - Number(b)),
    'en-gb': [...catalog['en-gb']].sort((a, b) => Number(a) - Number(b)),
    zh: [...catalog.zh].sort((a, b) => Number(a) - Number(b)),
    words: [...catalog.words].sort(),
    wordsUk: [...catalog.wordsUk].sort()
  };
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, file);
}

function runAfconvert(input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn('afconvert', ['-f', 'm4af', '-d', 'aac', input, output], {
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `afconvert exited ${code}`));
    });
  });
}

class VoiceLane {
  constructor(voice) {
    this.voice = voice;
    this.client = null;
    this.tail = Promise.resolve();
  }

  enqueue(job) {
    const run = this.tail.then(() => this.execute(job));
    this.tail = run.catch(() => {});
    return run;
  }

  async connect() {
    if (this.client) return;
    const client = new MsEdgeTTS({ connectionTimeoutMs: 30000 });
    await client.setMetadata(this.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    this.client = client;
  }

  async execute(job) {
    if (fs.existsSync(job.output) && fs.statSync(job.output).size > 500) {
      job.onSkip();
      return;
    }
    ensureDir(path.dirname(job.output));
    ensureDir(TMP_ROOT);
    const mp3Path = path.join(TMP_ROOT, `${job.id}.mp3`);
    const tempM4a = path.join(TMP_ROOT, `${job.id}.m4a`);
    let lastError = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await this.connect();
        const { audioStream } = this.client.toStream(escapeXml(job.text), {
          rate: 1,
          pitch: '+0Hz',
          volume: 100
        });
        await Promise.race([
          pipeline(audioStream, createWriteStream(mp3Path)),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('synthesis timed out')), 60000);
          })
        ]);
        if (!fs.existsSync(mp3Path) || fs.statSync(mp3Path).size < 500) {
          throw new Error('empty audio');
        }
        await runAfconvert(mp3Path, tempM4a);
        fs.renameSync(tempM4a, job.output);
        fs.rmSync(mp3Path, { force: true });
        job.onDone();
        return;
      } catch (error) {
        lastError = error;
        try { this.client && this.client.close(); } catch (closeError) {}
        this.client = null;
        fs.rmSync(mp3Path, { force: true });
        fs.rmSync(tempM4a, { force: true });
        await new Promise(resolve => setTimeout(resolve, 400 * attempt));
      }
    }
    job.onFail(lastError);
  }
}

async function main() {
  const sentences = loadSentences().slice().sort((a, b) => sentenceRank(a) - sentenceRank(b));
  const filtered = TOPIC ? sentences.filter(sentence => sentence.topic === TOPIC) : sentences;
  const selected = Number.isFinite(LIMIT) ? filtered.slice(0, LIMIT) : filtered;
  const catalog = {
    'en-us': new Set(listStems(path.join(AUDIO_ROOT, 'en-us'))),
    'en-gb': new Set(listStems(path.join(AUDIO_ROOT, 'en-gb'))),
    zh: new Set(listStems(path.join(AUDIO_ROOT, 'zh'))),
    words: new Set(listStems(path.join(AUDIO_ROOT, 'words'))),
    wordsUk: new Set(listStems(path.join(AUDIO_ROOT, 'words-uk')))
  };
  writeCatalog(catalog);

  const lanes = {};
  for (const [key, voiceName] of Object.entries(VOICES)) {
    lanes[key] = [new VoiceLane(voiceName)];
  }
  const laneCursor = Object.fromEntries(Object.keys(VOICES).map(key => [key, 0]));
  const jobs = [];

  for (const sentence of selected) {
    jobs.push({
      id: `en-us-${sentence.id}`,
      voice: voiceFor('en-us', sentence),
      text: englishText(sentence, 'us'),
      output: path.join(AUDIO_ROOT, 'en-us', `${sentence.id}.m4a`),
      mark: () => catalog['en-us'].add(String(sentence.id))
    });
    jobs.push({
      id: `en-gb-${sentence.id}`,
      voice: voiceFor('en-gb', sentence),
      text: englishText(sentence, 'uk'),
      output: path.join(AUDIO_ROOT, 'en-gb', `${sentence.id}.m4a`),
      mark: () => catalog['en-gb'].add(String(sentence.id))
    });
    jobs.push({
      id: `zh-${sentence.id}`,
      voice: voiceFor('zh', sentence),
      text: stripSpeakerLabel(sentence.cn || sentence.text),
      output: path.join(AUDIO_ROOT, 'zh', `${sentence.id}.m4a`),
      mark: () => catalog.zh.add(String(sentence.id))
    });
  }

  const wordMap = new Map();
  const includeWords = process.argv.includes('--words') || (!Number.isFinite(LIMIT) && !TOPIC);
  if (includeWords) for (const sentence of sentences) {
    const tokens = stripSpeakerLabel(sentence.text).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [];
    for (const token of tokens) {
      const slug = wordSlug(token);
      if (!wordMap.has(slug)) wordMap.set(slug, spokenWord(token));
    }
  }
  for (const [slug, spoken] of wordMap) {
    jobs.push({
      id: `word-us-${slug}`,
      voice: 'en-us-f',
      text: spoken,
      output: path.join(AUDIO_ROOT, 'words', `${slug}.m4a`),
      mark: () => catalog.words.add(slug)
    });
    jobs.push({
      id: `word-uk-${slug}`,
      voice: 'en-gb-f',
      text: spoken,
      output: path.join(AUDIO_ROOT, 'words-uk', `${slug}.m4a`),
      mark: () => catalog.wordsUk.add(slug)
    });
  }

  let finished = 0;
  let failed = 0;
  const failures = [];
  const pending = [];
  const total = jobs.length;
  console.log(`generating ${selected.length} sentences and ${wordMap.size} words (${total} clips)`);

  for (const job of jobs) {
    const bucket = lanes[job.voice];
    const index = laneCursor[job.voice] % bucket.length;
    laneCursor[job.voice] += 1;
    pending.push(bucket[index].enqueue({
      ...job,
      onSkip: () => {
        job.mark();
        finished += 1;
      },
      onDone: () => {
        job.mark();
        finished += 1;
        if (finished % 20 === 0) {
          writeCatalog(catalog);
          console.log(`${finished}/${total} ready, ${failed} failed`);
        }
      },
      onFail: error => {
        failed += 1;
        failures.push(`${job.output}: ${error && error.message ? error.message : error}`);
        console.error(`failed ${job.output}: ${error && error.message ? error.message : error}`);
      }
    }));
  }

  await Promise.all(pending);
  writeCatalog(catalog);
  if (failures.length) {
    fs.writeFileSync(path.join(ROOT, 'tools/audio/failures.log'), `${failures.join('\n')}\n`);
  }
  console.log(`done ${finished}/${total}, failed ${failed}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
