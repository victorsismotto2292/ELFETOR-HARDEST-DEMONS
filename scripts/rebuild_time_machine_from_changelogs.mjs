#!/usr/bin/env node
/**
 * Rebuilds the Time Machine snapshots from the JSON history archive.
 *
 * History files contain a full daily baseline plus compact event deltas.
 * This script replays those deltas to produce the same snapshot shape that
 * index.js already consumes, keeping the public Time Machine interface intact.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HISTORY_DIR = path.join(ROOT, 'demonlist_history');
const OUTPUT_FILES = ['time_machine_data.json', 'time_machine_snapshots.json', 'snapshot.json'];
const START_DATE = '2026-01-15T00:00:00-03:00';
const TZ = 'America/Sao_Paulo';
const MAIN_MAX = 75;
const EXTENDED_MAX = 150;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function walkHistoryFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHistoryFiles(full));
    else if (entry.isFile() && /^\d{2}\.\d{2}\.\d{4} - Changelog\.json$/.test(entry.name)) files.push(full);
  }
  return files.sort();
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function removeByName(list, name) {
  const key = normalizeName(name);
  const index = list.findIndex(level => normalizeName(level.lvl_name) === key);
  if (index >= 0) list.splice(index, 1);
}

function insertAtGlobalPosition(state, level, position) {
  if (position == null) return;
  removeByName(state.main, level.lvl_name);
  removeByName(state.extended, level.lvl_name);
  removeByName(state.legacy, level.lvl_name);

  if (position <= MAIN_MAX) {
    state.main.splice(Math.max(0, Math.min(position - 1, state.main.length)), 0, level);
  } else if (position <= EXTENDED_MAX) {
    const index = Math.max(0, Math.min(position - MAIN_MAX - 1, state.extended.length));
    state.extended.splice(index, 0, level);
  } else {
    const index = Math.max(0, Math.min(position - EXTENDED_MAX - 1, state.legacy.length));
    state.legacy.splice(index, 0, level);
  }
}

function mergeUpdatedLevel(existing, after) {
  if (!existing) return clone(after);
  return clone(after);
}

function applyEvent(state, event) {
  const changes = Array.isArray(event.changes) ? event.changes : [];
  const relocating = changes.filter(change =>
    change.after && (change.change_type?.includes('moved') || change.change_type?.includes('added'))
  );

  // Remove every level involved in a positional change before reinserting them.
  // This makes swaps and large reorders deterministic regardless of the order
  // in which the individual changes appear in the changelog.
  for (const change of relocating) {
    const name = change.after?.lvl_name || change.lvl_name;
    removeByName(state.main, name);
    removeByName(state.extended, name);
    removeByName(state.legacy, name);
  }

  for (const change of changes) {
    if (change.after == null) {
      const name = change.before?.lvl_name || change.lvl_name;
      removeByName(state.main, name);
      removeByName(state.extended, name);
      removeByName(state.legacy, name);
    }
  }

  // Reinsert all moved/added levels in their final global order.
  relocating
    .slice()
    .sort((a, b) => (a.new_position ?? Number.MAX_SAFE_INTEGER) - (b.new_position ?? Number.MAX_SAFE_INTEGER))
    .forEach(change => insertAtGlobalPosition(state, change.after, change.new_position));

  // Updates without a position change only replace the level's data.
  for (const change of changes.filter(item => item.after && !item.change_type?.includes('moved') && !item.change_type?.includes('added'))) {
    const name = normalizeName(change.after.lvl_name);
    for (const list of [state.main, state.extended, state.legacy]) {
      const index = list.findIndex(level => normalizeName(level.lvl_name) === name);
      if (index >= 0) {
        list[index] = clone(change.after);
        break;
      }
    }
  }
}

function first150(state) {
  return [...state.main, ...state.extended].slice(0, EXTENDED_MAX).map(level => clone(level));
}

function formatDisplay(timestamp) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});
  return `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function makeSnapshot(timestamp, state, metadata = {}) {
  return {
    date: timestamp,
    list_data: [{
      date: formatDisplay(timestamp),
      levels: first150(state)
    }],
    metadata
  };
}

const files = walkHistoryFiles(HISTORY_DIR);
if (!files.length) throw new Error('Nenhum changelog JSON encontrado.');

const dayDocuments = files.map(readJson).sort((a, b) => String(a.date).localeCompare(String(b.date)));
const startDocument = dayDocuments.find(document => document.date === START_DATE.slice(0, 10));
if (!startDocument?.day_start?.lists) throw new Error(`Snapshot inicial de ${START_DATE} não encontrado.`);

let state = {
  main: clone(startDocument.day_start.lists.main || []),
  extended: clone(startDocument.day_start.lists.extended || []),
  legacy: clone(startDocument.day_start.lists.legacy || [])
};

const snapshots = [makeSnapshot(START_DATE, state, {
  source: 'daily JSON changelog baseline',
  source_commit: startDocument.day_start.source_commit || null
})];

let eventCount = 0;

for (const document of dayDocuments) {
  for (const event of [...(document.changes || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))) {
    applyEvent(state, event);

    const top150 = first150(state);
    if (top150.length !== 150) {
      throw new Error(`Evento ${event.commit || event.local_timestamp} produziu ${top150.length} posições, esperado 150.`);
    }

    snapshots.push({
      date: event.timestamp,
      list_data: [{
        date: event.local_timestamp,
        levels: top150
      }],
      metadata: {
        source_commit: event.commit || null,
        source_operation: event.operation || 'change',
        message: event.message || ''
      }
    });
    eventCount += 1;
  }
}

const payload = {
  snapshots,
  metadata: {
    source: 'demonlist_history JSON changelogs (replayed deltas)',
    timezone: TZ,
    positions_per_snapshot: 150,
    history_schema_version: 2,
    snapshot_count: snapshots.length,
    event_count: eventCount
  }
};

for (const filename of OUTPUT_FILES) {
  fs.writeFileSync(path.join(ROOT, filename), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

const invalid = snapshots.filter(snapshot => snapshot?.list_data?.[0]?.levels?.length !== 150);
if (invalid.length) throw new Error(`${invalid.length} snapshot(s) inválido(s).`);

console.log(`Generated ${snapshots.length} Time Machine snapshots from ${eventCount} historical events.`);
