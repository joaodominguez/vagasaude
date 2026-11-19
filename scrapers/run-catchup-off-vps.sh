#!/usr/bin/env bash
# Recupera as corridas off-VPS do VagaSaúde perdidas com o Mac desligado (o launchd só recupera as
# perdidas durante o sono, não com o Mac desligado). Corre no início de sessão (launchd
# pt.vagasaude.catchup, RunAtLoad): lê nos logs a hora da última corrida de cada tarefa e relança
# as que estão atrasadas. Uma tarefa que nunca correu (sem log) não é lançada: é instalação nova e
# entra no ciclo à hora marcada.
#
# Instalação (feita a 19-11-2026): ~/Library/LaunchAgents/pt.vagasaude.catchup.plist com
# Label pt.vagasaude.catchup, ProgramArguments [/bin/bash, <este ficheiro>], RunAtLoad true e
# log em ~/Library/Logs/vagasaude-catchup.log; carregar com
# `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/pt.vagasaude.catchup.plist`.
set -uo pipefail

LOGS="$HOME/Library/Logs"
UID_N=$(id -u)
MAX_AGE=$(( 6 * 3600 + 10 * 60 ))   # as 3 tarefas correm de 6 em 6 h; + 10 min de folga
WAIT="${CATCHUP_WAIT:-120}"          # dar tempo à rede depois de ligar

log() { echo "[$(date '+%F %T')] catchup: $*"; }

# Epoch da última linha "[AAAA-MM-DD HH:MM:SS] <padrão>" no log (vazio se não houver).
last_run() {
  local file=$1 pattern=$2 ts
  ts=$(grep -E "^\[[0-9-]{10} [0-9:]{8}\] ${pattern}" "$file" 2>/dev/null | tail -1 | cut -c2-20)
  [[ -n "$ts" ]] && date -j -f "%Y-%m-%d %H:%M:%S" "$ts" +%s 2>/dev/null
}

running() { launchctl list | awk -v l="$1" '$3 == l && $1 != "-" {f=1} END {exit !f}'; }

kick() {
  local label=$1 file=$2 pattern=$3 last age
  last=$(last_run "$file" "$pattern")
  if running "$label"; then
    log "$label já está a correr"
  elif [[ -z "$last" ]]; then
    log "$label ainda nunca correu — fica para a hora marcada"
  else
    age=$(( $(date +%s) - last ))
    if (( age > MAX_AGE )); then
      log "$label atrasada ($(( age / 3600 )) h desde a última corrida) — a relançar"
      launchctl kickstart "gui/$UID_N/$label"
    else
      log "$label em dia ($(( age / 60 )) min)"
    fi
  fi
}

log "início (espera ${WAIT}s pela rede)"
sleep "$WAIT"

kick pt.vagasaude.net-empregos "$LOGS/vagasaude-net-empregos.log" "net_empregos off-VPS"
kick pt.vagasaude.br-vagas-com "$LOGS/vagasaude-br-vagas-com.log" "vagas\.com\.br off-VPS"
kick pt.vagasaude.pt-bloqueadas "$LOGS/vagasaude-pt-bloqueadas.log" "PT off-VPS"

log "fim"
