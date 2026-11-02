import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSource, renderModule } from '../scripts/build-didi.mjs';
const source = await readFile(new URL('../upstream/Didichuxing.snippet', import.meta.url), 'utf8');
const module = await readFile(new URL('../AdBlock/DiDi.sgmodule', import.meta.url), 'utf8');
test('all upstream IP rejects are preserved with no-resolve, and output is reproducible', () => {
 const parsed = parseSource(source); assert.equal(module, renderModule(source, parsed));
 const upstream = source.split(/\r?\n/).filter(x => /^ip-cidr\s*,/i.test(x)).map(x => x.split(',')[1].trim()).sort();
 const native = module.split('\n').filter(x => x.startsWith('IP-CIDR,'));
 assert.equal(native.length, upstream.length); assert.ok(native.length > 0);
 assert.deepEqual(native.map(x => { assert.match(x, /^IP-CIDR,[^,]+,REJECT,no-resolve$/); return x.split(',')[1]; }).sort(), upstream);
});
test('the non-IP domain reject, rewrite, MITM and JQ remain present', () => {
 assert.match(module, /^DOMAIN,gwp\.xiaojukeji\.com,REJECT$/m);
 for (const section of ['[Map Local]', '[Body Rewrite]', '[MITM]']) assert.ok(module.includes(section));
});
test('Surge accepts the generated profile', { skip: !existsSync('/Applications/Surge.app/Contents/Applications/surge-cli') }, async () => {
 const dir = await mkdtemp(join(tmpdir(), 'didi-check-')); const path = join(dir, 'profile.conf');
 try { await writeFile(path, module.replace('hostname = %APPEND% ', 'hostname = ') + '\n[Rule]\nFINAL,DIRECT\n'); const r = spawnSync('/Applications/Surge.app/Contents/Applications/surge-cli', ['--check', path], { encoding: 'utf8', timeout: 30000 }); assert.equal(r.status, 0, r.stderr || r.stdout); assert.match(r.stdout, /OK/); } finally { await rm(dir, { recursive: true, force: true }); }
});
