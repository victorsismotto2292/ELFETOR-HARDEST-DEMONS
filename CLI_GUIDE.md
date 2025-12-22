## 🎮 LEVELS MANAGER CLI - Guia Rápido

Um CLI prático para gerenciar níveis de Geometry Dash com busca JSON, atalhos e modo interativo.

### 📋 Comandos Básicos

#### Listar níveis
```bash
node scripts/cli.cjs ls
node scripts/cli.cjs ls levels_main.json
```

#### 🔍 **Pesquisar no JSON** (novo!)
```bash
node scripts/cli.cjs search mastermind
node scripts/cli.cjs search "9.5"
node scripts/cli.cjs search "hinds" levels_main.json
```
Busca em **todos os campos** (nome, criador, scale, rank, URL, etc)

#### Adicionar nível
```bash
# Modo interativo (pergunta cada campo)
node scripts/cli.cjs add

# Atalho rápido (nome + criador)
node scripts/cli.cjs add "DeCodeX" "Rek3dge" --pos 13

# Sem posição (vai pro final)
node scripts/cli.cjs add "My Level" "My Creator"
```

#### Deletar nível
```bash
# Por nome
node scripts/cli.cjs del "DeCodeX"

# Por posição (1-based)
node scripts/cli.cjs del 13
```

#### ✏️ Editar nível
```bash
# Modo interativo (mostra valores atuais)
node scripts/cli.cjs edit "DeCodeX"
```

#### Mover nível
```bash
node scripts/cli.cjs move "DeCodeX" 5
```

#### Formatar/Normalizar
```bash
node scripts/cli.cjs format
```

---

### 🎯 Exemplos Práticos

**1. Encontrar todos os níveis de um criador:**
```bash
node scripts/cli.cjs search hinds
```

**2. Encontrar níveis com escala específica:**
```bash
node scripts/cli.cjs search "9.6"
```

**3. Adicionar rápido:**
```bash
node scripts/cli.cjs add "Meu Nível" "Meu Nome"
```

**4. Deletar e mover:**
```bash
node scripts/cli.cjs del 5       # Delete posição 5
node scripts/cli.cjs move "My Level" 3  # Move para posição 3
```

**5. Pesquisar na lista MAIN:**
```bash
node scripts/cli.cjs search mastermind levels_main.json
```

---

### 📁 Arquivo Padrão

Se não especificar arquivo, usa `levels_extended.json`  
Para a lista principal, use `levels_main.json`

```bash
node scripts/cli.cjs ls levels_main.json
```

---

### 💡 Dicas

- Use `--pos N` para especificar posição (1-based)
- Deixe nomes com espaço entre aspas: `"My Level"`
- Modo interativo pede: nome, criador, URL, rank, scale, AREDL
- A busca é **case-insensitive** e procura em todo JSON
- Backups automáticos são criados antes de cada mudança

---

### 🔗 Atalhos de Comando

| Atalho | Comando |
|--------|---------|
| `ls` | `list` |
| `s` | `search` |
| `a` | `add` |
| `d` | `del` / `delete` |
| `e` | `edit` |
| `m` | `move` |
