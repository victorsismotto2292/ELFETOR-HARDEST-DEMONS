# 🎮 GERENCIADOR DE NÍVEIS - Modo Super Simples

## ⚡ Usar (3 formas)

### **Forma 1: npm (RECOMENDADO)**
```bash
npm run levels
```

### **Forma 2: Script shell**
```bash
bash levels.sh
```
ou se der permissão:
```bash
chmod +x levels.sh
./levels.sh
```

### **Forma 3: Node direto**
```bash
node scripts/cli.cjs
```

---

## 🎯 O que você faz dentro do menu

1. **Escolhe a lista** (MAIN ou EXTENDED)
2. **Escolhe a operação** (Listar, Buscar, Adicionar, Editar, Deletar, Mover)
3. **Preenche os dados** (nível vai perguntando tudo)
4. **Volta pro menu** automaticamente
5. **Repete** quantas vezes quiser
6. **Sai** quando terminar

---

## 📋 Operações Disponíveis

- **Listar** - Ver todos os níveis
- **Buscar** - Procurar por nome ou criador
- **Adicionar** - Criar novo nível
- **Editar** - Mudar dados de um nível
- **Deletar** - Remover nível
- **Mover** - Mudar posição na lista
- **Trocar lista** - Ir de MAIN para EXTENDED (sem sair)

---

## 💡 Exemplo de Uso

```
1. npm run levels            ← Abre o menu
2. Escolhe "2" (EXTENDED)    ← Seleciona a lista
3. Escolhe "3" (Adicionar)   ← Adiciona nível
4. Nome: "Meu Nível"         ← Preenche
5. Criador: "Meu Nome"       ← Preenche
6. URL: (Enter para pular)   ← Pula
7. Posição: 1                ← Coloca na posição 1
8. ✅ Adicionado!            ← Pronto!
9. Volta pro menu            ← Pode fazer outra operação
```

---

## 🎨 Comandos Alternativos (sem o menu)

Se preferir linha de comando:

```bash
# Listar
node scripts/manage_levels.cjs --file levels_extended.json list

# Buscar
node scripts/manage_levels.cjs --file levels_extended.json search "mastermind"

# Mas menu é bem mais fácil! 😄
```

---

## ✅ Resumo

- **Uma linha para abrir:** `npm run levels`
- **Menu intuitivo** com todas as opções
- **Fica aberto** enquanto você trabalha
- **Sem sair e voltar** a digitar comandos
- **Super prático!** ⚡
