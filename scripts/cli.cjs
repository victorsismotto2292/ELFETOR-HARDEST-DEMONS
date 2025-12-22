#!/usr/bin/env node
const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
    // insert new block after first top-level title or at start
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

// end helpers

// ===== LISTAR =====
async function list(file) {
  const data = load(file);
  console.log(`\n📊 ${file} (${data.length} níveis):\n`);
  data.slice(0, 20).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name} - ${l.lvl_creator || 'unknown'}`));
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
    console.log(`  ${idx+1}. ${l.lvl_name} by ${l.lvl_creator}`);
  });
  console.log('');
}

// ===== ADICIONAR =====
async function add(file) {
  console.log('\n➕ ADICIONAR NÍVEL:');
  const data = load(file);
  const beforeTop = data.slice(0, 150).map(d => d.lvl_name);
  
  const name = await ask('Nome: ');
  if (!name) { console.log('❌ Cancelado.\n'); return; }
  
  const creator = await ask('Criador: ') || '';
  const url = await ask('URL vídeo (Enter = pular): ') || '';
  const rank = await ask('Rank (Enter = pular): ') || '';
  const scale = await ask('Scale (Enter = pular): ') || '';
  const pos = await ask('Posição (Enter = final): ');
  
  const obj = { lvl_name: name, lvl_creator: creator, video_url: url, diff_rank: rank, diff_scale: scale, pos_aredl: 0, pos_history: [] };
  ensurePosHistory(obj);
  
  const idx = pos ? Math.max(0, Math.min(parseInt(pos) - 1, data.length)) : data.length;
  data.splice(idx, 0, obj);

  save(file, data);
  console.log(`✅ Adicionado na posição ${idx + 1}!\n`);
  // Changelog + commit
  const above = idx > 0 ? data[idx-1].lvl_name : null;
  const below = idx+1 < data.length ? data[idx+1].lvl_name : null;
  const afterTop = data.slice(0, 150).map(d => d.lvl_name);
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  const removedFromTop = beforeTop.filter(n => !afterTop.includes(n));
  let desc = `${name} foi adicionado na posição ${idx+1}`;
  if (above || below) desc += ', ' + (above ? `abaixo de ${above}` : '') + (above && below ? ' e ' : '') + (below ? `acima de ${below}` : '');
  if (removedFromTop.length) desc += `, fazendo com que ${removedFromTop.join(', ')} caia(m) para a Legacy List`;
  if (addedToTop.length && !addedToTop.includes(name)) desc += `, fazendo com que ${addedToTop.join(', ')} entre(m) para o Top 150`;
  appendChangelog(desc);
  const ok = gitCommitAndPush([file, 'CHANGELOGS.md', 'README.md'], `Adicionado: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
  return { name, index: idx };
}

// ===== DELETAR =====
async function deleteLevel(file) {
  const data = load(file);
  console.log('\n🗑️  DELETAR:');
  data.slice(0, 10).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name}`));
  if (data.length > 10) console.log(`  ... (total: ${data.length})`);
  
  const pos = await ask('\nPosição: ');
  const idx = parseInt(pos) - 1;
  
  if (idx < 0 || idx >= data.length) { console.log('❌ Posição inválida.\n'); return; }
  
  const beforeTop = data.slice(0, 150).map(d => d.lvl_name);
  const name = data[idx].lvl_name;
  data.splice(idx, 1);
  
  save(file, data);
  const afterTop = data.slice(0, 150).map(d => d.lvl_name);
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  console.log(`✅ "${name}" deletado!\n`);
  // Changelog + commit
  let desc = `${name} foi removido da posição ${idx+1}`;
  if (addedToTop.length) desc += `, fazendo com que ${addedToTop.join(', ')} suba(m) para o Top 150`;
  appendChangelog(desc);
  const ok = gitCommitAndPush([file, 'CHANGELOGS.md', 'README.md'], `Removido: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== EDITAR =====
async function update(file) {
  const data = load(file);
  console.log('\n✏️  EDITAR:');
  data.slice(0, 10).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name}`));
  if (data.length > 10) console.log(`  ... (total: ${data.length})`);
  
  const pos = await ask('\nPosição: ');
  const idx = parseInt(pos) - 1;
  
  if (idx < 0 || idx >= data.length) { console.log('❌ Posição inválida.\n'); return; }
  
  const item = data[idx];
  console.log(`\nEditando: ${item.lvl_name}`);
  
  // snapshot old values
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
  // Changelog: listar campos alterados (comparar com snapshot)
  const changes = [];
  if (old.lvl_creator !== item.lvl_creator) changes.push(`criador: ${old.lvl_creator} → ${item.lvl_creator}`);
  if (old.video_url !== item.video_url) changes.push(`URL`);
  if (old.diff_rank !== item.diff_rank) changes.push(`rank: ${old.diff_rank} → ${item.diff_rank}`);
  if (old.diff_scale !== item.diff_scale) changes.push(`scale: ${old.diff_scale} → ${item.diff_scale}`);
  if (old.pos_aredl !== item.pos_aredl) changes.push(`AREDL: ${old.pos_aredl} → ${item.pos_aredl}`);
  const name = item.lvl_name || '(sem nome)';
  const desc = changes.length ? `${name} atualizado: ${changes.join(', ')}` : `${name} editado (sem mudanças detectadas)`;
  appendChangelog(desc);
  const ok2 = gitCommitAndPush([file, 'CHANGELOGS.md', 'README.md'], `Atualizado: ${desc}`);
  console.log(ok2 ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== MOVER =====
async function move(file) {
  const data = load(file);
  console.log('\n➡️  MOVER:');
  data.slice(0, 10).forEach((l, i) => console.log(`  ${i+1}. ${l.lvl_name}`));
  if (data.length > 10) console.log(`  ... (total: ${data.length})`);
  
  const from = await ask('\nPosição atual: ');
  const to = await ask('Nova posição: ');
  
  const fromIdx = parseInt(from) - 1;
  const toIdx = Math.max(0, Math.min(parseInt(to) - 1, data.length - 1));
  
  if (fromIdx < 0 || fromIdx >= data.length) { console.log('❌ Posição inválida.\n'); return; }
  
  const beforeTop = data.slice(0, 150).map(d => d.lvl_name);
  const item = data.splice(fromIdx, 1)[0];
  data.splice(toIdx, 0, item);

  save(file, data);
  console.log(`✅ Movido para posição ${toIdx + 1}!\n`);
  // Changelog + commit
  const above = toIdx > 0 ? data[toIdx-1].lvl_name : null;
  const below = toIdx+1 < data.length ? data[toIdx+1].lvl_name : null;
  const name = item.lvl_name || '(sem nome)';
  const afterTop = data.slice(0, 150).map(d => d.lvl_name);
  const addedToTop = afterTop.filter(n => !beforeTop.includes(n));
  const removedFromTop = beforeTop.filter(n => !afterTop.includes(n));
  let desc = `${name} foi movido da posição ${fromIdx+1} para ${toIdx+1}`;
  if (above || below) desc += ', ' + (above ? `abaixo de ${above}` : '') + (above && below ? ' e ' : '') + (below ? `acima de ${below}` : '');
  if (removedFromTop.length) desc += `, fazendo com que ${removedFromTop.join(', ')} caia(m) para a Legacy List`;
  if (addedToTop.length) desc += `, fazendo com que ${addedToTop.join(', ')} entre(m) para o Top 150`;
  appendChangelog(desc);
  const ok = gitCommitAndPush([file, 'CHANGELOGS.md', 'README.md'], `Movido: ${desc}`);
  console.log(ok ? '✅ Commit e push realizados.' : '⚠️ Commit/push falhou (verifique credenciais).');
}

// ===== MENU PRINCIPAL =====
async function menu() {
  console.clear();
  console.log('╔═══════════════════════════════════╗');
  console.log('║  GERENCIADOR DE NÍVEIS - ELFETOR  ║');
  console.log('╚═══════════════════════════════════╝\n');
  
  let file = '';
  while (!file) {
    const choice = await ask('Escolha lista:\n1. MAIN\n2. EXTENDED\n> ');
    file = choice === '1' ? 'levels_main.json' : choice === '2' ? 'levels_extended.json' : '';
    if (!file) console.log('❌ Inválido.\n');
    else console.clear();
  }
  
  let running = true;
  while (running) {
    console.log('╔═══════════════════════╗');
    console.log('║     O QUE FAZER?      ║');
    console.log('╚═══════════════════════╝\n');
    console.log('1. Listar');
    console.log('2. Buscar');
    console.log('3. Adicionar');
    console.log('4. Editar');
    console.log('5. Deletar');
    console.log('6. Mover');
    console.log('7. Trocar lista');
    console.log('0. Sair\n');
    
    const choice = await ask('> ');
    
    switch (choice) {
      case '1': await list(file); break;
      case '2': await search(file); break;
      case '3': await add(file); break;
      case '4': await update(file); break;
      case '5': await deleteLevel(file); break;
      case '6': await move(file); break;
      case '7':
        file = '';
        while (!file) {
          const c = await ask('1. MAIN\n2. EXTENDED\n> ');
          file = c === '1' ? 'levels_main.json' : c === '2' ? 'levels_extended.json' : '';
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
