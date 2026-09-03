#!/usr/bin/env python3
"""Rebuild Time Machine JSON data from the text changelogs and Git states."""
import json, re, subprocess
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; HISTORY=ROOT/'demonlist_history'
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def levels_at(sha):
    out=[]
    for f in ('levels_main.json','levels_extended.json','levels_legacy.json'):
        try: out += json.loads(git('show',f'{sha}:{f}'))
        except subprocess.CalledProcessError: return None
    return out[:150]
def levels_from_txt(path):
    out=[]
    for line in path.read_text(encoding='utf-8').splitlines():
        m=re.match(r'^(\d+) - (.+) by (.+)$',line)
        if m: out.append({'lvl_name':m.group(2),'lvl_creator':m.group(3)})
    return out
base=HISTORY/'01.15.2026.00.00 - Demonlist.txt'
items=[{'date':'2026-01-15T00:00:00-03:00','list_data':[{'date':'01/15/2026 00:00','levels':levels_from_txt(base)}]}]
for path in sorted(HISTORY.glob('*.00.00 - Demonlist.txt')):
    for line in path.read_text(encoding='utf-8').splitlines():
        m=re.match(r'- (\d{2}/\d{2}/\d{4} \d{2}:\d{2}) \| ([0-9a-f]{12}) \| ',line)
        if not m: continue
        dt=datetime.strptime(m.group(1),'%m/%d/%Y %H:%M'); levels=levels_at(m.group(2))
        if levels is not None:
            items.append({'date':dt.strftime('%Y-%m-%dT%H:%M:00-03:00'),'list_data':[{'date':dt.strftime('%m/%d/%Y %H:%M'),'levels':levels}]})
items={x['date']:x for x in items}; items=[items[k] for k in sorted(items)]
payload={'snapshots':items,'metadata':{'source':'demonlist_history TXT changelogs','timezone':'America/Sao_Paulo','positions_per_snapshot':150}}
for filename in ('time_machine_data.json','time_machine_snapshots.json','snapshot.json'):
    (ROOT/filename).write_text(json.dumps(payload,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(f'Generated {len(items)} complete Time Machine snapshots.')
