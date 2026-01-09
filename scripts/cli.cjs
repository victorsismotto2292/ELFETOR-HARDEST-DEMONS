#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ===== CONSTANTES =====
const MAIN_LIST_FILE = 'levels_main.json';
const EXTENDED_LIST_FILE = 'levels_extended.json';
const LEGACY_LIST_FILE = 'levels_legacy.json';
const TOP_150_THRESHOLD = 150;

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  fs.copyFileSync(file, `${file}.bak.${Date.now()}`);
}

function ensurePosHistory(obj) {
  if (!Array.isArray(obj.pos_history)) obj.pos_history = [];
  obj.pos_history = obj.pos_history.map(e => 
    typeof e === 'string' ? {log1: e} : (e && typeof e === 'object' ? e : {log1: String(e)})
  );
}

function nowDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function appendChangelog(entry) {
  const file = 'CHANGELOGS.md';
  const date = new Date().toLocaleString('pt-BR');
  const line = `- ${date} - ${entry}\n`;
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, '# Changelogs\n\n', 'utf8');
    fs.appendFileSync(file, line, 'utf8');
    try {
      updateReadmeSummary(date, entry);
    } catch (e) {
      console.error('Falha ao atualizar README.md:', e.message);
    }
  } catch (e) {
    console.error('Falha ao escrever CHANGELOGS.md:', e.message);
  }
}

function updateReadmeSummary(date, entry) {
  const file = 'README.md';
  const startMarker = '<!--LATEST-CHANGES-START-->';
  const endMarker = '<!--LATEST-CHANGES-END-->';
  const header = `## Últimas alterações\n\n`;
  const newBlock = `${startMarker}\n${header}- ${date} — ${entry}\n${endMarker}\n`;
  let content = '';
  if (fs.existsSync(file)) content = fs.readFileSync(file, 'utf8');

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const before = content.split(startMarker)[0];
    const after = content.split(endMarker)[1] || '';
    content = before + newBlock + after;
  } else {
    const idx = content.indexOf('\n');
    if (idx !== -1) {
      content = content.slice(0, idx + 1) + '\n' + newBlock + '\n' + content.slice(idx + 1);
    } else {
      content = newBlock + '\n' + content;
    }
  }
  fs.writeFileSync(file, content, 'utf8');
}

function ensureGitAvailable() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    const remotes = execSync('git remote', { encoding: 'utf8' }).trim();
    if (!remotes) throw new Error('Nenhum remote configurado');
    return true;
  } catch (e) {
    throw new Error('git não disponível ou remote não configurado');
  }
}

function gitCommitAndPush(files, message) {
  try {
    if (process.env.SIMULATE_GIT === '1') {
      console.log('[SIM] git add', Array.isArray(files) ? files.join(' ') : files);
      console.log('[SIM] git commit -m "' + message + '"');
      console.log('[SIM] git push');
      return true;
    }
    ensureGitAvailable();
    const addList = Array.isArray(files) ? files.join(' ') : files;
    execSync(`git add ${addList}`, { stdio: 'ignore' });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
    execSync('git push', { stdio: 'ignore' });
    return true;
  } catch (e) {
    console.error('Git commit/push falhou:', e.message);
    return false;
  }
}

// ===== FUNÇÕES ESPECÍFICAS DA LEGACY LIST =====

function moveToLegacy(level) {
  const legacyData = load(LEGACY_LIST_FILE);
  const date = nowDate();
  
  // Adicionar ao histórico do nível
  ensurePosHistory(level);
  level.pos_history.push({
    log1: `${date} - Moved to Legacy List (fell out of Top 150)`
  });
  
  // Adicionar à Legacy List
  legacyData.push(level);
  save(LEGACY_LIST_FILE, legacyData);
  
  return level.lvl_name;
}

function moveFromLegacy(levelName) {
  const legacyData = load(LEGACY_LIST_FILE);
  const date = nowDate();
  
  // Encontrar nível na Legacy List
  const legacyIdx = legacyData.findIndex(l => l.lvl_name === levelName);
  if (legacyIdx === -1) {
    console.log('❌ Nível não encontrado na Legacy List.\n');
    return null;
  }
  
  const level = legacyData.splice(legacyIdx, 1)[0];
  
  // Atualizar histórico dos níveis restantes na Legacy
  for (let i = legacyIdx; i < legacyData.length; i++) {
    ensurePosHistory(legacyData[i]);
    legacyData[i].pos_history.push({ 
      log1: `${date} - ${levelName} was promoted to Main List (+1)` 
    });
  }
  
  save(LEGACY_LIST_FILE, legacyData);
  
  // Adicionar ao histórico do nível promovido
  ensurePosHistory(level);
  level.pos_history.push({
    log1: `${date} - Promoted from Legacy List to Main List`
  });
  
  return level;
}

function checkAndMoveToLegacy() {
  const mainData = load(MAIN_LIST_FILE);
  const movedLevels = [];
  
  // Verificar se há níveis além da posição 150
  while (mainData.length > TOP_150_THRESHOLD) {
    const level = mainData.pop(); // Remove o último (posição > 150)
    const name = moveToLegacy(level);
    movedLevels.push(name);
  }
  
  if (movedLevels.length > 0) {
    save(MAIN_LIST_FILE, mainData);
    console.log(`\n📦 ${movedLevels.length} nível(is) movido(s) para Legacy List:`);
    movedLevels.forEach(name => console.log(`  - ${name}`));
  }
  
  return movedLevels;
}

// ===== LISTAR =====
async function list(file) {
  const data = load(file);
  const listName = file === LEGACY_LIST_FILE ? 'LEGACY' : 
                   file === EXTENDED_LIST_FILE ? 'EXTENDED' : 'MAIN';
  
  console.log(`\n📊 ${listName} LIST (${data.length} níveis):\n`);
  data.slice(0, 20).forEach((l, i) => {
    const pos = file === LEGACY_LIST_FILE ? i + 151 : 
                file === EXTENDED_LIST_FILE ? i + 76 : i + 1;
    console.log(`  ${pos}. ${l.lvl_name} - ${l.lvl_creator || 'unknown'}`);
  });
  if (data.length > 20) console.log(`  ... e ${data.length - 20} mais\n`);
  else console.log('');
}

// ===== BUSCAR =====
async function search(file) {
  const data = load(file);
  const query = (await ask('\n🔍 Buscar (nome/criador): ')).toLowerCase();
  if (!query) return;
  
  const results = data.filter(l => 
    (l.lvl_name || '').toLowerCase().includes(query) ||
    (l.lvl_creator || '').toLowerCase().includes(query)
  );
  
  console.log(`\n✅ ${results.length} resultado(s):\n`);
  results.forEach(l => {
    const idx = data.indexOf(l);
    const pos = file === LEGACY_LIST_FILE ? idx + 151 : 
                file === EXTENDED_LIST_FILE ? idx + 76 : idx + 1;
    console.log(`  ${pos}. ${l.lvl_name} by ${l.lvl_creator}`);
  });
  console.log('');
}

// ===== ADICIONAR COM HISTÓRICO AUTOMÁTICO =====
async function addWithHistory(file) {
  const listType = file === MAIN_LIST_FILE ? 'MAIN' : 
                   file === EXTENDED_LIST_FILE ? 'EXTENDED' : 'LEGACY';
  
  console.log(`\n➕ ADICIONAR NÍVEL À ${listType} LIST:`);
  const data = load(file);
  const beforeTop = file === MAIN_LIST_FILE ? data.slice(0, 150).map(d => d.lvl_name) : [];
  
  const name = await ask('Nome do nível: ');
  if (!name) { console.log('❌ Cancelado.\n'); return; }
  
  const creator = await ask('Criador: ') || '';
  const url = await ask('URL vídeo (Enter = pular): ') || '';
  const rank = await ask('Rank (Enter = pular): ') || '';
  const scale = await ask('Scale (Enter = pular): ') || '';
  const aredl = await ask('Posição AREDL (Enter = pular): ') || '0';
  const pos = await ask(`Posição na ${listType} (Enter = final): `);
  
  const obj = { 
    lvl_name: name, 
    lvl_creator: creator, 
    video_url: url, 
    diff_rank: rank, 
    diff_scale: scale, 
    pos_aredl: parseInt(aredl) || 0,
    pos_history: []
  };
  
  ensurePosHistory(obj);
  
  const idx = pos ? Math.max(0, Math.min(parseInt(pos) - 1, data.length)) : data.length;
  
  // Inserir nível
  data.splice(idx, 0, obj);
  
  // Adicionar histórico em TODAS as listas (incluindo Legacy)
  const date = nowDate();
  const above = idx > 0 ? data[idx - 1].lvl_name : null;
  const below = idx + 1 < data.length ? data[idx + 1].lvl_name : null;
  
  let positionDesc = `Added to the ${listType} List at position ${idx + 1}`;
  if (above || below) {
    const parts = [];
    if (above) parts.push(`below ${above}`);
    if (below) parts.push(`above ${below}`);
    positionDesc += `, ${parts.join(' and ')}`;
  }
  
  obj.pos_history.push({ log1: `${date} - ${positionDesc}` });
  
  // Atualizar histórico dos níveis abaixo
  for (let i = idx + 1; i < data.length; i++) {
    ensurePosHistory(data[i]);
    data[i].pos_history.push({ log1: `${date} - ${name} was added above (-1)` });
  }

  save(file, data);
  
  // Verificar se precisa mover para Legacy (apenas para Main List)
  let movedToLegacy = [];
  if (file === MAIN_LIST_FILE) {
    movedToLegacy = checkAndMoveToLegacy();
  }
  
  const displayPos = file === LEGACY_LIST_FILE ? `#${idx + 151}` : 
                     file === EXTENDED_LIST_FILE ? `#${idx + 76}` : `#${idx + 1}`;
  
  console.log(`\n✅ Nível "${name}" adicionado na posição ${displayPos}!`);
  console.log(`📝 Histórico atualizado para ${data.length - idx - 1} níveis abaixo.\n`);
  
  // Changelog + commit
  const afterTop = file === MAIN_LIST_FILE ? data.slice(0, 150).map(d => d.lvl_name) : [];
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  const removedFromTop = beforeTop.filter(n => !afterTop.includes(n));
  
  let desc = `${name} foi adicionado na ${listType} List posição ${displayPos}`;
  const aboveLevel = idx > 0 ? data[idx - 1].lvl_name : null;
  const belowLevel = idx + 1 < data.length ? data[idx + 1].lvl_name : null;
  if (aboveLevel || belowLevel) {
    const parts = [];
    if (aboveLevel) parts.push(`abaixo de ${aboveLevel}`);
    if (belowLevel) parts.push(`acima de ${belowLevel}`);
    desc += ', ' + parts.join(' e ');
  }
  if (movedToLegacy.length) {
    desc += `, fazendo com que ${movedToLegacy.join(', ')} caia(m) para a Legacy List`;
  }
  if (removedFromTop.length && !movedToLegacy.includes(removedFromTop[0])) {
    desc += `, fazendo com que ${removedFromTop.join(', ')} caia(m) para a Legacy List`;
  }
  if (addedToTop.length && !addedToTop.includes(name)) {
    desc += `, fazendo com que ${addedToTop.join(', ')} entre(m) para o Top 150`;
  }
  
  appendChangelog(desc);
  const filesToCommit = file === MAIN_LIST_FILE ? 
    [file, LEGACY_LIST_FILE, 'CHANGELOGS.md', 'README.md'] : 
    [file, 'CHANGELOGS.md', 'README.md'];
  const ok = gitCommitAndPush(filesToCommit, `Adicionado: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== MOVER COM HISTÓRICO AUTOMÁTICO =====
async function moveWithHistory(file) {
  const data = load(file);
  const listType = file === MAIN_LIST_FILE ? 'MAIN' : 
                   file === EXTENDED_LIST_FILE ? 'EXTENDED' : 'LEGACY';
  
  console.log(`\n➡️  MOVER NÍVEL NA ${listType} LIST:`);
  data.slice(0, 10).forEach((l, i) => {
    const displayPos = file === LEGACY_LIST_FILE ? i + 151 : 
                       file === EXTENDED_LIST_FILE ? i + 76 : i + 1;
    console.log(`  ${displayPos}. ${l.lvl_name}`);
  });
  if (data.length > 10) console.log(`  ... (total: ${data.length})`);
  
  const from = await ask('\nPosição atual (ou nome): ');
  if (!from) { console.log('❌ Cancelado.\n'); return; }
  
  // Buscar por nome ou posição
  let fromIdx;
  if (isNaN(from)) {
    fromIdx = data.findIndex(l => l.lvl_name.toLowerCase() === from.toLowerCase());
    if (fromIdx === -1) {
      console.log('❌ Nível não encontrado.\n');
      return;
    }
  } else {
    const adjustedPos = file === LEGACY_LIST_FILE ? parseInt(from) - 151 : 
                        file === EXTENDED_LIST_FILE ? parseInt(from) - 76 : parseInt(from) - 1;
    fromIdx = adjustedPos;
  }
  
  if (fromIdx < 0 || fromIdx >= data.length) { 
    console.log('❌ Posição inválida.\n'); 
    return; 
  }
  
  const to = await ask('Nova posição: ');
  const adjustedToPos = file === LEGACY_LIST_FILE ? parseInt(to) - 151 : 
                        file === EXTENDED_LIST_FILE ? parseInt(to) - 76 : parseInt(to) - 1;
  const toIdx = Math.max(0, Math.min(adjustedToPos, data.length - 1));
  
  if (fromIdx === toIdx) {
    console.log('⚠️ Nível já está nessa posição.\n');
    return;
  }
  
  const beforeTop = file === MAIN_LIST_FILE ? data.slice(0, 150).map(d => d.lvl_name) : [];
  const item = data.splice(fromIdx, 1)[0];
  data.splice(toIdx, 0, item);

  // Adicionar histórico em TODAS as listas (incluindo Legacy)
  const date = nowDate();
  const oldPos = fromIdx + 1;
  const newPos = toIdx + 1;
  const delta = Math.abs(oldPos - newPos);
  const sign = (oldPos > newPos) ? `+${delta}` : `-${delta}`;
  
  const above = toIdx > 0 ? data[toIdx - 1].lvl_name : null;
  const below = toIdx + 1 < data.length ? data[toIdx + 1].lvl_name : null;
  
  ensurePosHistory(item);
  let moveDesc = `Moved to position ${newPos} (${sign})`;
  if (above || below) {
    const parts = [];
    if (above) parts.push(`below ${above}`);
    if (below) parts.push(`above ${below}`);
    moveDesc += `, ${parts.join(' and ')}`;
  }
  item.pos_history.push({ log1: `${date} - ${moveDesc}` });
  
  // Atualizar histórico dos níveis afetados
  const name = item.lvl_name;
  
  if (oldPos > newPos) {
    for (let i = toIdx + 1; i <= fromIdx; i++) {
      ensurePosHistory(data[i]);
      data[i].pos_history.push({ log1: `${date} - ${name} was moved above (-1)` });
    }
  } else {
    for (let i = fromIdx; i < toIdx; i++) {
      ensurePosHistory(data[i]);
      data[i].pos_history.push({ log1: `${date} - ${name} was moved below (+1)` });
    }
  }

  save(file, data);
  
  // Verificar se precisa mover para Legacy (apenas para Main List)
  let movedToLegacy = [];
  if (file === MAIN_LIST_FILE) {
    movedToLegacy = checkAndMoveToLegacy();
  }
  
  const oldDisplayPos = file === LEGACY_LIST_FILE ? fromIdx + 151 : 
                        file === EXTENDED_LIST_FILE ? fromIdx + 76 : fromIdx + 1;
  const newDisplayPos = file === LEGACY_LIST_FILE ? toIdx + 151 : 
                        file === EXTENDED_LIST_FILE ? toIdx + 76 : toIdx + 1;
  
  console.log(`\n✅ "${item.lvl_name}" movido de #${oldDisplayPos} para #${newDisplayPos}!`);
  console.log(`📝 Histórico atualizado para ${Math.abs(fromIdx - toIdx)} níveis.\n`);
  
  // Changelog
  const afterTop = file === MAIN_LIST_FILE ? data.slice(0, 150).map(d => d.lvl_name) : [];
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  const removedFromTop = beforeTop.filter(n => !afterTop.includes(n));
  
  let desc = `${item.lvl_name} foi movido na ${listType} List de #${oldDisplayPos} para #${newDisplayPos}`;
  
  const aboveLevel = toIdx > 0 ? data[toIdx - 1].lvl_name : null;
  const belowLevel = toIdx + 1 < data.length ? data[toIdx + 1].lvl_name : null;
  if (aboveLevel || belowLevel) {
    const parts = [];
    if (aboveLevel) parts.push(`abaixo de ${aboveLevel}`);
    if (belowLevel) parts.push(`acima de ${belowLevel}`);
    desc += ', ' + parts.join(' e ');
  }
  
  if (movedToLegacy.length) {
    desc += `, fazendo com que ${movedToLegacy.join(', ')} caia(m) para a Legacy List`;
  }
  if (removedFromTop.length && !movedToLegacy.includes(removedFromTop[0])) {
    desc += `, fazendo com que ${removedFromTop.join(', ')} caia(m) para a Legacy List`;
  }
  if (addedToTop.length) {
    desc += `, fazendo com que ${addedToTop.join(', ')} entre(m) para o Top 150`;
  }
  
  appendChangelog(desc);
  const filesToCommit = file === MAIN_LIST_FILE ? 
    [file, LEGACY_LIST_FILE, 'CHANGELOGS.md', 'README.md'] : 
    [file, 'CHANGELOGS.md', 'README.md'];
  const ok = gitCommitAndPush(filesToCommit, `Movido: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== DELETAR =====
async function deleteLevel(file) {
  const data = load(file);
  const listType = file === MAIN_LIST_FILE ? 'MAIN' : 
                   file === EXTENDED_LIST_FILE ? 'EXTENDED' : 'LEGACY';
  
  console.log(`\n🗑️  DELETAR DA ${listType} LIST:`);
  data.slice(0, 10).forEach((l, i) => {
    const displayPos = file === LEGACY_LIST_FILE ? i + 151 : 
                       file === EXTENDED_LIST_FILE ? i + 76 : i + 1;
    console.log(`  ${displayPos}. ${l.lvl_name}`);
  });
  if (data.length > 10) console.log(`  ... (total: ${data.length})`);
  
  const pos = await ask('\nPosição (ou nome): ');
  if (!pos) { console.log('❌ Cancelado.\n'); return; }
  
  let idx;
  if (isNaN(pos)) {
    idx = data.findIndex(l => l.lvl_name.toLowerCase() === pos.toLowerCase());
    if (idx === -1) {
      console.log('❌ Nível não encontrado.\n');
      return;
    }
  } else {
    const adjustedPos = file === LEGACY_LIST_FILE ? parseInt(pos) - 151 : 
                        file === EXTENDED_LIST_FILE ? parseInt(pos) - 76 : parseInt(pos) - 1;
    idx = adjustedPos;
  }
  
  if (idx < 0 || idx >= data.length) { console.log('❌ Posição inválida.\n'); return; }
  
  const beforeTop = file === MAIN_LIST_FILE ? data.slice(0, 150).map(d => d.lvl_name) : [];
  const name = data[idx].lvl_name;
  const displayPos = file === LEGACY_LIST_FILE ? idx + 151 : 
                     file === EXTENDED_LIST_FILE ? idx + 76 : idx + 1;
  
  data.splice(idx, 1);
  
  save(file, data);
  const afterTop = file === MAIN_LIST_FILE ? data.slice(0, 150).map(d => d.lvl_name) : [];
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  
  console.log(`✅ "${name}" deletado da ${listType} List (posição #${displayPos})!\n`);
  
  let desc = `${name} foi removido da ${listType} List (posição #${displayPos})`;
  if (addedToTop.length) desc += `, fazendo com que ${addedToTop.join(', ')} suba(m) para o Top 150`;
  
  appendChangelog(desc);
  const filesToCommit = file === MAIN_LIST_FILE ? 
    [file, LEGACY_LIST_FILE, 'CHANGELOGS.md', 'README.md'] : 
    [file, 'CHANGELOGS.md', 'README.md'];
  const ok = gitCommitAndPush(filesToCommit, `Removido: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== EDITAR =====
async function update(file) {
  const data = load(file);
  const listType = file === MAIN_LIST_FILE ? 'MAIN' : 
                   file === EXTENDED_LIST_FILE ? 'EXTENDED' : 'LEGACY';
  
  console.log(`\n✏️  EDITAR NA ${listType} LIST:`);
  data.slice(0, 10).forEach((l, i) => {
    const displayPos = file === LEGACY_LIST_FILE ? i + 151 : 
                       file === EXTENDED_LIST_FILE ? i + 76 : i + 1;
    console.log(`  ${displayPos}. ${l.lvl_name}`);
  });
  if (data.length > 10) console.log(`  ... (total: ${data.length})`);
  
  const pos = await ask('\nPosição (ou nome): ');
  if (!pos) { console.log('❌ Cancelado.\n'); return; }
  
  let idx;
  if (isNaN(pos)) {
    idx = data.findIndex(l => l.lvl_name.toLowerCase() === pos.toLowerCase());
    if (idx === -1) {
      console.log('❌ Nível não encontrado.\n');
      return;
    }
  } else {
    const adjustedPos = file === LEGACY_LIST_FILE ? parseInt(pos) - 151 : 
                        file === EXTENDED_LIST_FILE ? parseInt(pos) - 76 : parseInt(pos) - 1;
    idx = adjustedPos;
  }
  
  if (idx < 0 || idx >= data.length) { console.log('❌ Posição inválida.\n'); return; }
  
  const item = data[idx];
  console.log(`\nEditando: ${item.lvl_name}`);
  
  const old = {
    lvl_creator: item.lvl_creator,
    video_url: item.video_url,
    diff_rank: item.diff_rank,
    diff_scale: item.diff_scale,
    pos_aredl: item.pos_aredl
  };

  const creator = await ask(`Criador [${item.lvl_creator}]: `) || item.lvl_creator;
  const url = await ask(`URL [${item.video_url}]: `) || item.video_url;
  const rank = await ask(`Rank [${item.diff_rank}]: `) || item.diff_rank;
  const scale = await ask(`Scale [${item.diff_scale}]: `) || item.diff_scale;
  const aredl = await ask(`AREDL [${item.pos_aredl || '-'}]: `);

  item.lvl_creator = creator;
  item.video_url = url;
  item.diff_rank = rank;
  item.diff_scale = scale;
  if (aredl) item.pos_aredl = parseInt(aredl, 10);
  
  save(file, data);
  console.log(`✅ Atualizado!\n`);
  
  const changes = [];
  if (old.lvl_creator !== item.lvl_creator) changes.push(`criador: ${old.lvl_creator} → ${item.lvl_creator}`);
  if (old.video_url !== item.video_url) changes.push(`URL`);
  if (old.diff_rank !== item.diff_rank) changes.push(`rank: ${old.diff_rank} → ${item.diff_rank}`);
  if (old.diff_scale !== item.diff_scale) changes.push(`scale: ${old.diff_scale} → ${item.diff_scale}`);
  if (old.pos_aredl !== item.pos_aredl) changes.push(`AREDL: ${old.pos_aredl} → ${item.pos_aredl}`);
  const desc = changes.length ? `${item.lvl_name} (${listType} List) atualizado: ${changes.join(', ')}` : `${item.lvl_name} (${listType} List) editado (sem mudanças detectadas)`;
  appendChangelog(desc);
  const ok2 = gitCommitAndPush([file, 'CHANGELOGS.md', 'README.md'], `Atualizado: ${desc}`);
  console.log(ok2 ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== PROMOVER DA LEGACY =====
async function promoteFromLegacy() {
  console.log('\n⬆️  PROMOVER DA LEGACY LIST:');
  const legacyData = load(LEGACY_LIST_FILE);
  
  if (legacyData.length === 0) {
    console.log('❌ Legacy List está vazia.\n');
    return;
  }
  
  legacyData.slice(0, 10).forEach((l, i) => console.log(`  ${i + 151}. ${l.lvl_name}`));
  if (legacyData.length > 10) console.log(`  ... (total: ${legacyData.length})`);
  
  const name = await ask('\nNome do nível: ');
  if (!name) { console.log('❌ Cancelado.\n'); return; }
  
  const level = moveFromLegacy(name);
  if (!level) return;
  
  const pos = await ask('Posição na Main List: ');
  const mainData = load(MAIN_LIST_FILE);
  const idx = pos ? Math.max(0, Math.min(parseInt(pos) - 1, mainData.length)) : mainData.length;
  
  const date = nowDate();
  const above = idx > 0 ? mainData[idx - 1].lvl_name : null;
  const below = idx < mainData.length ? mainData[idx].lvl_name : null;
  
  // Inserir na Main List
  mainData.splice(idx, 0, level);
  
  // Atualizar histórico do nível promovido
  ensurePosHistory(level);
  let promoteDesc = `Promoted to Main List at position ${idx + 1}`;
  if (above || below) {
    const parts = [];
    if (above) parts.push(`below ${above}`);
    if (below) parts.push(`above ${below}`);
    promoteDesc += `, ${parts.join(' and ')}`;
  }
  level.pos_history.push({ log1: `${date} - ${promoteDesc}` });
  
  // Atualizar histórico dos níveis da Main que foram empurrados para baixo
  for (let i = idx + 1; i < mainData.length; i++) {
    ensurePosHistory(mainData[i]);
    mainData[i].pos_history.push({ log1: `${date} - ${name} was promoted from Legacy above (-1)` });
  }
  
  save(MAIN_LIST_FILE, mainData);
  
  // Verificar se algum nível cai para Legacy
  const movedToLegacy = checkAndMoveToLegacy();
  
  console.log(`\n✅ "${name}" promovido da Legacy para posição #${idx + 1}!`);
  console.log(`📝 Histórico atualizado.\n`);
  
  let desc = `${name} foi promovido da Legacy List para Main List posição #${idx + 1}`;
  if (above || below) {
    const parts = [];
    if (above) parts.push(`abaixo de ${above}`);
    if (below) parts.push(`acima de ${below}`);
    desc += ', ' + parts.join(' e ');
  }
  if (movedToLegacy.length) {
    desc += `, fazendo com que ${movedToLegacy.join(', ')} caia(m) para a Legacy List`;
  }
  
  appendChangelog(desc);
  const ok = gitCommitAndPush([MAIN_LIST_FILE, LEGACY_LIST_FILE, 'CHANGELOGS.md', 'README.md'], `Promovido: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== MENU PRINCIPAL =====
async function menu() {
  console.clear();
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  GERENCIADOR DE NÍVEIS - ELFETOR v3.0    ║');
  console.log('║  Com Suporte à Legacy List                ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  let file = '';
  while (!file) {
    const choice = await ask('Escolha lista:\n1. MAIN\n2. EXTENDED\n3. LEGACY\n> ');
    file = choice === '1' ? MAIN_LIST_FILE : 
           choice === '2' ? EXTENDED_LIST_FILE : 
           choice === '3' ? LEGACY_LIST_FILE : '';
    if (!file) console.log('❌ Inválido.\n');
    else console.clear();
  }
  
  let running = true;
  while (running) {
    const listType = file === MAIN_LIST_FILE ? 'MAIN' : 
                     file === EXTENDED_LIST_FILE ? 'EXTENDED' : 'LEGACY';
    
    console.log('╔═══════════════════════════════════╗');
    console.log(`║    ${listType} LIST - O QUE FAZER?    `.padEnd(36) + '║');
    console.log('╚═══════════════════════════════════╝\n');
    console.log('1. 📋 Listar');
    console.log('2. 🔍 Buscar');
    console.log('3. ➕ Adicionar');
    console.log('4. ✏️  Editar');
    console.log('5. 🗑️  Deletar');
    console.log('6. ➡️  Mover');
    
    if (file === MAIN_LIST_FILE) {
      console.log('\n📦 Comandos Legacy:');
      console.log('7. Ver Legacy List');
      console.log('8. ⬆️  Promover da Legacy');
    }
    
    console.log('\n9. 🔄 Trocar lista');
    console.log('0. ❌ Sair\n');
    
    const choice = await ask('> ');
    
    switch (choice) {
      case '1': await list(file); break;
      case '2': await search(file); break;
      case '3': await addWithHistory(file); break;
      case '4': await update(file); break;
      case '5': await deleteLevel(file); break;
      case '6': await moveWithHistory(file); break;
      case '7':
        if (file === MAIN_LIST_FILE) {
          await list(LEGACY_LIST_FILE);
        } else {
          console.log('❌ Opção inválida.\n');
        }
        break;
      case '8':
        if (file === MAIN_LIST_FILE) {
          await promoteFromLegacy();
        } else {
          console.log('❌ Opção inválida.\n');
        }
        break;
      case '9':
        file = '';
        while (!file) {
          const c = await ask('1. MAIN\n2. EXTENDED\n3. LEGACY\n> ');
          file = c === '1' ? MAIN_LIST_FILE : 
                 c === '2' ? EXTENDED_LIST_FILE : 
                 c === '3' ? LEGACY_LIST_FILE : '';
        }
        console.clear();
        break;
      case '0':
        running = false;
        console.log('\n👋 Tchau!\n');
        break;
      default:
        console.log('❌ Inválido.\n');
    }
  }
  
  rl.close();
}

if (require.main === module) menu().catch(e => {
  console.error('Erro:', e.message);
  rl.close();
  process.exit(1);
});

module.exports = { menu };