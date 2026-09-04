const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HISTORY_DIR = path.join(ROOT, 'demonlist_history');
const HISTORY_INDEX = path.join(HISTORY_DIR, 'HISTORY_INDEX.json');

const LIST_FILES = {
  main: 'levels_main.json',
  extended: 'levels_extended.json',
  legacy: 'levels_legacy.json'
};

const LIMITS = {
  MAIN_MAX: 75,
  EXTENDED_MAX: 150
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function historicalLevel(level) {
  if (!level) return null;
  const copy = clone(level);
  delete copy.pos_history;
  return copy;
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function listFromPosition(position) {
  if (position <= LIMITS.MAIN_MAX) return 'main';
  if (position <= LIMITS.EXTENDED_MAX) return 'extended';
  return 'legacy';
}

function flattenLists(lists, includeLegacy = true) {
  const result = [];
  const sections = [
    ['main', lists.main || [], 1],
    ['extended', lists.extended || [], LIMITS.MAIN_MAX + 1]
  ];
  if (includeLegacy) sections.push(['legacy', lists.legacy || [], LIMITS.EXTENDED_MAX + 1]);

  for (const [list, levels, startPosition] of sections) {
    levels.forEach((level, index) => {
      result.push({
        level,
        list,
        position: startPosition + index
      });
    });
  }

  return result;
}

function loadCurrentLists() {
  const lists = {};
  for (const [key, filename] of Object.entries(LIST_FILES)) {
    lists[key] = JSON.parse(fs.readFileSync(path.join(ROOT, filename), 'utf8'));
  }
  return lists;
}

function loadListsFromObject(input) {
  if (Array.isArray(input)) {
    const flat = input.slice();
    return {
      main: flat.slice(0, LIMITS.MAIN_MAX),
      extended: flat.slice(LIMITS.MAIN_MAX, LIMITS.EXTENDED_MAX),
      legacy: flat.slice(LIMITS.EXTENDED_MAX)
    };
  }

  return {
    main: Array.isArray(input?.main) ? input.main : [],
    extended: Array.isArray(input?.extended) ? input.extended : [],
    legacy: Array.isArray(input?.legacy) ? input.legacy : []
  };
}

function comparableLevel(level) {
  const copy = clone(level || {});
  delete copy.pos_history;
  return copy;
}

function levelChanged(before, after) {
  return JSON.stringify(comparableLevel(before)) !== JSON.stringify(comparableLevel(after));
}

function changedFields(before, after) {
  const fields = new Set([
    ...Object.keys(comparableLevel(before)),
    ...Object.keys(comparableLevel(after))
  ]);

  const changes = {};
  for (const field of fields) {
    const oldValue = comparableLevel(before)[field];
    const newValue = comparableLevel(after)[field];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[field] = {
        before: oldValue === undefined ? null : oldValue,
        after: newValue === undefined ? null : newValue
      };
    }
  }
  return changes;
}

function buildChangeRecord(beforeEntry, afterEntry) {
  const before = beforeEntry?.level || null;
  const after = afterEntry?.level || null;
  const oldPosition = beforeEntry?.position ?? null;
  const newPosition = afterEntry?.position ?? null;
  const oldList = beforeEntry?.list ?? null;
  const newList = afterEntry?.list ?? null;

  const type = [];
  if (!before && after) type.push('added');
  else if (before && !after) type.push('removed');
  else if (oldPosition !== newPosition || oldList !== newList) type.push('moved');
  if (before && after && levelChanged(before, after)) type.push('updated');

  if (!type.length) return null;

  return {
    lvl_name: after?.lvl_name || before?.lvl_name || '(unknown)',
    change_type: type,
    old_position: oldPosition,
    new_position: newPosition,
    old_list: oldList,
    new_list: newList,
    changed_fields: before && after ? changedFields(before, after) : {},
    before: historicalLevel(before),
    after: historicalLevel(after)
  };
}

function compareLists(beforeLists, afterLists) {
  const beforeEntries = flattenLists(loadListsFromObject(beforeLists));
  const afterEntries = flattenLists(loadListsFromObject(afterLists));

  const beforeMap = new Map();
  const afterMap = new Map();

  for (const entry of beforeEntries) {
    const key = normalizeName(entry.level?.lvl_name);
    if (key) beforeMap.set(key, entry);
  }
  for (const entry of afterEntries) {
    const key = normalizeName(entry.level?.lvl_name);
    if (key) afterMap.set(key, entry);
  }

  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const changes = [];

  for (const key of keys) {
    const change = buildChangeRecord(beforeMap.get(key), afterMap.get(key));
    if (change) changes.push(change);
  }

  changes.sort((a, b) => {
    const aPos = a.new_position ?? a.old_position ?? Number.MAX_SAFE_INTEGER;
    const bPos = b.new_position ?? b.old_position ?? Number.MAX_SAFE_INTEGER;
    return aPos - bPos || a.lvl_name.localeCompare(b.lvl_name);
  });

  return changes;
}

function formatLocalParts(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) throw new Error('Data inválida para o histórico.');

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    displayDate: `${parts.month}/${parts.day}/${parts.year}`,
    displayDateTime: `${parts.month}/${parts.day}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`,
    fileDate: `${parts.month}.${parts.day}.${parts.year}`
  };
}

function historyFilePath(dateLike) {
  const parts = formatLocalParts(dateLike);
  const yearDir = path.join(HISTORY_DIR, parts.year);
  const monthDir = path.join(yearDir, parts.month);
  fs.mkdirSync(monthDir, { recursive: true });
  return path.join(monthDir, `${parts.fileDate} - Changelog.json`);
}

function makeSnapshot(dateLike, lists, sourceCommit = null, sourceType = 'cli') {
  const parts = formatLocalParts(dateLike);
  const snapshotLists = loadListsFromObject(lists);
  const first150 = [
    ...snapshotLists.main,
    ...snapshotLists.extended
  ].slice(0, LIMITS.EXTENDED_MAX);

  return {
    date: dateLike instanceof Date ? dateLike.toISOString() : String(dateLike),
    local_date: parts.displayDateTime,
    source: sourceType,
    source_commit: sourceCommit,
    list_data: [{
      date: parts.displayDateTime,
      levels: first150.map(historicalLevel)
    }],
    lists: {
      main: snapshotLists.main.map(historicalLevel),
      extended: snapshotLists.extended.map(historicalLevel),
      legacy: snapshotLists.legacy.map(historicalLevel)
    }
  };
}

function readHistoryFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDayDocument(dateLike, dayStartSnapshot) {
  const filePath = historyFilePath(dateLike);
  let document = readHistoryFile(filePath);

  if (!document) {
    const parts = formatLocalParts(dateLike);
    document = {
      schema_version: 2,
      date: parts.date,
      display_date: parts.displayDate,
      timezone: 'America/Sao_Paulo',
      source: 'ELFETOR list history',
      day_start: {
        date: `${parts.date}T00:00:00-03:00`,
        local_date: `${parts.displayDate} 00:00:00`,
        source_commit: dayStartSnapshot?.source_commit || null,
        list_data: clone(dayStartSnapshot?.list_data || [{ date: `${parts.displayDate} 00:00:00`, levels: [] }]),
        lists: clone(dayStartSnapshot?.lists || { main: [], extended: [], legacy: [] })
      },
      changes: []
    };
  }

  return { filePath, document };
}

function appendHistoryEvent({ timestamp, beforeLists, afterLists, commit = null, message, operation = 'change', source = 'cli' }) {
  const when = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(when.getTime())) throw new Error('Timestamp inválido para o histórico.');

  const parts = formatLocalParts(when);
  const before = loadListsFromObject(beforeLists);
  const after = loadListsFromObject(afterLists);
  const changes = compareLists(before, after);

  const startSnapshot = makeSnapshot(
    new Date(`${parts.date}T00:00:00-03:00`),
    before,
    commit,
    source
  );

  const { filePath, document } = ensureDayDocument(when, startSnapshot);
  const eventSnapshot = makeSnapshot(when, after, commit, source);

  const event = {
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    timestamp: when.toISOString(),
    local_timestamp: parts.displayDateTime,
    commit,
    operation,
    message: message || '',
    changed_count: changes.length,
    changes,
    list_data: clone(eventSnapshot.list_data),
    lists: clone(eventSnapshot.lists)
  };

  const existingIndex = document.changes.findIndex(item => item.commit && commit && item.commit === commit);
  if (existingIndex >= 0) document.changes[existingIndex] = event;
  else document.changes.push(event);

  document.changes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  document.last_update = event.local_timestamp;
  document.change_count = document.changes.length;

  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return { filePath, document, event, changes };
}

function rebuildHistoryIndex() {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /^\d{2}\.\d{2}\.\d{4} - Changelog\.json$/.test(entry.name)) files.push(full);
    }
  }
  walk(HISTORY_DIR);

  files.sort();
  const days = files.map(file => {
    const document = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      date: document.date,
      file: path.relative(HISTORY_DIR, file).replace(/\\/g, '/'),
      change_count: document.changes.length,
      last_update: document.last_update || null
    };
  });

  const payload = {
    schema_version: 2,
    timezone: 'America/Sao_Paulo',
    source: 'demonlist_history JSON changelogs',
    files: days
  };

  fs.writeFileSync(HISTORY_INDEX, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return payload;
}

module.exports = {
  ROOT,
  HISTORY_DIR,
  HISTORY_INDEX,
  LIST_FILES,
  LIMITS,
  clone,
  loadCurrentLists,
  loadListsFromObject,
  flattenLists,
  compareLists,
  formatLocalParts,
  historyFilePath,
  makeSnapshot,
  appendHistoryEvent,
  rebuildHistoryIndex,
  normalizeName
};
