#!/usr/bin/env node
/*
 * A local web tuner for the Disposable filter.
 *
 *   node tools/filter-lab/server.cjs
 *   → http://localhost:5678
 *
 * Move a slider, see the photo change immediately. Nothing on disk changes
 * until you press Save, which is the only code path in this file that writes
 * to `src/`.
 *
 * The rendering happens in the browser, not here: CanvasKit's WebGL backend
 * gives a real GPU, so a full-size render is milliseconds rather than the many
 * seconds Node's CPU backend takes. This process only compiles the filter
 * modules, serves them, and writes the preset back when asked.
 *
 * What the browser runs is the *actual* filter — `disposable-recipe.ts`,
 * `disposable-uniforms.ts`, `disposable-paint.ts` and the shader — compiled to
 * ES modules, with `@shopify/react-native-skia` mapped to a shim that adapts
 * CanvasKit's API shape. No filter logic is reimplemented anywhere in this
 * tool, so what you tune is what the app renders.
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const MEDIA = path.join(ROOT, 'src/features/media');
const PRESET_FILE = path.join(MEDIA, 'disposable-preset.ts');
const CANVASKIT = path.join(ROOT, 'node_modules/canvaskit-wasm/bin/full');
const PORT = Number(process.env.PORT ?? 5678);

/** Photos offered in the picker. Any image under assets/ is fair game. */
function sampleImages() {
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) {
        found.push(path.relative(ROOT, full));
      }
    }
  };
  walk(path.join(ROOT, 'assets/images/placeholders'));
  const extra = path.join(__dirname, 'images');
  if (fs.existsSync(extra)) walk(extra);
  return found.sort();
}

// ── Compiling the filter modules for the browser ──────────────────────

let buildDir = null;
let builtAt = 0;

function sourcesChangedAt() {
  return fs
    .readdirSync(MEDIA)
    .filter((name) => /^(disposable-|image-orientation)/.test(name) && name.endsWith('.ts'))
    .reduce((latest, name) => Math.max(latest, fs.statSync(path.join(MEDIA, name)).mtimeMs), 0);
}

/**
 * Compiles to ES modules and rewrites relative import specifiers to carry a
 * `.js` extension, which TypeScript omits and browsers require.
 */
function build() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-tuner-'));
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ES2020',
        moduleResolution: 'node10',
        ignoreDeprecations: '6.0',
        outDir: 'build',
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        rootDir: MEDIA,
        types: [],
      },
      files: [path.join(MEDIA, 'disposable-paint.ts')],
    }),
  );

  try {
    execFileSync(path.join(ROOT, 'node_modules/.bin/tsc'), ['-p', dir], { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`the filter modules did not compile:\n${error.stdout ?? error.message}`);
  }

  const out = path.join(dir, 'build');
  for (const name of fs.readdirSync(out)) {
    if (!name.endsWith('.js')) continue;
    const file = path.join(out, name);
    const patched = fs
      .readFileSync(file, 'utf8')
      .replace(/from ['"](\.\/[^'"]+)['"]/g, (match, specifier) =>
        specifier.endsWith('.js') ? match : `from '${specifier}.js'`,
      )
      .replace(/from ['"]@shopify\/react-native-skia['"]/g, "from '/skia-browser-shim.js'");
    fs.writeFileSync(file, patched);
  }

  buildDir = out;
  builtAt = sourcesChangedAt();
  return out;
}

function ensureBuilt() {
  if (!buildDir || sourcesChangedAt() > builtAt) build();
  return buildDir;
}

// ── Writing the preset back ───────────────────────────────────────────

/**
 * Rewrites numbers in `disposable-preset.ts` in place.
 *
 * Line-targeted rather than regenerating the object, because the file's
 * comments carry most of its value — they explain why each number is what it
 * is, and a serialiser would silently delete every one of them.
 *
 * `changes` is keyed by dotted path: `tone.contrast`, `grain.intensity.base`.
 */
function writePreset(changes) {
  const lines = fs.readFileSync(PRESET_FILE, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith('export const DISPOSABLE_PRESET'));
  if (start < 0) throw new Error('could not find DISPOSABLE_PRESET in the preset file');

  const applied = [];
  let group = null;

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '};') break;

    const groupMatch = line.match(/^ {2}(\w+): \{$/);
    if (groupMatch) {
      group = groupMatch[1];
      continue;
    }
    if (!group) continue;

    // `key: { base: N, vary: N },`
    const varied = line.match(/^( {4}(\w+): \{ base: )(-?[\d.]+)(, vary: )(-?[\d.]+)( \},)$/);
    if (varied) {
      const key = varied[2];
      const base = changes[`${group}.${key}.base`];
      const vary = changes[`${group}.${key}.vary`];
      if (base !== undefined || vary !== undefined) {
        const nextBase = base ?? Number(varied[3]);
        const nextVary = vary ?? Number(varied[5]);
        lines[i] = `${varied[1]}${nextBase}${varied[4]}${nextVary}${varied[6]}`;
        if (base !== undefined) applied.push(`${group}.${key}.base = ${nextBase}`);
        if (vary !== undefined) applied.push(`${group}.${key}.vary = ${nextVary}`);
      }
      continue;
    }

    // `key: '#ff7c38',`
    const text = line.match(/^( {4}(\w+): ')([^']*)(',)$/);
    if (text) {
      const next = changes[`${group}.${text[2]}`];
      if (next !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(String(next))) {
          throw new Error(`${group}.${text[2]} must be a #rrggbb colour, got ${next}`);
        }
        lines[i] = `${text[1]}${next}${text[4]}`;
        applied.push(`${group}.${text[2]} = ${next}`);
      }
      continue;
    }

    // `key: N,`
    const plain = line.match(/^( {4}(\w+): )(-?[\d.]+)(,)$/);
    if (plain) {
      const key = plain[2];
      const next = changes[`${group}.${key}`];
      if (next !== undefined) {
        lines[i] = `${plain[1]}${next}${plain[4]}`;
        applied.push(`${group}.${key} = ${next}`);
      }
    }
  }

  const missed = Object.keys(changes).filter(
    (key) => !applied.some((entry) => entry.startsWith(`${key} =`)),
  );
  if (missed.length) {
    // Refusing a partial write: a half-applied preset is worse than none,
    // because the file would then disagree with what the tuner is showing.
    throw new Error(`could not locate these in the preset file: ${missed.join(', ')}`);
  }

  fs.writeFileSync(PRESET_FILE, lines.join('\n'));
  return applied;
}

// ── Server ────────────────────────────────────────────────────────────

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendFile(res, file) {
  if (!fs.existsSync(file)) return send(res, 404, JSON.stringify({ error: 'not found' }));
  return send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] ?? 'application/octet-stream');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const route = url.pathname;

  try {
    if (route === '/') return sendFile(res, path.join(__dirname, 'ui.html'));
    if (route === '/skia-browser-shim.js') {
      return sendFile(res, path.join(__dirname, 'skia-browser-shim.js'));
    }
    if (route === '/canvaskit.js') return sendFile(res, path.join(CANVASKIT, 'canvaskit.js'));
    if (route === '/canvaskit.wasm') return sendFile(res, path.join(CANVASKIT, 'canvaskit.wasm'));

    if (route.startsWith('/mod/')) {
      const dir = ensureBuilt();
      const name = path.basename(route);
      return sendFile(res, path.join(dir, name));
    }

    if (route === '/api/images') {
      return send(res, 200, JSON.stringify(sampleImages()));
    }

    if (route === '/img') {
      const relative = url.searchParams.get('path') ?? '';
      const file = path.resolve(ROOT, relative);
      // Never serve outside the repo, however the path is spelled.
      if (!file.startsWith(ROOT)) return send(res, 403, JSON.stringify({ error: 'outside repo' }));
      return sendFile(res, file);
    }

    if (route === '/api/keep' && req.method === 'POST') {
      // Persists a photo the browser already has, so it is in the picker next
      // time. Entirely optional — the tuner renders uploads without this.
      const name = path.basename(url.searchParams.get('name') ?? '');
      if (!/\.(png|jpe?g|webp)$/i.test(name)) {
        return send(res, 400, JSON.stringify({ error: 'expected a png, jpg or webp' }));
      }
      const dir = path.join(__dirname, 'images');
      fs.mkdirSync(dir, { recursive: true });
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, Buffer.concat(chunks));
        console.log(`Kept ${path.relative(ROOT, file)}`);
        send(res, 200, JSON.stringify({ path: path.relative(ROOT, file) }));
      });
      return undefined;
    }

    if (route === '/api/save' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const applied = writePreset(JSON.parse(body));
          console.log(`\nSaved to disposable-preset.ts:\n  ${applied.join('\n  ')}\n`);
          send(res, 200, JSON.stringify({ applied }));
        } catch (error) {
          send(res, 400, JSON.stringify({ error: String(error.message ?? error) }));
        }
      });
      return undefined;
    }

    return send(res, 404, JSON.stringify({ error: 'not found' }));
  } catch (error) {
    return send(res, 500, JSON.stringify({ error: String(error.message ?? error) }));
  }
});

try {
  ensureBuilt();
} catch (error) {
  console.error(String(error.message ?? error));
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`\n  Disposable filter tuner   http://localhost:${PORT}\n`);
  console.log('  Sliders are preview-only. Nothing is written to src/ until you press Save.\n');
});
