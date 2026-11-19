#!/usr/bin/env bash
set -euo pipefail
# Cron costuma ter PATH mínimo — garante Xvfb/Chrome/python.
export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH:-}"
source /var/www/vagasaude/scrapers/.chrome.env 2>/dev/null || true
set -a
source /var/www/vagasaude/.env.production
set +a
export INGEST_BASE_URL=http://127.0.0.1:3010
# Servidor primeiro, Mac como reserva (19-11-2026). Estas fontes davam 403 ao VagaSaudeBot vindo do
# IP do VPS (blacklist de 17/11; com outro user-agent o servidor responde 200, por isso o bloqueio é
# ao robô a partir deste IP). Antes de cada corrida testa-se o host com os MESMOS cabeçalhos do scraper (UA + Accept)
# (12 s): se responder, recolhem-se aqui; se não (000/403/429), saltam-se nesta corrida e o Mac
# recolhe-as (scrapers/run-pt-bloqueadas-mac.sh, que só corre o que o VPS não recolheu nas últimas 2 h).
PROBE_UA="VagaSaudeBot/1.0 (+https://vagasaude.pt/bot)"
PROBE_SOURCES="apdp=https://apdp.pt/apdp/recrutamento/ cruz_vermelha=https://www.cruzvermelha.pt/cruz-vermelha-portuguesa/trabalhar-na-cruz-vermelha-portuguesa/ irmas_hospitaleiras=https://irmashospitaleiras.pt/trabalhe-connosco/ unisana=https://unisanahospitais.pt/recrutamento/"
blocked=""
for pair in $PROBE_SOURCES; do
  src="${pair%%=*}"; url="${pair#*=}"
  code="$(curl -s -o /dev/null -m 12 -A "$PROBE_UA" -H "Accept: application/json, text/html, */*" -w '%{http_code}' "$url" || true)"
  if [[ "$code" == 000 || "$code" == 403 || "$code" == 429 ]]; then
    blocked="$blocked,$src"
    echo "[run-scrapers] $src: o VPS não chega à fonte (HTTP $code) — fica para o Mac"
  fi
done
export SKIP_SOURCES="${SKIP_SOURCES:-${blocked#,}}"
cd /var/www/vagasaude/scrapers

# Chrome headful (IPO Porto / PHARMABSC / Net-Empregos) precisa de X.
# Preferimos xvfb-run se existir; o BrowserSession também arranca Xvfb
# sozinho, mas o wrapper evita falhas quando o cron não tem DISPLAY.
run_py=(python3 run.py --source all)
if command -v xvfb-run >/dev/null 2>&1 && [[ -z "${DISPLAY:-}" ]]; then
  run_py=(xvfb-run -a -s "-screen 0 1366x900x24" "${run_py[@]}")
fi

# Corre os scrapers. Uma falha parcial de fontes faz o run.py sair com rc=1,
# mas as vagas boas já foram ingeridas — por isso NÃO deixamos essa falha
# abortar o envio do digest (senão os alertas por email deixam de sair).
scrape_rc=0
"${run_py[@]}" || scrape_rc=$?
if [[ "$scrape_rc" -ne 0 ]]; then
  echo "[run-scrapers] run.py terminou com rc=$scrape_rc (falha parcial de fontes); a continuar para o digest."
fi

# Fontes avariadas (últimas 4 execuções com 0 vagas ou erro): log + email se ALERTS_TO.
HEALTH_IGNORE="${HEALTH_IGNORE:-$SKIP_SOURCES}" HEALTH_ALLOW_EMPTY="${HEALTH_ALLOW_EMPTY:-uls_sao_joao}" python3 "/var/www/vagasaude/scrapers/tools/scraper_health.py" /var/www/vagasaude/data/scraper-runs.json || true

# Integridade do jobs.json (incidente BR 2026-10-27): slugs desaparecidos, quedas, 404.
python3 "/var/www/vagasaude/scrapers/tools/jobs_integrity.py" /var/www/vagasaude/data http://127.0.0.1:3010 /vagas/ || true

# Google Indexing API: vagas novas/removidas (só se a chave da conta de serviço existir).
INDEXING_KEY="${GOOGLE_INDEXING_KEY:-/home/portal/.config/vagasaude/indexing-key.json}"
if [[ -f "$INDEXING_KEY" && -x /home/portal/.venvs/indexing/bin/python ]]; then
  # Projeto Google Cloud exclusivo do PT (exce-305211): os 200 pedidos/dia são só deste site.
  GOOGLE_INDEXING_KEY="$INDEXING_KEY" INDEXING_DAILY_QUOTA="${INDEXING_DAILY_QUOTA:-200}" /home/portal/.venvs/indexing/bin/python "/var/www/vagasaude/scrapers/tools/indexing_notify.py" \
    --sitemap http://127.0.0.1:3010/sitemap/jobs.xml \
    --state /var/www/vagasaude/data/indexing-state.json || true
fi

# Envia digest de novas vagas aos subscritores (se Resend estiver configurado).
if [[ -n "${RESEND_API_KEY:-}" && -n "${SCRAPER_API_TOKEN:-}" ]]; then
  curl -sS -X POST "http://127.0.0.1:3010/api/alerts/digest" \
    -H "Authorization: Bearer ${SCRAPER_API_TOKEN}" \
    -H "Content-Type: application/json" \
    || true
  echo
fi

# Cache Cloudflare de 6 h (2026-11-16): limpar a cache 11 min depois do fim desta execução, em fundo
# (ver /var/www/vagasaude/cf_purge_later.sh). Sem isto, listagens e vagas ficavam até 6 h desatualizadas.
nohup /var/www/vagasaude/cf_purge_later.sh 767eabea9b74de2fe7073bc0bdd1af83 >> /var/www/vagasaude/logs/cf-purge.log 2>&1 &
