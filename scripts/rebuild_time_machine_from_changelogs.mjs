#!/usr/bin/env node
/**
 * Rebuilds the Time Machine JSON files from the text changelogs.
 * Run from the repository root with:
 *   node scripts/rebuild_time_machine_from_changelogs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY_DIR = path.join(ROOT, 'demonlist_history');
const OUTPUT_FILES = ['time_machine_data.json', 'time_machine_snapshots.json', 'snapshot.json'];

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function levelsAtCommit(shortSha) {
  const levels = [];
  for (const filename of ['levels_main.json', 'levels_extended.json', 'levels_legacy.json']) {
    try {
      levels.push(...JSON.parse(git('show', `${shortSha}:${filename}`)));
    } catch {
      return null;
    }
  }
  return levels.slice(0, 150);
}

function levelsFromText(filename) {
  const levels = [];
  const text = fs.readFileSync(filename, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(\d+) - (.+) by (.+)$/);
    if (match) levels.push({ lvl_name: match[2], lvl_creator: match[3] });
  }
  return levels;
}

function readExistingBaseline() {
  try {
    const existing = JSON.parse(fs.readFileSync(path.join(ROOT, 'time_machine_data.json'), 'utf8'));
    const levels = existing.snapshots?.[0]?.list_data?.[0]?.levels;
    if (Array.isArray(levels) && levels.length === 150 && levels.every(level => level.video_url)) return levels;
  } catch {
    // Fall back to the text file below.
  }
  return levelsFromText(path.join(HISTORY_DIR, '01.15.2026.00.00 - Demonlist.txt'));
}

const baselineLevels = readExistingBaseline();
const snapshots = [{
  date: '2026-01-15T00:00:00-03:00',
  list_data: [{ date: '01/15/2026 00:00', levels: baselineLevels }],
}];

for (const filename of fs.readdirSync(HISTORY_DIR).filter(name => name.endsWith('.00.00 - Demonlist.txt')).sort()) {
  const text = fs.readFileSync(path.join(HISTORY_DIR, filename), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/- (\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}) \| ([0-9a-f]{12}) \| /);
    if (!match) continue;
    const localDate = new Date(`${match[1].replace(/\//g, '-').replace(/^(\d{2})-(\d{2})-(\d{4})/, '$3-$1-$2')}:00-03:00`);
    if (Number.isNaN(localDate.getTime())) continue;
    const levels = levelsAtCommit(match[2]);
    if (!levels) continue;
    const isoDate = `${match[1].slice(6, 10)}-${match[1].slice(0, 2)}-${match[1].slice(3, 5)}T${match[1].slice(11, 16)}:00-03:00`;
    snapshots.push({
      date: isoDate,
      list_data: [{ date: match[1], levels }],
    });
  }
}

// If two commits share the same minute, the last changelog entry is the state at that minute.
const byDate = new Map(snapshots.map(snapshot => [snapshot.date, snapshot]));
const orderedSnapshots = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
const payload = {
  snapshots: orderedSnapshots,
  metadata: {
    source: 'demonlist_history TXT changelogs',
    timezone: 'America/Sao_Paulo',
    positions_per_snapshot: 150,
  },
};

for (const filename of OUTPUT_FILES) {
  fs.writeFileSync(path.join(ROOT, filename), `${JSON.stringify(payload, null, 2)}\n`);
}

const counts = orderedSnapshots.map(snapshot => snapshot.list_data[0].levels.length);
if (!counts.every(count => count === 150)) throw new Error('Every snapshot must contain exactly 150 levels.');
console.log(`Generated ${orderedSnapshots.length} complete Time Machine snapshots.`);
