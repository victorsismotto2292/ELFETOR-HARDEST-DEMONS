#!/bin/bash
# LEVELS MANAGER - Atalho super rápido
# Use: ./levels.sh ou bash levels.sh

cd "$(dirname "$0")" || exit
node scripts/cli.cjs
