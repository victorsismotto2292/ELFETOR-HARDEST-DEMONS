#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ==========================
// CONFIGURAÇÃO
// ==========================
const FILES = {
  MAIN: 'levels_main.json',
  EXTENDED: 'levels_extended.json',
  LEGACY: 'levels_legacy.json'
};

const LIMITS = {
  MAIN_MAX: 75,      // Posições 1-75
  EXTENDED_MAX: 150  // Posições 76-150
};

// Arquivos que serão monitorados no modo Batch
const TRACKED_FILES = [
  FILES.MAIN,
  FILES.EXTENDED,
  FILES.LEGACY,
  'README.md'
];

// ==========================
// UTILITÁRIOS
// ==========================
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  // Criar backup simples local (timestamp) apenas se NÃO estiver em modo batch restore
  // (Opcional: você pode manter ou remover essa linha dependendo se quer backups de timestamp)
  // fs.copyFileSync(file, `${file}.bak.${Date.now()}`); 
}

function loadAll() {
  return {
    main: load(FILES.MAIN),
    extended: load(FILES.EXTENDED),
    legacy: load(FILES.LEGACY)
  };
}

function saveAll(lists) {
  save(FILES.MAIN, lists.main);
  save(FILES.EXTENDED, lists.extended);
  save(FILES.LEGACY, lists.legacy);
}

// --- Funções de Backup para o Modo Batch ---
function createBatchBackups() {
  TRACKED_FILES.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, `${file}.batch_temp`);
    }
  });
}

function restoreBatchBackups() {
  TRACKED_FILES.forEach(file => {
    if (fs.existsSync(`${file}.batch_temp`)) {
      fs.copyFileSync(`${file}.batch_temp`, file);
      fs.unlinkSync(`${file}.batch_temp`); // Remove o temp após restaurar
    }
  });
}

function deleteBatchBackups() {
  TRACKED_FILES.forEach(file => {
    if (fs.existsSync(`${file}.batch_temp`)) {
      fs.unlinkSync(`${file}.batch_temp`);
    }
  });
}
// -------------------------------------------

function ensurePosHistory(obj) {
  if (!Array.isArray(obj.pos_history)) obj.pos_history = [];
  obj.pos_history = obj.pos_history.map(e => 
    typeof e === 'string' ? {log1: e} : (e && typeof e === 'object' ? e : {log1: String(e)})
  );
}

function removePosHistory(obj) {
  delete obj.pos_history;
}

function nowDate() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function updateReadmeSummary(date, entry) {
  const file = 'README.md';
  const startMarker = '';
  const endMarker = '';
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

// ==========================
// SISTEMA DE TRANSIÇÕES
// ==========================
function cascadeTransitions(lists, date) {
  const changes = [];
  
  // 1. Main overflow → Extended
  if (lists.main.length > LIMITS.MAIN_MAX) {
    const overflow = lists.main.splice(LIMITS.MAIN_MAX);
    overflow.forEach(level => {
      removePosHistory(level);
      lists.extended.unshift(level);
      changes.push(`${level.lvl_name} caiu da Main (#${LIMITS.MAIN_MAX + 1}) para Extended (#${LIMITS.MAIN_MAX + 1})`);
    });
  }
  
  // 2. Extended overflow → Legacy
  if (lists.extended.length > (LIMITS.EXTENDED_MAX - LIMITS.MAIN_MAX)) {
    const maxExtended = LIMITS.EXTENDED_MAX - LIMITS.MAIN_MAX;
    const overflow = lists.extended.splice(maxExtended);
    overflow.forEach(level => {
      lists.legacy.unshift(level);
      changes.push(`${level.lvl_name} caiu da Extended (#${LIMITS.EXTENDED_MAX + 1}) para Legacy (#${LIMITS.EXTENDED_MAX + 1})`);
    });
  }
  
  return changes;
}

// ==========================
// FUNÇÕES PRINCIPAIS
// ==========================

// ===== LISTAR =====
async function list() {
  const lists = loadAll();
  
  console.log(`\n MAIN LIST (${lists.main.length}/${LIMITS.MAIN_MAX} níveis, posições 1-${LIMITS.MAIN_MAX}):\n`);
  lists.main.slice(0, 20).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name} - ${l.lvl_creator || 'unknown'}`));
  if (lists.main.length > 20) console.log(`  ... e ${lists.main.length - 20} mais\n`);
  
  console.log(`\n EXTENDED LIST (${lists.extended.length}/${LIMITS.EXTENDED_MAX - LIMITS.MAIN_MAX} níveis, posições ${LIMITS.MAIN_MAX + 1}-${LIMITS.EXTENDED_MAX}):\n`);
  lists.extended.slice(0, 10).forEach((l, i) => console.log(`  ${LIMITS.MAIN_MAX + i+1}. ${l.lvl_name} - ${l.lvl_creator || 'unknown'}`));
  if (lists.extended.length > 10) console.log(`  ... e ${lists.extended.length - 10} mais\n`);
  
  console.log(`\n LEGACY LIST (${lists.legacy.length} níveis, posições ${LIMITS.EXTENDED_MAX + 1}+):\n`);
  lists.legacy.slice(0, 10).forEach((l, i) => console.log(`  ${LIMITS.EXTENDED_MAX + i+1}. ${l.lvl_name} - ${l.lvl_creator || 'unknown'}`));
  if (lists.legacy.length > 10) console.log(`  ... e ${lists.legacy.length - 10} mais\n`);
  
  console.log('');
}

// ===== BUSCAR =====
async function search() {
  const lists = loadAll();
  const query = (await ask('\n Buscar (nome/criador): ')).toLowerCase();
  if (!query) return;
  
  const allLevels = [
    ...lists.main.map((l, i) => ({...l, pos: i + 1, list: 'MAIN'})),
    ...lists.extended.map((l, i) => ({...l, pos: LIMITS.MAIN_MAX + i + 1, list: 'EXTENDED'})),
    ...lists.legacy.map((l, i) => ({...l, pos: LIMITS.EXTENDED_MAX + i + 1, list: 'LEGACY'}))
  ];
  
  const results = allLevels.filter(l => 
    (l.lvl_name || '').toLowerCase().includes(query) ||
    (l.lvl_creator || '').toLowerCase().includes(query)
  );
  
  console.log(`\n ${results.length} resultado(s):\n`);
  results.forEach(l => {
    console.log(`  #${l.pos} (${l.list}): ${l.lvl_name} by ${l.lvl_creator}`);
  });
  console.log('');
}

// ===== ADICIONAR =====
async function addWithHistory(targetFile, skipGit = false) {
  console.log('\n ADICIONAR NÍVEL COM TRANSIÇÕES AUTOMÁTICAS:');
  
  const lists = loadAll();
  const targetList = targetFile === FILES.MAIN ? 'main' : targetFile === FILES.EXTENDED ? 'extended' : 'legacy';
  const beforeTop = lists.main.slice(0, LIMITS.MAIN_MAX).map(d => d.lvl_name);
  
  const name = await ask('Nome do nível: ');
  if (!name) { console.log('Cancelado.\n'); return; }
  
  const creator = await ask('Criador: ') || '';
  const url = await ask('URL vídeo (Enter = pular): ') || '';
  const rank = await ask('Rank (Enter = pular): ') || '';
  const scale = await ask('Scale (Enter = pular): ') || '';
  const aredl = await ask('Posição AREDL (Enter = pular): ') || '0';
  const pos = await ask(`Posição na ${targetList.toUpperCase()} (Enter = final): `);
  
  const obj = { 
    lvl_name: name, 
    lvl_creator: creator, 
    video_url: url, 
    diff_rank: rank, 
    diff_scale: scale, 
    pos_aredl: parseInt(aredl) || 0
  };
  
  const data = lists[targetList];
  const idx = pos ? Math.max(0, Math.min(parseInt(pos) - 1, data.length)) : data.length;
  
  // Calcular posição global
  let globalPos = idx + 1;
  if (targetList === 'extended') globalPos = idx + LIMITS.MAIN_MAX + 1;
  if (targetList === 'legacy') globalPos = idx + LIMITS.EXTENDED_MAX + 1;
  
  // Inserir na lista apropriada
  data.splice(idx, 0, obj);
  
  // Adicionar histórico apenas se for Main
  const date = nowDate();
  if (targetList === 'main') {
    ensurePosHistory(obj);
    const above = idx > 0 ? data[idx - 1].lvl_name : null;
    const below = idx + 1 < data.length ? data[idx + 1].lvl_name : null;
    
    let positionDesc = `Added to the list at position ${globalPos}`;
    if (above || below) {
      const parts = [];
      if (above) parts.push(`below ${above}`);
      if (below) parts.push(`above ${below}`);
      positionDesc += `, ${parts.join(' and ')}`;
    }
    
    obj.pos_history = [{ log1: `${date} - ${positionDesc}` }];
    
    // Atualizar histórico dos níveis abaixo na Main
    for (let i = idx + 1; i < data.length; i++) {
      ensurePosHistory(data[i]);
      data[i].pos_history.push({ log1: `${date} - ${name} was added above (-1)` });
    }
  }
  
  // Fazer transições em cascata
  const cascadeChanges = cascadeTransitions(lists, date);
  
  saveAll(lists);
  
  console.log(`\n Nível "${name}" adicionado na posição ${globalPos} (${targetList.toUpperCase()})!`);
  if (cascadeChanges.length > 0) {
    console.log('\n Transições automáticas:');
    cascadeChanges.forEach(c => console.log(`  • ${c}`));
  }
  console.log('');
  
  // Changelog
  const afterTop = lists.main.slice(0, LIMITS.MAIN_MAX).map(d => d.lvl_name);
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  const removedFromTop = beforeTop.filter(n => !afterTop.includes(n));
  
  let desc = `${name} foi adicionado na posição ${globalPos} (${targetList.toUpperCase()})`;
  if (removedFromTop.length) desc += `, fazendo com que ${removedFromTop.join(', ')} caia(m) para a Extended List`;
  if (addedToTop.length && !addedToTop.includes(name)) desc += `, fazendo com que ${addedToTop.join(', ')} entre(m) para o Top ${LIMITS.MAIN_MAX}`;
  if (cascadeChanges.length > 0) desc += `. ${cascadeChanges.join('; ')}`;

  if (!skipGit) {
    const ok = gitCommitAndPush(TRACKED_FILES, `Adicionado: ${desc}`);
    console.log(ok ? 'Commit e push realizados.' : 'Commit/push falhou (verifique credenciais).');
  } else {
    console.log('Alteração salva localmente (pendente no modo Batch).');
  }
}

// ===== MOVER =====
async function moveWithHistory(skipGit = false) {
  console.log('\n MOVER NÍVEL COM TRANSIÇÕES AUTOMÁTICAS:');
  
  const lists = loadAll();
  
  // Mostrar alguns níveis de referência
  console.log('\nPrimeiros 10 da Main:');
  lists.main.slice(0, 10).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name}`));
  console.log('\nPrimeiros 5 da Extended:');
  lists.extended.slice(0, 5).forEach((l, i) => console.log(`  ${LIMITS.MAIN_MAX + i+1}. ${l.lvl_name}`));
  console.log('');
  
  const from = await ask('\nNome do nível ou posição global: ');
  if (!from) { console.log('Cancelado.\n'); return; }
  
  // Buscar nível
  let level, oldGlobalPos, oldList;
  if (isNaN(from)) {
    // Buscar por nome
    let foundIdx = lists.main.findIndex(l => l.lvl_name.toLowerCase() === from.toLowerCase());
    if (foundIdx !== -1) {
      level = lists.main[foundIdx];
      oldGlobalPos = foundIdx + 1;
      oldList = 'main';
    } else {
      foundIdx = lists.extended.findIndex(l => l.lvl_name.toLowerCase() === from.toLowerCase());
      if (foundIdx !== -1) {
        level = lists.extended[foundIdx];
        oldGlobalPos = LIMITS.MAIN_MAX + foundIdx + 1;
        oldList = 'extended';
      } else {
        foundIdx = lists.legacy.findIndex(l => l.lvl_name.toLowerCase() === from.toLowerCase());
        if (foundIdx !== -1) {
          level = lists.legacy[foundIdx];
          oldGlobalPos = LIMITS.EXTENDED_MAX + foundIdx + 1;
          oldList = 'legacy';
        }
      }
    }
  } else {
    // Buscar por posição global
    const globalPos = parseInt(from);
    if (globalPos <= LIMITS.MAIN_MAX) {
      level = lists.main[globalPos - 1];
      oldGlobalPos = globalPos;
      oldList = 'main';
    } else if (globalPos <= LIMITS.EXTENDED_MAX) {
      level = lists.extended[globalPos - LIMITS.MAIN_MAX - 1];
      oldGlobalPos = globalPos;
      oldList = 'extended';
    } else {
      level = lists.legacy[globalPos - LIMITS.EXTENDED_MAX - 1];
      oldGlobalPos = globalPos;
      oldList = 'legacy';
    }
  }
  
  if (!level) {
    console.log('Nível não encontrado.\n');
    return;
  }
  
  const to = await ask(`Nova posição global para "${level.lvl_name}" (atual: #${oldGlobalPos}): `);
  const newGlobalPos = parseInt(to);
  
  if (newGlobalPos === oldGlobalPos) {
    console.log('Nível já está nessa posição.\n');
    return;
  }
  
  const beforeTop = lists.main.slice(0, LIMITS.MAIN_MAX).map(d => d.lvl_name);
  const date = nowDate();
  
  // Determinar lista de destino
  let newList, newLocalIdx;
  if (newGlobalPos <= LIMITS.MAIN_MAX) {
    newList = 'main';
    newLocalIdx = Math.max(0, Math.min(newGlobalPos - 1, lists.main.length));
  } else if (newGlobalPos <= LIMITS.EXTENDED_MAX) {
    newList = 'extended';
    newLocalIdx = Math.max(0, Math.min(newGlobalPos - LIMITS.MAIN_MAX - 1, lists.extended.length));
  } else {
    newList = 'legacy';
    newLocalIdx = Math.max(0, Math.min(newGlobalPos - LIMITS.EXTENDED_MAX - 1, lists.legacy.length));
  }
  
  // Remover da lista antiga
  const oldLocalIdx = lists[oldList].indexOf(level);
  lists[oldList].splice(oldLocalIdx, 1);
  
  // Inserir na nova lista
  lists[newList].splice(newLocalIdx, 0, level);
  
  // Gerenciar pos_history
  const wasInMain = oldList === 'main';
  const isInMain = newList === 'main';
  
  if (isInMain) {
    // Promovido/movido para Main - garantir pos_history
    ensurePosHistory(level);
    
    const delta = Math.abs(oldGlobalPos - newGlobalPos);
    const sign = (oldGlobalPos > newGlobalPos) ? `+${delta}` : `-${delta}`;
    
    const above = newLocalIdx > 0 ? lists.main[newLocalIdx - 1].lvl_name : null;
    const below = newLocalIdx + 1 < lists.main.length ? lists.main[newLocalIdx + 1].lvl_name : null;
    
    let moveDesc = `Moved to position ${newGlobalPos} (${sign})`;
    if (above || below) {
      const parts = [];
      if (above) parts.push(`below ${above}`);
      if (below) parts.push(`above ${below}`);
      moveDesc += `, ${parts.join(' and ')}`;
    }
    level.pos_history.push({ log1: `${date} - ${moveDesc}` });
    
    // Atualizar histórico dos afetados na Main
    const name = level.lvl_name;
    if (oldGlobalPos > newGlobalPos) {
      for (let i = newLocalIdx + 1; i < lists.main.length && i <= oldLocalIdx; i++) {
        ensurePosHistory(lists.main[i]);
        lists.main[i].pos_history.push({ log1: `${date} - ${name} was moved above (-1)` });
      }
    } else if (oldGlobalPos < newGlobalPos && wasInMain) {
      for (let i = oldLocalIdx; i < newLocalIdx; i++) {
        ensurePosHistory(lists.main[i]);
        lists.main[i].pos_history.push({ log1: `${date} - ${name} was moved below (+1)` });
      }
    }
  } else if (wasInMain && !isInMain) {
    // Rebaixado da Main - remover pos_history
    removePosHistory(level);
  }
  
  // Fazer transições em cascata
  const cascadeChanges = cascadeTransitions(lists, date);
  
  saveAll(lists);
  
  console.log(`\n"${level.lvl_name}" movido de #${oldGlobalPos} (${oldList.toUpperCase()}) para #${newGlobalPos} (${newList.toUpperCase()})!`);
  if (cascadeChanges.length > 0) {
    console.log('\nTransições automáticas:');
    cascadeChanges.forEach(c => console.log(`  • ${c}`));
  }
  console.log('');
  
  // Changelog
  const afterTop = lists.main.slice(0, LIMITS.MAIN_MAX).map(d => d.lvl_name);
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  const removedFromTop = beforeTop.filter(n => !afterTop.includes(n));
  
  let desc = `${level.lvl_name} foi movido de #${oldGlobalPos} (${oldList.toUpperCase()}) para #${newGlobalPos} (${newList.toUpperCase()})`;
  if (removedFromTop.length) desc += `, fazendo com que ${removedFromTop.join(', ')} caia(m) para Extended`;
  if (addedToTop.length) desc += `, fazendo com que ${addedToTop.join(', ')} suba(m) para Main`;
  if (cascadeChanges.length > 0) desc += `. ${cascadeChanges.join('; ')}`;
  
  if (!skipGit) {
    const ok = gitCommitAndPush(TRACKED_FILES, `Movido: ${desc}`);
    console.log(ok ? 'Commit e push realizados.' : 'Commit/push falhou.');
  } else {
    console.log('Alteração salva localmente (pendente no modo Batch).');
  }
}

// ===== DELETAR =====
async function deleteLevel(skipGit = false) {
  console.log('\nDELETAR COM PROMOÇÕES AUTOMÁTICAS:');
  
  const lists = loadAll();
  
  console.log('\nPrimeiros 10 da Main:');
  lists.main.slice(0, 10).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name}`));
  console.log('');
  
  const input = await ask('\nNome do nível ou posição global: ');
  if (!input) { console.log('Cancelado.\n'); return; }
  
  // Buscar nível
  let level, globalPos, list;
  if (isNaN(input)) {
    let foundIdx = lists.main.findIndex(l => l.lvl_name.toLowerCase() === input.toLowerCase());
    if (foundIdx !== -1) {
      level = lists.main[foundIdx];
      globalPos = foundIdx + 1;
      list = 'main';
    } else {
      foundIdx = lists.extended.findIndex(l => l.lvl_name.toLowerCase() === input.toLowerCase());
      if (foundIdx !== -1) {
        level = lists.extended[foundIdx];
        globalPos = LIMITS.MAIN_MAX + foundIdx + 1;
        list = 'extended';
      } else {
        foundIdx = lists.legacy.findIndex(l => l.lvl_name.toLowerCase() === input.toLowerCase());
        if (foundIdx !== -1) {
          level = lists.legacy[foundIdx];
          globalPos = LIMITS.EXTENDED_MAX + foundIdx + 1;
          list = 'legacy';
        }
      }
    }
  } else {
    const pos = parseInt(input);
    if (pos <= LIMITS.MAIN_MAX) {
      level = lists.main[pos - 1];
      globalPos = pos;
      list = 'main';
    } else if (pos <= LIMITS.EXTENDED_MAX) {
      level = lists.extended[pos - LIMITS.MAIN_MAX - 1];
      globalPos = pos;
      list = 'extended';
    } else {
      level = lists.legacy[pos - LIMITS.EXTENDED_MAX - 1];
      globalPos = pos;
      list = 'legacy';
    }
  }
  
  if (!level) {
    console.log('Nível não encontrado.\n');
    return;
  }
  
  const beforeTop = lists.main.slice(0, LIMITS.MAIN_MAX).map(d => d.lvl_name);
  const name = level.lvl_name;
  
  // Remover da lista
  const idx = lists[list].indexOf(level);
  lists[list].splice(idx, 1);
  
  // Preencher espaços vazios (promoções)
  const date = nowDate();
  const promotions = [];
  
  // Extended → Main
  if (lists.extended.length > 0 && lists.main.length < LIMITS.MAIN_MAX) {
    const promoted = lists.extended.shift();
    lists.main.push(promoted);
    ensurePosHistory(promoted);
    promoted.pos_history.push({ 
      log1: `${date} - Promoted to Main List at position ${lists.main.length} (was Extended #${LIMITS.MAIN_MAX + 1})` 
    });
    promotions.push(`${promoted.lvl_name} promovido de Extended para Main (#${lists.main.length})`);
  }
  
  // Legacy → Extended
  if (lists.legacy.length > 0 && lists.extended.length < (LIMITS.EXTENDED_MAX - LIMITS.MAIN_MAX)) {
    const promoted = lists.legacy.shift();
    lists.extended.push(promoted);
    promotions.push(`${promoted.lvl_name} promovido de Legacy para Extended (#${LIMITS.MAIN_MAX + lists.extended.length})`);
  }
  
  saveAll(lists);
  
  console.log(`"${name}" deletado de #${globalPos} (${list.toUpperCase()})!\n`);
  if (promotions.length > 0) {
    console.log('Promoções automáticas:');
    promotions.forEach(p => console.log(`  • ${p}`));
    console.log('');
  }
  
  // Changelog
  const afterTop = lists.main.slice(0, LIMITS.MAIN_MAX).map(d => d.lvl_name);
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  
  let desc = `${name} removido de #${globalPos} (${list.toUpperCase()})`;
  if (addedToTop.length) desc += `, ${addedToTop.join(', ')} promovido(s) para Main`;
  if (promotions.length > 0) desc += `. ${promotions.join('; ')}`;
  
  if (!skipGit) {
    const ok = gitCommitAndPush(TRACKED_FILES, `Removido: ${desc}`);
    console.log(ok ? 'Commit e push realizados.' : 'Commit/push falhou.');
  } else {
    console.log('Alteração salva localmente (pendente no modo Batch).');
  }
}

// ===== EDITAR =====
async function update(skipGit = false) {
  console.log('\nEDITAR:');
  
  const lists = loadAll();
  
  console.log('\nPrimeiros 10 da Main:');
  lists.main.slice(0, 10).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name}`));
  console.log('');
  
  const input = await ask('\nNome do nível ou posição global: ');
  if (!input) { console.log('Cancelado.\n'); return; }
  
  // Buscar nível
  let level;
  if (isNaN(input)) {
    level = lists.main.find(l => l.lvl_name.toLowerCase() === input.toLowerCase()) ||
            lists.extended.find(l => l.lvl_name.toLowerCase() === input.toLowerCase()) ||
            lists.legacy.find(l => l.lvl_name.toLowerCase() === input.toLowerCase());
  } else {
    const pos = parseInt(input);
    if (pos <= LIMITS.MAIN_MAX) {
      level = lists.main[pos - 1];
    } else if (pos <= LIMITS.EXTENDED_MAX) {
      level = lists.extended[pos - LIMITS.MAIN_MAX - 1];
    } else {
      level = lists.legacy[pos - LIMITS.EXTENDED_MAX - 1];
    }
  }
  
  if (!level) {
    console.log('Nível não encontrado.\n');
    return;
  }
  
  console.log(`\nEditando: ${level.lvl_name}`);
  
  const old = {
    lvl_creator: level.lvl_creator,
    video_url: level.video_url,
    diff_rank: level.diff_rank,
    diff_scale: level.diff_scale,
    pos_aredl: level.pos_aredl
  };

  const creator = await ask(`Criador [${level.lvl_creator}]: `) || level.lvl_creator;
  const url = await ask(`URL [${level.video_url}]: `) || level.video_url;
  const rank = await ask(`Rank [${level.diff_rank}]: `) || level.diff_rank;
  const scale = await ask(`Scale [${level.diff_scale}]: `) || level.diff_scale;
  const aredl = await ask(`AREDL [${level.pos_aredl || '-'}]: `);

  level.lvl_creator = creator;
  level.video_url = url;
  level.diff_rank = rank;
  level.diff_scale = scale;
  if (aredl) level.pos_aredl = parseInt(aredl, 10);
  
  saveAll(lists);
  console.log(`Atualizado!\n`);
  
  const changes = [];
  if (old.lvl_creator !== level.lvl_creator) changes.push(`criador: ${old.lvl_creator} → ${level.lvl_creator}`);
  if (old.video_url !== level.video_url) changes.push(`URL`);
  if (old.diff_rank !== level.diff_rank) changes.push(`rank: ${old.diff_rank} → ${level.diff_rank}`);
  if (old.diff_scale !== level.diff_scale) changes.push(`scale: ${old.diff_scale} → ${level.diff_scale}`);
  if (old.pos_aredl !== level.pos_aredl) changes.push(`AREDL: ${old.pos_aredl} → ${level.pos_aredl}`);
  
  const name = level.lvl_name || '(sem nome)';
  const desc = changes.length ? `${name} atualizado: ${changes.join(', ')}` : `${name} editado (sem mudanças)`;
  
  if (!skipGit) {
    const ok = gitCommitAndPush(TRACKED_FILES, `Atualizado: ${desc}`);
    console.log(ok ? 'Commit e push realizados.' : 'Commit/push falhou.');
  } else {
    console.log('Alteração salva localmente (pendente no modo Batch).');
  }
}

// ==========================
// BATCH COMMIT - COMMITS EM LOTE
// ==========================
async function batchCommit() {
  console.log('\nCOMMIT EM LOTE - Economize deploys!\n');
  console.log('Esta opção cria backups dos arquivos atuais.');
  console.log('Se você cancelar, os arquivos voltarão ao estado original.\n');
  
  // CRIAR BACKUPS
  console.log('Criando ponto de restauração...');
  createBatchBackups();
  console.log('Backups criados. Iniciando sessão de edição.\n');

  let changesMade = false;
  let changeLog = [];
  
  let batchRunning = true;
  while (batchRunning) {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║       MODO BATCH - Menu               ║');
    console.log('╚═══════════════════════════════════════╝\n');
    console.log('1. Adicionar nível');
    console.log('2. Editar nível');
    console.log('3. Deletar nível');
    console.log('4. Mover nível');
    console.log('5. Ver mudanças pendentes');
    console.log('6. SALVAR E COMMITAR TUDO');
    console.log('7. Cancelar (RESTAURAR ARQUIVOS)');
    console.log('0. Voltar ao menu principal (mantendo alterações locais)\n');
    
    if (changesMade) {
      console.log(`Você tem ${changeLog.length} mudança(s) pendente(s)\n`);
    }
    
    const choice = await ask('> ');
    
    switch (choice) {
      case '1':
        console.log('\nOnde adicionar?');
        console.log('1. Main List (1-75)');
        console.log('2. Extended List (76-150)');
        console.log('3. Legacy List (151+)');
        const addChoice = await ask('> ');
        const addFile = addChoice === '1' ? FILES.MAIN : 
                       addChoice === '2' ? FILES.EXTENDED : 
                       addChoice === '3' ? FILES.LEGACY : null;
        if (addFile) {
          await addWithHistory(addFile, true);
          changesMade = true;
          changeLog.push(`Adicionado nível na ${addChoice === '1' ? 'Main' : addChoice === '2' ? 'Extended' : 'Legacy'}`);
        }
        break;
      
      case '2':
        await update(true);
        changesMade = true;
        changeLog.push('Editado nível');
        break;
      
      case '3':
        await deleteLevel(true);
        changesMade = true;
        changeLog.push('Deletado nível');
        break;
      
      case '4':
        await moveWithHistory(true);
        changesMade = true;
        changeLog.push('Movido nível');
        break;
      
      case '5':
        console.log('\nMUDANÇAS PENDENTES:\n');
        if (changeLog.length === 0) {
          console.log('Nenhuma mudança pendente.\n');
        } else {
          changeLog.forEach((change, idx) => {
            console.log(`  ${idx + 1}. ${change}`);
          });
          console.log('');
        }
        break;
      
      case '6':
        if (!changesMade) {
          console.log('\nNenhuma mudança para commitar!\n');
          break;
        }
        
        console.log('\nCOMMITANDO TODAS AS MUDANÇAS...\n');
        console.log('Resumo das mudanças:');
        changeLog.forEach((change, idx) => {
          console.log(`  ${idx + 1}. ${change}`);
        });
        
        const commitMsg = await ask('\nMensagem do commit (Enter = usar padrão): ');
        const finalMsg = commitMsg || `Batch update: ${changeLog.length} mudanças`;
        
        const success = gitCommitAndPush(
          TRACKED_FILES,
          finalMsg
        );
        
        if (success) {
          console.log('\nTodas as mudanças foram commitadas e enviadas!');
          console.log('O Vercel fará apenas 1 deploy para todas as mudanças!\n');
          // Se deu sucesso, não precisamos mais dos backups
          deleteBatchBackups();
          changeLog = [];
          changesMade = false;
        } else {
          console.log('\nFalha no commit. Mudanças salvas localmente.\n');
        }
        break;
      
      case '7':
        if (changesMade) {
          const confirm = await ask('\nTem certeza? Isso irá REVERTER os arquivos para o estado inicial. (s/n): ');
          if (confirm.toLowerCase() === 's') {
            console.log('\nRestaurando arquivos originais...');
            restoreBatchBackups();
            console.log('Todas as alterações foram descartadas.\n');
            changeLog = [];
            changesMade = false;
          }
        } else {
            console.log('Nenhuma mudança para cancelar. Removendo backups temporários.');
            deleteBatchBackups();
        }
        break;
      
      case '0':
        if (changesMade) {
          console.log('\nVocê tem mudanças pendentes salvas localmente!');
          const confirm = await ask('Deseja salvar no Git antes de sair? (s/n): ');
          if (confirm.toLowerCase() === 's') {
            const finalMsg = `Batch update: ${changeLog.length} mudanças`;
            const ok = gitCommitAndPush(
              TRACKED_FILES,
              finalMsg
            );
            if(ok) deleteBatchBackups();
          } else {
             console.log('Saindo sem commitar. As alterações permanecem salvas no disco.');
             // Remove backups pois usuário escolheu sair conscientemente
             deleteBatchBackups();
          }
        } else {
          deleteBatchBackups();
        }
        batchRunning = false;
        break;
      
      default:
        console.log('Opção inválida.\n');
    }
  }
}

// ==========================
// MENU PRINCIPAL
// ==========================
async function menu() {
  console.clear();
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  GERENCIADOR DE NÍVEIS - ELFETOR v3.0    ║');
  console.log('║  Sistema Integrado de 3 Listas           ║');
  console.log('║  Main (1-75) → Extended (76-150)         ║');
  console.log('║  → Legacy (151+)                         ║');
  console.log('╚═══════════════════════════════════════════╝\n');
  
  let running = true;
  while (running) {
    console.log('╔═══════════════════════════════════╗');
    console.log('║        O QUE FAZER?               ║');
    console.log('╚═══════════════════════════════════╝\n');
    console.log('1. Listar todas as listas');
    console.log('2. Buscar em todas as listas');
    console.log('3. Adicionar nível (com transições automáticas)');
    console.log('4. Editar nível');
    console.log('5. Deletar nível (com promoções automáticas)');
    console.log('6. Mover nível (com transições automáticas)');
    console.log('7. MODO BATCH (vários commits de uma vez)');
    console.log('0. Sair\n');
    
    const choice = await ask('> ');
    
    switch (choice) {
      case '1': 
        await list(); 
        break;
      case '2': 
        await search(); 
        break;
      case '3':
        console.log('\nOnde adicionar?');
        console.log('1. Main List (1-75)');
        console.log('2. Extended List (76-150)');
        console.log('3. Legacy List (151+)');
        const addChoice = await ask('> ');
        const addFile = addChoice === '1' ? FILES.MAIN : 
                       addChoice === '2' ? FILES.EXTENDED : 
                       addChoice === '3' ? FILES.LEGACY : null;
        if (addFile) await addWithHistory(addFile);
        else console.log('Escolha inválida.\n');
        break;
      case '4': 
        await update(); 
        break;
      case '5': 
        await deleteLevel(); 
        break;
      case '6': 
        await moveWithHistory(); 
        break;
      case '7':
        await batchCommit();
        break;
      case '0':
        running = false;
        console.log('\nTchau!\n');
        break;
      default:
        console.log('Inválido.\n');
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