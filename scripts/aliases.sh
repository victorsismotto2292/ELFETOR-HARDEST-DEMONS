#!/bin/bash

# Atalhos para gerenciar níveis
# Use: source scripts/aliases.sh (ou adicione ao seu ~/.bashrc ou ~/.zshrc)

alias levels-main="node scripts/manage_levels.cjs --file levels_main.json"
alias levels-ext="node scripts/manage_levels.cjs --file levels_extended.json"
alias levels-menu="node scripts/manage_levels.cjs --file levels_main.json menu"

# Funções mais simples
levels-search() {
  if [ $# -eq 0 ]; then
    echo "Usage: levels-search <query>"
    return 1
  fi
  node scripts/manage_levels.cjs --file levels_extended.json search "$1"
}

levels-list() {
  echo "📊 MAIN LIST:"
  node scripts/manage_levels.cjs --file levels_main.json list
  echo ""
  echo "📊 EXTENDED LIST:"
  node scripts/manage_levels.cjs --file levels_extended.json list
}

levels-add() {
  if [ $# -lt 2 ]; then
    echo "Usage: levels-add <name> <creator> [video_url] [file]"
    return 1
  fi
  local file=${4:-levels_extended.json}
  node scripts/manage_levels.cjs --file "$file" add --name "$1" --lvl_creator "$2" --video_url "${3:-}"
}

levels-delete() {
  if [ $# -eq 0 ]; then
    echo "Usage: levels-delete <name>"
    return 1
  fi
  node scripts/manage_levels.cjs --file levels_extended.json delete --name "$1"
}

levels-update() {
  if [ $# -lt 2 ]; then
    echo "Usage: levels-update <name> <property:value> [property:value] ..."
    return 1
  fi
  # TODO: Parse multiple property:value pairs
  echo "Use CLI menu or manage_levels.cjs for now"
}

echo "✅ Aliases carregados!"
echo ""
echo "Comandos disponíveis:"
echo "  levels-menu          - Menu interativo completo"
echo "  levels-list          - Listar ambas as listas"
echo "  levels-search <query>    - Buscar em EXTENDED"
echo "  levels-add <name> <creator> [url] - Adicionar nível"
echo "  levels-delete <name> - Deletar nível"
