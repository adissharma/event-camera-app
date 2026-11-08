#!/usr/bin/env node
/**
 * Generates the story illustrations with the OpenAI Images API.
 *
 *   OPENAI_KEY_FILE=/path/to/0600-file node scripts/story/generate.mjs [--draft] [ids...]
 *
 * Local development tool only: never imported by the app, and the key is read
 * from the environment or a file, never from source. Raw outputs and a usage
 * log land in assets/story-source/. Existing files are skipped, so a re-run only
 * pays for what's missing.
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PLATES, FIGURES } from './prompts.mjs';

const SOURCE = 'assets/story-source';
const LOG = join(SOURCE, 'generation-log.jsonl');
const MODEL = process.env.STORY_MODEL ?? 'gpt-image-2.5-sunburst';
const args = process.argv.slice(2);
const draft = args.includes('--draft');
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('--'));

const key = process.env.OPENAI_API_KEY ?? (process.env.OPENAI_KEY_FILE ? readFileSync(process.env.OPENAI_KEY_FILE, 'utf8').trim() : '');
if (!key) throw new Error('Set OPENAI_API_KEY or OPENAI_KEY_FILE.');

mkdirSync(SOURCE, { recursive: true });
const out = (id) => join(SOURCE, `${id}${draft ? '.draft' : ''}.png`);

async function generate(job) {
  const quality = draft ? 'low' : job.quality ?? 'high';
  const refs = (job.refs ?? []).map((r) => join(SOURCE, `${r}.png`));
  let res;
  if (refs.length) {
    const body = new FormData();
    body.set('model', MODEL);
    body.set('prompt', job.prompt);
    body.set('size', job.size);
    body.set('quality', quality);
    for (const ref of refs) body.append('image[]', new Blob([readFileSync(ref)], { type: 'image/png' }), ref);
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: job.prompt, size: job.size, quality }),
    });
  }
  const json = await res.json();
  if (!res.ok) throw new Error(`${job.id}: ${res.status} ${json.error?.code ?? ''} ${json.error?.message ?? ''}`);
  writeFileSync(out(job.id), Buffer.from(json.data[0].b64_json, 'base64'));
  appendFileSync(LOG, JSON.stringify({ id: job.id, model: MODEL, quality, size: job.size, refs: job.refs ?? [], usage: json.usage, at: new Date().toISOString() }) + '\n');
  console.log(`done ${job.id}`, json.usage?.total_tokens ?? '');
}

const jobs = [...PLATES, ...FIGURES].filter((j) => (only.length ? only.includes(j.id) : true)).filter((j) => force || !existsSync(out(j.id)));

// Anchors first and in sequence, because later jobs reference them.
const ordered = jobs.filter((j) => !j.refs);
const dependent = jobs.filter((j) => j.refs);
for (const job of ordered) await generate(job);
const pool = [...dependent];
const ready = (j) => j.refs.every((r) => existsSync(join(SOURCE, `${r}.png`)));
while (pool.length) {
  const batch = pool.filter(ready).slice(0, 4);
  if (!batch.length) throw new Error(`Unresolved references: ${pool.map((j) => j.id)}`);
  const results = await Promise.allSettled(batch.map(generate));
  results.forEach((r) => r.status === 'rejected' && console.error(String(r.reason)));
  for (const b of batch) pool.splice(pool.indexOf(b), 1);
}
