#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function nowDate() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function backupFile(file) {
  const bak = `${file}.bak.${Date.now()}`;
  fs.copyFileSync(file, bak);
  return bak;
}

function escapeString(s) {
  return String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'').replace(/\n/g,'\\n');
}

function fixPosHistoryBlocks(raw) {
  let out = raw;
  let idx = 0;
  while (true) {
    const keyPos = out.indexOf('"pos_history"', idx);
    if (keyPos === -1) break;
    const startBracket = out.indexOf('[', keyPos);
    if (startBracket === -1) break;
    // find matching closing bracket (skip simple quoted strings)
    let j = startBracket + 1;
    let inString = false;
    let esc = false;
    let depth = 1;
    for (; j < out.length; j++) {
      const ch = out[j];
      if (inString) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inString = false;
      } else {
        if (ch === '"') inString = true;
        else if (ch === '[') depth++;
        else if (ch === ']') { depth--; if (depth === 0) break; }
      }
    }
    if (j >= out.length) break;
    const inner = out.slice(startBracket+1, j);
    // if inner already contains objects with "log1" or strings quoted, skip
    if (/\{\s*"log1"\s*:/.test(inner) || /\"/.test(inner)) {
      idx = j+1;
      continue;
    }
    // split lines and build JSON objects
    const lines = inner.split(/\r?\n/).map(l => l.trim()).filter(l => l.length>0);
    if (lines.length === 0) { idx = j+1; continue; }
    const indentMatch = out.slice(0, startBracket).match(/(^|\n)([ \t]*)[^\n]*$/);
    const baseIndent = indentMatch ? indentMatch[2] + '    ' : '    ';
    const newInner = '\n' + lines.map(l => baseIndent + '{"log1": "' + escapeString(l) + '"}').join(',\n') + '\n' + out.slice(j).match(/^\s*/)[0];
    out = out.slice(0, startBracket+1) + newInner + out.slice(j);
    idx = startBracket + newInner.length + 1;
  }
  return out;
}

function insertMissingCommasTopLevel(raw) {
  let out = '';
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    out += ch;
    if (inString) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '[') { depth++; continue; }
    if (ch === ']') { depth--; continue; }
    if (ch === '}' && depth === 1) {
      let j = i+1;
      while (j < raw.length && /[\s\r\n]/.test(raw[j])) j++;
      if (raw[j] === '{') {
        out += ',';
      }
    }
  }
  return out;
}

function load(file) {
  const raw = fs.readFileSync(file,'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    let fixed = fixPosHistoryBlocks(raw);
    fixed = insertMissingCommasTopLevel(fixed);
    try {
      const parsed = JSON.parse(fixed);
      console.log('Parsed JSON after auto-fix of pos_history blocks and top-level commas.');
      return parsed;
    } catch (e2) {
      throw e2;
    }
  }
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8');
}

function ensurePosHistory(obj) {
  if (!Array.isArray(obj.pos_history)) {
    if (!obj.pos_history) obj.pos_history = [];
    else if (typeof obj.pos_history === 'string') obj.pos_history = [{log1: obj.pos_history}];
    else obj.pos_history = [];
  }
  obj.pos_history = obj.pos_history.map(e => {
    if (typeof e === 'string') return {log1: e};
    if (typeof e === 'object' && e !== null) return e;
    return {log1: String(e)};
  });
}

function formatAll(data) {
  for (const item of data) ensurePosHistory(item);
}

function findIndex(data, spec) {
  if (spec.name) return data.findIndex(x => x.lvl_name === spec.name);
  if (spec.index !== undefined) return spec.index;
  return -1;
}

function addLevel(file, data, levelObj, position) {
  formatAll(data);
  const name = levelObj.lvl_name || ('New Level');
  const pos = (position===undefined||position===null)? data.length : Math.max(0, Math.min(position, data.length));
  data.splice(pos, 0, levelObj);
  const date = nowDate();
  ensurePosHistory(levelObj);
  levelObj.pos_history.push({log1: `${date} - Added to the list at position ${pos+1}`});
  for (let i = pos+1; i < data.length; i++) {
    ensurePosHistory(data[i]);
    data[i].pos_history.push({log1: `${date} - ${name} was added above (-1)`});
  }
}

function deleteLevel(data, spec) {
  formatAll(data);
  const idx = findIndex(data, spec);
  if (idx < 0) throw new Error('level not found');
  const removed = data.splice(idx,1)[0];
  const date = nowDate();
  for (let i = idx; i < data.length; i++) {
    ensurePosHistory(data[i]);
    data[i].pos_history.push({log1: `${date} - ${removed.lvl_name} was removed above (+1)`});
  }
  return removed;
}

function updateLevel(data, spec, updates) {
  formatAll(data);
  const idx = findIndex(data, spec);
  if (idx < 0) throw new Error('level not found');
  const item = data[idx];
  Object.assign(item, updates);
  return item;
}

function moveLevel(data, spec, newPos) {
  formatAll(data);
  const idx = findIndex(data, spec);
  if (idx < 0) throw new Error('level not found');
  const item = data.splice(idx,1)[0];
  const dest = Math.max(0, Math.min(newPos, data.length));
  data.splice(dest,0,item);
  const date = nowDate();
  const oldPos = idx+1, newPosition = dest+1;
  const delta = Math.abs(oldPos - newPosition);
  const sign = (oldPos > newPosition)? `+${delta}` : `-${delta}`;
  ensurePosHistory(item);
  item.pos_history.push({log1: `${date} - Moved to position ${newPosition} (${sign})`});
  const name = item.lvl_name;
  if (oldPos > newPosition) {
    for (let i = newPosition-1; i <= oldPos-2; i++) {
      ensurePosHistory(data[i]);
      data[i].pos_history.push({log1: `${date} - ${name} was moved above (-1)`});
    }
  } else if (oldPos < newPosition) {
    for (let i = oldPos-1; i <= newPosition-1; i++) {
      ensurePosHistory(data[i]);
      data[i].pos_history.push({log1: `${date} - ${name} was moved below (+1)`});
    }
  }
}

function usage() {
  console.log('Usage: node manage_levels.js --file <path> <command> [options]');
  console.log('Commands:');
  console.log('  list                                             List all levels');
  console.log('  search <query>                                   Search levels by name/creator/position');
  console.log('  add --json <jsonString> [--pos N]                Add a level (provide full JSON object)');
  console.log('  add --from <path> [--pos N]                      Add a level from file');
  console.log('  add --name "<name>" --video_url "<url>" --lvl_creator "<creator>" [--diff_rank "<rank>"] [--diff_scale "<scale>"] [--pos_aredl N] [--pos N]   Add level using simple flags');
  console.log('  delete --name <lvl_name> | --index N             Delete a level');
  console.log('  update --name <lvl_name> --json <patch>          Update properties (patch is JSON)');
  console.log('  move --name <lvl_name> --pos N                   Move level to new position (1-based)');
  console.log('  format                                           Normalize pos_history for all levels');
  console.log('  menu                                             Open interactive menu (try this!)');
}

function getArg(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i+1];
}

async function main() {
  const file = getArg('--file') || 'levels_main.json';
  
  // Get command - it should be the first arg that doesn't start with -- and is not after a flag value
  let cmd = undefined;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith('--') && (i === 2 || !process.argv[i-1].startsWith('--'))) {
      cmd = arg;
      break;
    }
  }
  
  if (!cmd) { usage(); return; }
  if (!fs.existsSync(file)) { console.error('file not found:', file); process.exit(1); }
  const data = load(file);
  try {
    switch(cmd) {
      case 'add': {
        const from = getArg('--from');
        const jsonStr = getArg('--json');
        const posArg = getArg('--pos');
        const pos = posArg ? parseInt(posArg,10)-1 : undefined;
        let obj;
        if (from) obj = JSON.parse(fs.readFileSync(from,'utf8'));
        else if (jsonStr) obj = JSON.parse(jsonStr);
        else {
          const name = getArg('--name') || getArg('--lvl_name');
          const video_url = getArg('--video_url') || getArg('--video');
          const lvl_creator = getArg('--lvl_creator') || getArg('--creator');
          const diff_rank = getArg('--diff_rank');
          const diff_scale = getArg('--diff_scale');
          const pos_aredl = getArg('--pos_aredl');
          if (!name) { console.error('provide --from, --json or --name'); process.exit(1); }
          obj = {};
          if (name) obj.lvl_name = name;
          if (video_url) obj.video_url = video_url;
          if (lvl_creator) obj.lvl_creator = lvl_creator;
          if (diff_rank) obj.diff_rank = diff_rank;
          if (diff_scale) obj.diff_scale = diff_scale;
          if (pos_aredl) obj.pos_aredl = parseInt(pos_aredl,10);
        }
        backupFile(file);
        addLevel(file, data, obj, pos);
        save(file, data);
        console.log('added', obj.lvl_name);
        break;
      }
      case 'delete': {
        const name = getArg('--name');
        const index = getArg('--index');
        const spec = name ? {name} : (index? {index: parseInt(index,10)}:{});
        backupFile(file);
        const removed = deleteLevel(data, spec);
        save(file, data);
        console.log('deleted', removed.lvl_name);
        break;
      }
      case 'update': {
        const name = getArg('--name');
        const jsonStr = getArg('--json');
        if (!name || !jsonStr) { console.error('provide --name and --json'); process.exit(1); }
        const patch = JSON.parse(jsonStr);
        backupFile(file);
        const updated = updateLevel(data, {name}, patch);
        save(file, data);
        console.log('updated', updated.lvl_name);
        break;
      }
      case 'move': {
        const name = getArg('--name');
        const pos = getArg('--pos');
        if (!name || !pos) { console.error('provide --name and --pos'); process.exit(1); }
        const newPos = parseInt(pos,10)-1;
        backupFile(file);
        moveLevel(data, {name}, newPos);
        save(file, data);
        console.log('moved', name, 'to', newPos+1);
        break;
      }
      case 'format': {
        backupFile(file);
        formatAll(data);
        save(file, data);
        console.log('formatted pos_history in', file);
        break;
      }
      case 'list': {
        data.forEach((it,i)=> console.log(`${i+1}. ${it.lvl_name}`));
        break;
      }
      case 'search': {
        // Get query - it's the argument right after "search"
        const searchIdx = process.argv.indexOf('search');
        const query = (process.argv[searchIdx + 1] || '').toLowerCase();
        if (!query) { console.error('Usage: search <query>'); process.exit(1); }
        const results = data.filter((item, idx) => {
          const name = (item.lvl_name || '').toLowerCase();
          const creator = (item.lvl_creator || '').toLowerCase();
          const pos = String(idx + 1);
          return name.includes(query) || creator.includes(query) || pos === query;
        });
        if (results.length === 0) {
          console.log('❌ No results found.');
        } else {
          console.log(`✅ Found ${results.length} result(s):\n`);
          results.forEach(item => {
            const idx = data.indexOf(item);
            console.log(`  ${idx+1}. ${item.lvl_name} by ${item.lvl_creator}`);
          });
        }
        break;
      }
      case 'menu': {
        console.log('Opening interactive menu...');
        const cli = require('./cli.cjs');
        // cli.menu is async
        await cli.menu();
        break;
      }
      default: usage(); break;
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

if (require.main === module) main();
