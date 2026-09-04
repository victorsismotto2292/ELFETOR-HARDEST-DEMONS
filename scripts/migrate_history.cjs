#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  ROOT,
  HISTORY_DIR,
  HISTORY_INDEX,
  LIST_FILES,
  LIMITS,
  clone,
  loadListsFromObject,
  compareLists,
  formatLocalParts,
  makeSnapshot,
  rebuildHistoryIndex
} = require('./history_manager.cjs');

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function getListCommits() {
  const output = git(
    'log',
    '--reverse',
    '--format=%H|%cI|%s',
    'main',
    '--',
    LIST_FILES.main,
    LIST_FILES.extended,
    LIST_FILES.legacy
  );

  const commits = [];
  const seen = new Set();
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const first = line.indexOf('|');
    const second = line.indexOf('|', first + 1);
    if (first < 0 || second < 0) continue;
    const sha = line.slice(0, first);
    const date = line.slice(first + 1, second);
    const subject = line.slice(second + 1);
    if (seen.has(sha)) continue;
    seen.add(sha);
    commits.push({ sha, date, subject });
  }

  commits.sort((a, b) => new Date(a.date) - new Date(b.date));
  return commits;
}

function readListsAtCommit(sha) {
  const lists = {};
  for (const [key, filename] of Object.entries(LIST_FILES)) {
    try {
      lists[key] = JSON.parse(git('show', `${sha}:${filename}`));
    } catch {
      return null;
    }
  }
  return lists;
}

function firstCommitOnOrAfter(commits, timestamp) {
  const when = new Date(timestamp);
  return commits.find(commit => new Date(commit.date) >= when) || null;
}

function commitBefore(commits, timestamp) {
  const when = new Date(timestamp);
  let chosen = null;
  for (const commit of commits) {
    if (new Date(commit.date) < when) chosen = commit;
    else break;
  }
  return chosen;
}

function datesBetween(startDate, endDate) {
  const result = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function localDateKey(dateLike) {
  return formatLocalParts(dateLike).date;
}

function localMidnight(dateKey) {
  return new Date(`${dateKey}T00:00:00-03:00`);
}

function historicalLevel(level) {
  if (!level) return null;
  const copy = JSON.parse(JSON.stringify(level));
  delete copy.pos_history;
  return copy;
}

function compactLists(lists) {
  return {
    main: (lists.main || []).map(historicalLevel),
    extended: (lists.extended || []).map(historicalLevel),
    legacy: (lists.legacy || []).map(historicalLevel)
  };
}

function compactTop150(lists) {
  return [...(lists.main || []), ...(lists.extended || [])]
    .slice(0, LIMITS.EXTENDED_MAX)
    .map(historicalLevel);
}

function main() {
  const commits = getListCommits();
  if (!commits.length) throw new Error('Nenhum commit de lista encontrado.');

  const startDate = process.env.HISTORY_START || '2026-01-15';
  const lastCommit = commits[commits.length - 1];
  const endDate = localDateKey(lastCommit.date);

  fs.mkdirSync(HISTORY_DIR, { recursive: true });

  console.log(`Encontrados ${commits.length} commits que alteram os JSON das listas.`);

  const states = new Map();
  for (const commit of commits) {
    const lists = readListsAtCommit(commit.sha);
    if (lists) states.set(commit.sha, lists);
  }

  const relevantCommits = commits.filter(commit => states.has(commit.sha) && localDateKey(commit.date) >= startDate);
  if (!relevantCommits.length) throw new Error(`Nenhum commit encontrado a partir de ${startDate}.`);

  const firstRelevant = relevantCommits[0];
  const firstBefore = commitBefore(commits, firstRelevant.date);
  let previousLists = firstBefore ? states.get(firstBefore.sha) : states.get(firstRelevant.sha);

  const dayKeys = datesBetween(localMidnight(startDate), localMidnight(endDate)).map(localDateKey);

  // Prepare one JSON document per day, keeping the same daily organization used by the old TXT archive.
  for (const dayKey of dayKeys) {
    const dayStart = localMidnight(dayKey);
    const beforeCommit = commitBefore(commits, dayStart.toISOString());
    const baseline = beforeCommit && states.has(beforeCommit.sha)
      ? states.get(beforeCommit.sha)
      : previousLists;

    const parts = formatLocalParts(dayStart);
    const filePath = path.join(HISTORY_DIR, parts.year, parts.month, `${parts.fileDate} - Changelog.json`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const document = {
      schema_version: 2,
      date: parts.date,
      display_date: parts.displayDate,
      timezone: 'America/Sao_Paulo',
      source: 'Git commit history migration',
      day_start: {
        date: dayStart.toISOString(),
        local_date: `${parts.displayDate} 00:00:00`,
        source_commit: beforeCommit?.sha?.slice(0, 12) || null,
        list_data: [{
          date: `${parts.displayDate} 00:00:00`,
          levels: compactTop150(baseline)
        }],
        lists: compactLists(baseline)
      },
      changes: []
    };

    fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }

  let migrated = 0;
  let changedLevels = 0;
  let previous = null;

  for (const commit of relevantCommits) {
    const current = states.get(commit.sha);
    const old = previous || (() => {
      const before = commitBefore(commits, commit.date);
      return before && states.has(before.sha) ? states.get(before.sha) : null;
    })();

    if (!old) {
      previous = current;
      continue;
    }

    const changes = compareLists(old, current);
    const parts = formatLocalParts(commit.date);
    const filePath = path.join(HISTORY_DIR, parts.year, parts.month, `${parts.fileDate} - Changelog.json`);
    const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const event = {
      time: `${parts.hour}:${parts.minute}:${parts.second}`,
      timestamp: new Date(commit.date).toISOString(),
      local_timestamp: parts.displayDateTime,
      commit: commit.sha.slice(0, 12),
      full_commit: commit.sha,
      operation: changes.some(change => change.change_type.includes('added')) ? 'add' :
        changes.some(change => change.change_type.includes('removed')) ? 'remove' :
        changes.some(change => change.change_type.includes('moved')) ? 'move' : 'update',
      message: commit.subject,
      changed_count: changes.length,
      changes,
      list_data: makeSnapshot(commit.date, current, commit.sha.slice(0, 12), 'git-migration').list_data,
      lists: compactLists(current)
    };

    document.changes.push(event);
    document.changes.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    document.last_update = event.local_timestamp;
    document.change_count = document.changes.length;
    fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

    migrated += 1;
    changedLevels += changes.length;
    previous = current;
  }

  // The legacy TXT archive is removed separately after validation, so a failed migration can be inspected safely.
  const index = rebuildHistoryIndex();

  console.log(`Migrados ${migrated} eventos de lista; ${changedLevels} registros de nível alterados.`);
  console.log(`Índice gerado: ${HISTORY_INDEX}`);
  console.log(`Dias convertidos: ${index.files.length}`);

  // Basic integrity validation.
  for (const item of index.files) {
    const doc = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, item.file), 'utf8'));
    if (!Array.isArray(doc.day_start?.list_data?.[0]?.levels) || doc.day_start.list_data[0].levels.length !== 150) {
      throw new Error(`Snapshot inicial inválido em ${item.file}`);
    }
    for (const event of doc.changes) {
      if (!Array.isArray(event.list_data?.[0]?.levels) || event.list_data[0].levels.length !== 150) {
        throw new Error(`Snapshot de evento inválido em ${item.file} (${event.commit})`);
      }
    }
  }

  console.log('Validação dos snapshots concluída com sucesso.');
}

main();
