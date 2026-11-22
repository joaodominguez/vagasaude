#!/usr/bin/env python3
"""Resumo de domingo: email semanal para quem tem um alerta ativo (VagaSaúde PT/BR, VacantesSalud ES, Offerte Sanità IT).

Conteúdo, por alerta (no idioma do site):
  1. as 5 vagas mais vistas da semana na área do alerta (vagas ABERTAS que correspondem ao alerta, ordenadas pelas
     visualizações dos últimos 7 dias em data/site-stats.json; se houver menos de 5 com visitas, completa com as mais recentes);
  2. "Esta semana entraram X vagas novas de <profissão> em <região>" (createdAt nos últimos 7 dias) com link para a listagem
     que os emails normais usam (alertJobsPath de lib/email.ts: landing de profissão/região quando tem >=3 vagas);
  3. links para "Vagas de hoje" e, se existir, para a página de salários da profissão (confirmado com um pedido ao site);
  4. rodapé igual ao dos emails normais (gerir/anular com o token do alerta, cabeçalhos List-Unsubscribe) + frase do resumo semanal.

"Vagas abertas" e "corresponde ao alerta" repetem a lógica das apps, ficheiro a ficheiro:
  - jobs.json -> cartões: lib/job-store.ts (status published, sem avisos de resultado, isInactiveByDate, republicações fora,
    prazo normalizado no BR e no ES) -> aqui, além disso, sem prazo a acabar em < 24 h;
  - correspondência: lib/alerts.ts alertMatchesJob (distrito, profissão, setor; PT: regra Medicina / Medicina Dentária).

Regras de envio:
  - só alertas status == "active", sem emailIssue, com token;
  - no máximo 1 email por dia por endereço: fica de fora quem já recebeu qualquer email nosso hoje (lista da Resend, conta
    partilhada) ou já recebeu o resumo hoje (estado), e cada endereço só recebe 1 resumo mesmo com alertas em vários sites;
  - sem email vazio: sem vagas abertas relevantes, não envia;
  - recusa um site cujo digest diário ainda vai sair (janela da manhã/fim do dia aberta ou a abrir nas próximas 6 h e ainda
    não corrida hoje), para o mesmo endereço não receber o digest e o resumo no mesmo dia (--ignore-digest-windows ultrapassa).

Estado: data/weekly-digest-state.json ({site: {alertId: {date, sentAt, resendId}}}); NÃO escreve nos alerts.json.
Log: data/weekly-digest.log (com os ids da Resend). Chave Resend: /var/www/vagasaude/.env.production (nunca impressa).

Uso:
  weekly_digest.py --dry-run [--site pt|br|es|it] [--preview-dir DIR]   contagens, emails mascarados e previews HTML
  weekly_digest.py --send [--site pt|br|es|it]                           envia de facto (só ao domingo, hora de Lisboa)

Correr como root (alerts.json do ES é root:www-data 600).
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

CAMPAIGN = "resumo_domingo"
KEY_ENV = "/var/www/vagasaude/.env.production"
STATE_FILE = "/var/www/vagasaude/data/weekly-digest-state.json"
LOG_FILE = "/var/www/vagasaude/data/weekly-digest.log"
LOCK_FILE = "/var/www/vagasaude/data/.weekly-digest.lock"
SEND_INTERVAL = 0.6
TOP_N = 5
DAY_MS = 86_400_000
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
SITE_ORDER = ["pt", "br", "es", "it"]

C = {"page": "#f1f5f9", "card": "#ffffff", "text": "#0f172a", "muted": "#64748b", "subtle": "#94a3b8",
     "border": "#e2e8f0", "primary": "#0f766e", "primarySoft": "#e8f7f5"}
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

# ---------------------------------------------------------------- PT: locativos (porto de lib/pt-locative.ts)
_NO = {"porto", "funchal", "seixal", "barreiro", "montijo", "cartaxo", "entroncamento", "fundao", "bombarral",
       "sabugal", "crato", "marco de canaveses", "peso da regua", "porto santo"}
_NA = {"madeira", "guarda", "maia", "trofa", "amadora", "covilha", "figueira da foz", "povoa de varzim",
       "povoa de lanhoso", "nazare", "lourinha", "golega", "batalha", "ribeira grande", "ribeira brava", "calheta",
       "chamusca", "mealhada", "murtosa", "pampilhosa da serra", "praia da vitoria", "horta", "lagoa", "serta"}
_NOS = {"acores", "arcos de valdevez"}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower().strip()


def loc_pt(place: str) -> str:
    k = strip_accents(place)
    if k in _NO:
        return f"no {place}"
    if k in _NA:
        return f"na {place}"
    if k in _NOS:
        return f"nos {place}"
    return f"em {place}"


def loc_br(place: str) -> str:
    return f"em {place}"


def loc_es(place: str) -> str:
    return f"en {place}"


def loc_it(place: str) -> str:
    if place in ("Lazio", "Molise"):
        return f"nel {place}"
    if place == "Marche":
        return f"nelle {place}"
    return f"in {place}"


def fmt_pt(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def fmt_dot(n: int) -> str:
    return f"{n:,}".replace(",", ".")


# ---------------------------------------------------------------- taxonomias (lib/taxonomies.ts de cada app)
PT_DISTRICTS = ["Viana do Castelo", "Braga", "Vila Real", "Bragança", "Porto", "Aveiro", "Viseu", "Guarda", "Coimbra",
                "Castelo Branco", "Leiria", "Santarém", "Portalegre", "Lisboa", "Setúbal", "Évora", "Beja", "Faro",
                "Açores", "Madeira"]
BR_STATES = ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás",
             "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná",
             "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
             "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"]
ES_REGIONS = ["Galicia", "Asturias", "Cantabria", "País Vasco", "Navarra", "Castilla y León", "La Rioja", "Aragón",
              "Cataluña", "Extremadura", "Madrid", "Castilla-La Mancha", "Comunidad Valenciana", "Islas Baleares",
              "Andalucía", "Murcia", "Canarias", "Ceuta", "Melilla"]
IT_REGIONS = ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio",
              "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana",
              "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto"]

PT_PROFESSIONS = ["Enfermagem", "Medicina", "Medicina Dentária", "Fisioterapia", "Auxiliares", "Técnico de Saúde",
                  "Farmácia", "Psicologia", "Nutrição", "Veterinária", "Assistência Social", "Formação",
                  "Comercial / Farma", "Gestão & suporte", "Administrativo", "Outros"]
BR_PROFESSIONS = ["Enfermagem", "Medicina", "Fisioterapia", "Auxiliares", "Técnico de Saúde", "Farmácia", "Psicologia",
                  "Nutrição", "Assistência Social", "Formação", "Comercial / Farma", "Gestão & suporte",
                  "Administrativo", "Outros"]
ES_PROFESSIONS = ["Enfermería", "Medicina", "TCAE", "Fisioterapia", "Técnico sanitario", "Farmacia",
                  "Técnico de farmacia", "Celador", "Psicología", "Nutrición", "Odontología", "Óptica y audiología",
                  "Veterinaria", "Trabajo social", "Formación", "Comercial / Farma", "Gestión y apoyo",
                  "Administrativo", "Otros"]
IT_PROFESSIONS = ["Infermieristica", "Medicina", "OSS", "Fisioterapia", "Tecnici sanitari", "Ostetricia", "Farmacia",
                  "Psicologia", "Nutrizione e dietistica", "Odontoiatria", "Logopedia e riabilitazione",
                  "Ottica e audiometria", "Veterinaria", "Servizio sociale", "Formazione", "Gestione e supporto",
                  "Amministrativo", "Altro"]

# Páginas de salários por profissão (lib/salary-tables.ts CAREERS; BR: SALARY_ROLES). Só entra o link se o site responder 200.
SALARY_PT = {"Enfermagem": "enfermeiro", "Medicina": "medico",
             "Técnico de Saúde": "tecnico-superior-de-diagnostico-e-terapeutica",
             "Auxiliares": "tecnico-auxiliar-de-saude", "Farmácia": "farmaceutico", "Nutrição": "nutricionista",
             "Psicologia": "psicologo"}
SALARY_BR = {"Enfermagem": "enfermeiro", "Farmácia": "farmaceutico", "Fisioterapia": "fisioterapeuta",
             "Nutrição": "nutricionista", "Psicologia": "psicologo", "Assistência Social": "assistente-social"}
SALARY_ES = {"Enfermería": "enfermero", "Medicina": "medico", "TCAE": "tcae",
             "Técnico sanitario": "tecnico-superior-sanitario", "Fisioterapia": "fisioterapeuta",
             "Celador": "celador", "Farmacia": "farmaceutico"}
SALARY_IT = {"Infermieristica": "infermiere", "Ostetricia": "ostetrica", "Tecnici sanitari": "tecnico-sanitario",
             "Fisioterapia": "fisioterapista", "Logopedia e riabilitazione": "logopedista",
             "Nutrizione e dietistica": "dietista", "Servizio sociale": "assistente-sociale", "OSS": "oss",
             "Medicina": "medico", "Veterinaria": "veterinario", "Farmacia": "farmacista", "Psicologia": "psicologo"}


SITES: dict[str, dict] = {
    "pt": {
        "dir": "vagasaude", "lang": "pt", "tz": "Europe/Lisbon", "site_url": "https://vagasaude.pt",
        "from": "VagaSaúde <alertas@vagasaude.pt>", "host": "vagasaude.pt", "utm_source": "vagasaude",
        "brand": 'Vaga<span style="color:{primary};">Saúde</span>', "brand_text": "VagaSaúde",
        "social_label": "Siga o VagaSaúde e receba vagas todos os dias",
        "social": [("Telegram", "telegram", "https://t.me/vagasaudept"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029VbDxb8A5PO0v9AeTbE32"),
                   ("Instagram", "instagram", "https://www.instagram.com/vagasaudept"),
                   ("Facebook", "facebook", "https://www.facebook.com/vagasaudept")],
        "prefix": "/vagas", "today": "/vagas/hoje", "manage": "/alertas/gerir", "salary_prefix": "/salarios",
        "salary_map": SALARY_PT, "professions": PT_PROFESSIONS, "districts": PT_DISTRICTS, "other": "Outros",
        "sectors": {"publico": "Público", "privado": "Privado", "ipss": "IPSS"},
        "sector_chip": {"Público": "Público", "IPSS": "Social (IPSS)", "Privado": "Privado"},
        "vet": "Veterinária", "expires": "raw", "param": ("distrito", "profissao", "setor"),
        "loc": loc_pt, "where_none": "em Portugal", "fmt": fmt_pt, "what_prof": "vagas de", "what_none": "vagas de saúde",
        "sector_word": "setor", "pt_dentist_rule": True, "morning": (6, 14), "evening": (17, 23),
        "t": {
            "subject": "As vagas mais vistas desta semana em {prof}", "subject_none": "As vagas mais vistas desta semana em saúde",
            "title": "O teu resumo de domingo", "preheader": "As vagas mais vistas da semana na tua área, num só email.",
            "intro": "O que mais se viu esta semana no VagaSaúde, para o teu alerta de {summary}.",
            "h_top5": "As 5 vagas mais vistas da semana na tua área", "h_top": "As vagas mais vistas da semana na tua área",
            "new_one": "Esta semana entrou 1 vaga nova {what} {where}{which}",
            "new_many": "Esta semana entraram {n} vagas novas {what} {where}{which}",
            "of_prof": "de {prof}", "of_none": "de saúde",
            "btn_job": "Ver vaga", "btn_list": "Ver as vagas {where_label}", "btn_list_generic": "Ver todas as vagas deste alerta",
            "today": "Vagas de hoje", "salary": "Salários: {prof}", "more": "Mais",
            "views_one": "1 visita esta semana", "views_many": "{n} visitas esta semana",
            "published": {"today": "hoje", "yesterday": "ontem", "days": "há {n} dias", "month": "há 1 mês",
                          "months": "há {n} meses", "date": "a {d}"},
            "weekly": 'Recebes este resumo uma vez por semana. Para deixares de o receber, anula ou altera o teu alerta <a href="{manage}" style="color:{muted};text-decoration:underline;">aqui</a>.',
            "weekly_text": "Recebes este resumo uma vez por semana. Para deixares de o receber, anula ou altera o teu alerta aqui: {manage}",
            "footer": "Recebes este email porque criaste um alerta de {summary} no VagaSaúde.",
            "manage_label": "Gerir ou cancelar alerta", "manage_text": "Gerir ou cancelar",
            "all_health": "saúde",
        },
    },
    "br": {
        "dir": "vagasaudebr", "lang": "pt-BR", "tz": "America/Sao_Paulo", "site_url": "https://vagasaude.com.br",
        "from": "VagaSaúde Brasil <alertas@vagasaude.com.br>", "host": "vagasaude.com.br", "utm_source": "vagasaude",
        "brand": 'Vaga<span style="color:{primary};">Saúde</span> <span style="font-weight:600;color:{muted};">Brasil</span>',
        "brand_text": "VagaSaúde Brasil",
        "social_label": "Siga o VagaSaúde e receba vagas todos os dias",
        "social": [("Telegram", "telegram", "https://t.me/vagasaudebr"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029Vb9QPDsLY6dDeq2VVQ2i"),
                   ("Instagram", "instagram", "https://www.instagram.com/vagasaudebr"),
                   ("Facebook", "facebook", "https://www.facebook.com/vagasaudebr")],
        "prefix": "/vagas", "today": "/vagas/hoje", "manage": "/alertas/gerir", "salary_prefix": "/salarios",
        "salary_map": SALARY_BR, "professions": BR_PROFESSIONS, "districts": BR_STATES, "other": "Outros",
        "sectors": {"publico": "Público", "privado": "Privado", "ipss": "Filantrópico"},
        "sector_chip": {"Público": "Público", "Filantrópico": "Filantrópico", "Privado": "Privado"},
        "vet": None, "expires": "br", "param": ("distrito", "profissao", "setor"),
        "loc": loc_br, "where_none": "no Brasil", "fmt": fmt_dot, "what_prof": "vagas de", "what_none": "vagas de saúde",
        "sector_word": "setor", "pt_dentist_rule": False, "morning": (6, 14), "evening": (17, 23),
        "t": {
            "subject": "As vagas mais vistas da semana em {prof}", "subject_none": "As vagas mais vistas da semana em saúde",
            "title": "Seu resumo de domingo", "preheader": "As vagas mais vistas da semana na sua área, em um só email.",
            "intro": "O que mais se viu nesta semana no VagaSaúde, para o seu alerta de {summary}.",
            "h_top5": "As 5 vagas mais vistas da semana na sua área", "h_top": "As vagas mais vistas da semana na sua área",
            "new_one": "Esta semana entrou 1 vaga nova {what} {where}{which}",
            "new_many": "Esta semana entraram {n} vagas novas {what} {where}{which}",
            "of_prof": "de {prof}", "of_none": "de saúde",
            "btn_job": "Ver vaga", "btn_list": "Ver as vagas {where_label}", "btn_list_generic": "Ver todas as vagas deste alerta",
            "today": "Vagas de hoje", "salary": "Salários: {prof}", "more": "Mais",
            "views_one": "1 visualização na semana", "views_many": "{n} visualizações na semana",
            "published": {"today": "hoje", "yesterday": "ontem", "days": "há {n} dias", "month": "há 1 mês",
                          "months": "há {n} meses", "date": "a {d}"},
            "weekly": 'Você recebe este resumo uma vez por semana. Para deixar de recebê-lo, cancele ou altere seu alerta <a href="{manage}" style="color:{muted};text-decoration:underline;">aqui</a>.',
            "weekly_text": "Você recebe este resumo uma vez por semana. Para deixar de recebê-lo, cancele ou altere seu alerta aqui: {manage}",
            "footer": "Você recebe este email porque criou um alerta de {summary} no VagaSaúde.",
            "manage_label": "Gerenciar ou cancelar alerta", "manage_text": "Gerenciar ou cancelar",
            "all_health": "saúde",
        },
    },
    "es": {
        "dir": "vacantessalud", "lang": "es", "tz": "Europe/Madrid", "site_url": "https://vacantessalud.es",
        "from": "VacantesSalud <alertas@vacantessalud.es>", "host": "vacantessalud.es", "utm_source": "vacantessalud",
        "brand": 'Vacantes<span style="color:{primary};">Salud</span>', "brand_text": "VacantesSalud",
        "social_label": "Síguenos y recibe ofertas cada día",
        "social": [("Telegram", "telegram", "https://t.me/vacantessalud"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029VbE2wId4SpkNer4zlP3s"),
                   ("Instagram", "instagram", "https://www.instagram.com/vacantessalud/"),
                   ("Facebook", "facebook", "https://www.facebook.com/vacantesalud")],
        "prefix": "/empleo", "today": "/empleo/hoy", "manage": "/alertas/gestionar", "salary_prefix": "/salarios",
        "salary_map": SALARY_ES, "professions": ES_PROFESSIONS, "districts": ES_REGIONS, "other": "Otros",
        "sectors": {"publico": "Público", "privado": "Privado", "concertado": "Concertado"},
        "sector_chip": {"Público": "Público", "Concertado": "Concertado", "Privado": "Privado"},
        "vet": "Veterinaria", "expires": "es", "param": ("comunidad", "profesion", "sector"),
        "loc": loc_es, "where_none": "en España", "fmt": fmt_dot, "what_prof": "ofertas de", "what_none": "ofertas de empleo sanitario",
        "sector_word": "sector", "pt_dentist_rule": False, "morning": (6, 14), "evening": (17, 23),
        "t": {
            "subject": "Las ofertas más vistas de la semana en {prof}", "subject_none": "Las ofertas más vistas de la semana en salud",
            "title": "Tu resumen del domingo", "preheader": "Las ofertas más vistas de la semana en tu área, en un solo email.",
            "intro": "Lo más visto esta semana en VacantesSalud, para tu alerta de {summary}.",
            "h_top5": "Las 5 ofertas más vistas de la semana en tu área", "h_top": "Las ofertas más vistas de la semana en tu área",
            "new_one": "Esta semana ha entrado 1 oferta nueva {what} {where}{which}",
            "new_many": "Esta semana han entrado {n} ofertas nuevas {what} {where}{which}",
            "of_prof": "de {prof}", "of_none": "de empleo sanitario",
            "btn_job": "Ver oferta", "btn_list": "Ver las ofertas {where_label}", "btn_list_generic": "Ver todas las ofertas de esta alerta",
            "today": "Ofertas de hoy", "salary": "Sueldos: {prof}", "more": "Más",
            "views_one": "1 visita esta semana", "views_many": "{n} visitas esta semana",
            "published": {"today": "hoy", "yesterday": "ayer", "days": "hace {n} días", "month": "hace 1 mes",
                          "months": "hace {n} meses", "date": "el {d}"},
            "weekly": 'Recibes este resumen una vez por semana. Para dejar de recibirlo, anula o modifica tu alerta <a href="{manage}" style="color:{muted};text-decoration:underline;">aquí</a>.',
            "weekly_text": "Recibes este resumen una vez por semana. Para dejar de recibirlo, anula o modifica tu alerta aquí: {manage}",
            "footer": "Recibes este email porque creaste una alerta de {summary} en VacantesSalud.",
            "manage_label": "Gestionar o cancelar la alerta", "manage_text": "Gestionar o cancelar",
            "all_health": "salud",
        },
    },
    "it": {
        "dir": "offertesanita", "lang": "it", "tz": "Europe/Rome", "site_url": "https://offertesanita.it",
        "from": "Offerte Sanità <avvisi@offertesanita.it>", "host": "offertesanita.it", "utm_source": "offertesanita",
        "brand": 'Offerte <span style="color:{primary};">Sanità</span>', "brand_text": "Offerte Sanità",
        "social_label": "Seguici e ricevi offerte ogni giorno",
        "social": [("Telegram", "telegram", "https://t.me/offertesanita"),
                   ("WhatsApp", "whatsapp", "https://whatsapp.com/channel/0029VbDuqMp9xVJnr0RzZG04"),
                   ("Instagram", "instagram", "https://www.instagram.com/offertesanita/"),
                   ("Facebook", "facebook", "https://www.facebook.com/offertesanita")],
        "prefix": "/offerte", "today": "/offerte/oggi", "manage": "/avvisi/gestisci", "salary_prefix": "/stipendi",
        "salary_map": SALARY_IT, "professions": IT_PROFESSIONS, "districts": IT_REGIONS, "other": "Altro",
        "sectors": {"pubblico": "Pubblico", "privato": "Privato", "accreditato": "Accreditato"},
        "sector_chip": {"Pubblico": "Pubblico", "Accreditato": "Accreditato", "Privato": "Privato"},
        "vet": "Veterinaria", "expires": "raw", "param": ("regione", "professione", "settore"),
        "loc": loc_it, "where_none": "in Italia", "fmt": fmt_dot, "what_prof": "offerte di", "what_none": "offerte di lavoro sanitarie",
        "sector_word": "settore", "pt_dentist_rule": False, "morning": (6, 14), "evening": (17, 23),
        "t": {
            "subject": "Le offerte più viste della settimana in {prof}", "subject_none": "Le offerte più viste della settimana in sanità",
            "title": "Il tuo riepilogo della domenica", "preheader": "Le offerte più viste della settimana nella tua area, in una sola email.",
            "intro": "Il più visto questa settimana su Offerte Sanità, per il tuo avviso per {summary}.",
            "h_top5": "Le 5 offerte più viste della settimana nella tua area", "h_top": "Le offerte più viste della settimana nella tua area",
            "new_one": "Questa settimana è entrata 1 nuova offerta {what} {where}{which}",
            "new_many": "Questa settimana sono entrate {n} nuove offerte {what} {where}{which}",
            "of_prof": "di {prof}", "of_none": "di lavoro sanitarie",
            "btn_job": "Vedi offerta", "btn_list": "Vedi le offerte {where_label}", "btn_list_generic": "Vedi tutte le offerte di questo avviso",
            "today": "Offerte di oggi", "salary": "Stipendi: {prof}", "more": "Altro",
            "views_one": "1 visita questa settimana", "views_many": "{n} visite questa settimana",
            "published": {"today": "oggi", "yesterday": "ieri", "days": "{n} giorni fa", "month": "1 mese fa",
                          "months": "{n} mesi fa", "date": "il {d}"},
            "weekly": 'Ricevi questo riepilogo una volta a settimana. Per non riceverlo più, annulla o modifica il tuo avviso <a href="{manage}" style="color:{muted};text-decoration:underline;">qui</a>.',
            "weekly_text": "Ricevi questo riepilogo una volta a settimana. Per non riceverlo più, annulla o modifica il tuo avviso qui: {manage}",
            "footer": "Ricevi questa email perché hai creato un avviso per {summary} su Offerte Sanità.",
            "manage_label": "Gestisci o annulla l'avviso", "manage_text": "Gestisci o annulla",
            "all_health": "sanità",
        },
    },
}

# ---------------------------------------------------------------- utilitários
def mask(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def log(line: str, to_file: bool) -> None:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(line, flush=True)
    if to_file:
        with open(LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(f"{stamp} {line}\n")


def read_env(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    try:
        for line in open(path, encoding="utf-8"):
            m = re.match(r"\s*([A-Z_]+)=(.*)", line)
            if m:
                out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def site_config(code: str) -> dict:
    cfg = dict(SITES[code])
    env = read_env(f"/var/www/{cfg['dir']}/.env.production")
    cfg["from"] = env.get("EMAIL_FROM") or cfg["from"]
    cfg["site_url"] = (env.get("NEXT_PUBLIC_SITE_URL") or cfg["site_url"]).rstrip("/")
    cfg["code"] = code
    return cfg


def parse_ms(value) -> float | None:
    """Date.parse (UTC): epoch ms ou None."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp() * 1000


def parse_loose(value) -> float | None:
    """parseLooseDate de job-store.ts: ISO ou dd/mm/aaaa."""
    ms = parse_ms(value)
    if ms is not None:
        return ms
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(value or ""))
    if not m:
        return None
    try:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc).timestamp() * 1000
    except ValueError:
        return None


def norm(text: str) -> str:
    """normalize() de job-store.ts."""
    t = unicodedata.normalize("NFKD", text or "")
    t = re.sub(r"[̀-ͯ]", "", t).lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def slug_key(label: str) -> str:
    """toCategorySlug (categories.ts)."""
    t = unicodedata.normalize("NFKD", label)
    t = re.sub(r"[̀-ͯ]", "", t).lower()
    t = re.sub(r"[^a-z0-9]+", "-", t)
    return re.sub(r"-+", "-", t).strip("-")


# ---------------------------------------------------------------- vagas -> cartões (lib/job-store.ts)
CLOSED_NOTICE = {
    "default": ["lista de classificacao", "lista de ordenacao", "homologacao da lista", "classificacao final",
                "anulacao do ato", "anulacao da referencia", "lista de candidatos", "lista unitaria",
                "lista da avaliacao", "retificacao da lista"],
}
IT_CLOSED = ["graduatoria finale", "approvazione della graduatoria", "approvazione graduatoria", "elenco degli ammessi",
             "elenco ammessi", "elenco dei candidati", "calendario delle prove", "diario delle prove",
             "esito della selezione", "esito selezione", "rettifica del bando"]


def is_closed_notice(code: str, title: str) -> bool:
    t = norm(title)
    if re.search(r"^\(\d", title.strip()) or re.search(r"\bassistenza clienti\b|\bin (?:italiano|tedesco|francese)\b", t):
        return True
    if code == "it":
        if re.match(r"^graduatori[ae]\b", t):
            return False
        return (any(k in t for k in IT_CLOSED) or t.startswith("revoca ") or t.startswith("avviso di rettifica")
                or t.startswith("comunicazione "))
    return (any(k in t for k in CLOSED_NOTICE["default"]) or t.startswith("anulacao ")
            or t.startswith("nota informativa") or t.startswith("convocatoria"))


def normalize_published(value, first_seen, now_ms: float):
    """normalizePublishedAt -> ms (usa createdAt se a data da fonte é inválida ou futura)."""
    t = parse_loose(value)
    if t is None or t > now_ms:
        return parse_loose(first_seen)
    return t


def stable_published(value, first_seen, now_ms: float):
    normalized = normalize_published(value, first_seen, now_ms)
    seen = parse_loose(first_seen)
    if normalized is not None and seen is not None and seen < normalized:
        return seen
    return normalized


def _end_of_day_ms(y: int, m: int, d: int, tz) -> float | None:
    try:
        return datetime(y, m, d, 23, 59, 59, tzinfo=tz).timestamp() * 1000
    except ValueError:
        return None


def normalize_expires(code: str, value, published_ms, now_ms: float) -> float | None:
    """normalizeExpiresAt do BR e do ES (PT/IT usam expiresAt tal como está)."""
    raw = (value or "").strip() if isinstance(value, str) else ""
    if code in ("pt", "it"):
        return parse_ms(value)
    if not raw:
        return None
    tz = timezone(timedelta(hours=-3)) if code == "br" else ZoneInfo("Europe/Madrid")
    ms = None
    iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", raw)
    dmy = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    midnight = re.match(r"^(\d{4})-(\d{2})-(\d{2})T00:00(?::00(?:\.0+)?)?(?:Z|[+-]00:?00)$", raw) if code == "es" else None
    if iso or midnight:
        g = (iso or midnight).groups()
        ms = _end_of_day_ms(int(g[0]), int(g[1]), int(g[2]), tz)
    elif dmy:
        ms = _end_of_day_ms(int(dmy.group(3)), int(dmy.group(2)), int(dmy.group(1)), tz)
    else:
        ms = parse_ms(raw)
    if ms is None:
        return None
    year = datetime.fromtimestamp(ms / 1000, timezone.utc).year
    if year < 2000 or year > datetime.fromtimestamp(now_ms / 1000, timezone.utc).year + 3:
        return None
    if published_ms is not None and ms < published_ms - DAY_MS:
        return None
    return ms


def clean_title(text: str) -> str:
    t = html.unescape(text or "")
    t = re.sub("[\U0001F000-\U0001FAFF☀-➿️‍]", "", t)
    t = re.sub(r"\(\s*\)", "", t)
    t = re.sub(r"\s{2,}", " ", t).strip()
    t = re.sub(r"[\s,;:—\-–/]+$", "", t)
    return t


def short_title(text: str, limit: int = 110) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(" ,;:-–—/(")
    return cut + "…"


def load_cards(cfg: dict, now_ms: float) -> list[dict]:
    """Cartões de vagas ativas (equivale a listJobCards) com os campos usados no resumo."""
    code = cfg["code"]
    with open(f"/var/www/{cfg['dir']}/data/jobs.json", encoding="utf-8") as fh:
        jobs = json.load(fh).get("jobs", [])
    active = []
    for job in jobs:
        if job.get("status") != "published" or is_closed_notice(code, job.get("title") or ""):
            continue
        created = job.get("createdAt") or ""
        pub_norm = normalize_published(job.get("publishedAt"), created, now_ms)
        expires = normalize_expires(code, job.get("expiresAt"), pub_norm, now_ms)
        last_seen = parse_ms(job.get("lastSeenAt") or job.get("updatedAt") or "")
        # isInactiveByDate
        seen_recently = last_seen is not None and now_ms - last_seen < 2 * DAY_MS
        if expires is not None and expires < now_ms and not seen_recently:
            continue
        if last_seen is not None and now_ms - last_seen > 7 * DAY_MS:
            continue
        if not (expires is not None and expires >= now_ms):
            if pub_norm is not None and now_ms - pub_norm > 365 * DAY_MS:
                continue
        active.append((job, expires, pub_norm))
    # findRepostings: mesma vaga republicada -> fica a mais antiga
    groups: dict[str, list] = {}
    for item in active:
        job = item[0]
        key = "|".join([norm(job.get("title") or ""), norm(job.get("company") or ""),
                        norm(job.get("locationConcelho") or job.get("locationDistrict") or ""),
                        norm(job.get("description") or "")[:400]])
        groups.setdefault(key, []).append(item)
    canonical_of: dict[str, str] = {}
    for items in groups.values():
        if len(items) < 2:
            continue
        items = sorted(items, key=lambda i: ((i[0].get("createdAt") or ""), i[0].get("slug") or ""))
        for copy in items[1:]:
            canonical_of[copy[0]["slug"]] = items[0][0]["slug"]
    cards = []
    for job, expires, _pub in active:
        if job["slug"] in canonical_of:
            continue
        created = job.get("createdAt") or ""
        stable = stable_published(job.get("publishedAt"), created, now_ms)
        profession = job.get("profession") or ""
        if cfg["vet"] and "veterin" in norm(job.get("title") or ""):
            profession = cfg["vet"]
        cards.append({
            "slug": job["slug"], "title": clean_title(job.get("title") or ""),
            "company": html.unescape((job.get("company") or "").strip()),
            "district": job.get("locationDistrict") or "", "city": job.get("locationConcelho") or job.get("locationDistrict") or "",
            "sector": cfg["sectors"].get(job.get("sector"), job.get("sector") or ""),
            "contract": job.get("contractType") or "", "profession": profession,
            "published_ms": stable, "first_seen_ms": parse_ms(created), "expires_ms": expires, "views": 0,
        })
    copies: dict[str, list[str]] = {}
    for copy_slug, main_slug in canonical_of.items():
        copies.setdefault(main_slug, []).append(copy_slug)
    for card in cards:
        card["_canon_copies"] = copies.get(card["slug"], [])  # visitas às cópias contam para a vaga principal
    return cards


def load_views(cfg: dict, now: datetime) -> dict[str, int]:
    """Visualizações dos últimos 7 dias (dias UTC, hoje incluído) por path de vaga: days[AAAA-MM-DD].paths[path]."""
    path = f"/var/www/{cfg['dir']}/data/site-stats.json"
    try:
        with open(path, encoding="utf-8") as fh:
            days = json.load(fh).get("days", {})
    except (OSError, ValueError):
        return {}
    wanted = {(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)}
    prefix = cfg["prefix"] + "/"
    views: dict[str, int] = {}
    for day, data in days.items():
        if day not in wanted:
            continue
        for p, n in (data.get("paths") or {}).items():
            if p.startswith(prefix):
                slug = urllib.parse.unquote(p[len(prefix):]).strip("/")
                if slug and "/" not in slug:
                    views[slug] = views.get(slug, 0) + int(n or 0)
    return views


# ---------------------------------------------------------------- correspondência (lib/alerts.ts)
MEDICO_DENTISTA = re.compile(r"m[eé]dic[oa]s?(?:\(a\)|/a)?\s+dentista|\bdentista\b|medicina\s+dent[aá]ria\s*\(m[eé]dic", re.I)
NOT_DENTIST = re.compile(r"assistente|auxiliar|higienista|prot[eé]sico|rece[cç][aã]o|recepcionista", re.I)


def profession_matches(cfg: dict, alert_prof: str, card: dict) -> bool:
    if alert_prof == card["profession"]:
        return True
    return bool(cfg["pt_dentist_rule"] and alert_prof == "Medicina" and card["profession"] == "Medicina Dentária"
                and MEDICO_DENTISTA.search(card["title"]) and not NOT_DENTIST.search(card["title"]))


def alert_matches(cfg: dict, filters: dict, card: dict) -> bool:
    if filters.get("district") and filters["district"] != card["district"]:
        return False
    if filters.get("profession") and not profession_matches(cfg, filters["profession"], card):
        return False
    if filters.get("sector") and filters["sector"] != card["sector"]:
        return False
    return True


def clean_filters(f: dict | None) -> dict:
    f = f or {}
    return {k: ((f.get(k) or "").strip() or None) for k in ("district", "profession", "sector")}


# ---------------------------------------------------------------- textos e links
def summary_text(cfg: dict, f: dict) -> str:
    prof, dist, sector = f.get("profession"), f.get("district"), f.get("sector")
    low = prof if (cfg["code"] == "it" and prof and re.match(r"^[A-Z]{2,}$", prof)) else (prof or "").lower()
    what = f"{cfg['what_prof']} {low}" if prof else cfg["what_none"]
    where = cfg["loc"](dist) if dist else cfg["where_none"]
    which = f" ({cfg['sector_word']} {sector.lower()})" if sector else ""
    return f"{what} {where}{which}"


def alert_jobs_path(cfg: dict, f: dict, cards: list[dict]) -> str:
    """alertJobsPath de lib/email.ts: landing de categoria quando existe e tem >=3 vagas, senão listagem filtrada."""
    prof, dist, sector = f.get("profession"), f.get("district"), f.get("sector")
    p = prof if prof and prof in cfg["professions"] else None
    d = dist if dist and dist in cfg["districts"] else None
    if not sector and (p or d):
        n = sum(1 for c in cards if (not p or c["profession"] == p) and (not d or c["district"] == d))
        if n >= 3:
            ps, ds = (slug_key(p) if p else None), (slug_key(d) if d else None)
            base = cfg["prefix"]
            if ps and ds:
                return f"{base}/{ps}/{ds}"
            return f"{base}/{ps or ds}"
    params = []
    keys = cfg["param"]
    if dist:
        params.append((keys[0], dist))
    if prof:
        params.append((keys[1], prof))
    if sector:
        params.append((keys[2], sector))
    return f"{cfg['prefix']}?{urllib.parse.urlencode(params)}" if params else cfg["prefix"]


_salary_cache: dict[str, bool] = {}


def url_ok(url: str) -> bool:
    if url not in _salary_cache:
        ok = False
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(url, method=method, headers={"User-Agent": "vagasaude-maint"})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    ok = resp.status == 200
                break
            except urllib.error.HTTPError as err:
                ok = False
                if err.code != 405:
                    break
            except Exception:
                ok = False
                break
        _salary_cache[url] = ok
    return _salary_cache[url]


def salary_path(cfg: dict, profession: str | None) -> str | None:
    slug = cfg["salary_map"].get(profession or "")
    if not slug:
        return None
    path = f"{cfg['salary_prefix']}/{slug}"
    return path if url_ok(cfg["site_url"] + path) else None


def published_label(cfg: dict, ms: float | None, now_ms: float) -> str | None:
    if ms is None:
        return None
    t = cfg["t"]["published"]
    days = int((now_ms - ms) // DAY_MS)
    if days <= 0:
        return t["today"]
    if days == 1:
        return t["yesterday"]
    if days < 30:
        return t["days"].format(n=days)
    months = days // 30
    if months < 12:
        return t["month"] if months == 1 else t["months"].format(n=months)
    d = datetime.fromtimestamp(ms / 1000, timezone.utc)
    return t["date"].format(d=d.strftime("%d/%m/%Y"))


def job_place(card: dict) -> str:
    city = re.sub(r",\s*(Portugal|Brasil|Brazil|España|Spain|Italia|Italy)$", "", card["city"], flags=re.I).strip()
    if not city or city == card["district"]:
        return card["district"] or city
    return city if card["district"] in city else f"{city}, {card['district']}"


# ---------------------------------------------------------------- seleção do conteúdo
def build_content(cfg: dict, alert: dict, cards: list[dict], views: dict[str, int], now_ms: float) -> dict | None:
    f = clean_filters(alert.get("filters"))
    cutoff_open = now_ms + DAY_MS
    week_ago = now_ms - 7 * DAY_MS
    open_jobs = [c for c in cards
                 if (c["expires_ms"] is None or c["expires_ms"] >= cutoff_open) and alert_matches(cfg, f, c)]
    if not open_jobs:
        return None
    for c in open_jobs:
        c["views"] = views.get(c["slug"], 0) + sum(views.get(s, 0) for s in c.get("_canon_copies", []))
    ranked = sorted(open_jobs, key=lambda c: (-(c["views"]), -(c["published_ms"] or 0), c["title"]))
    with_views = [c for c in ranked if c["views"] > 0]
    top = with_views[:TOP_N]
    if len(top) < TOP_N:
        rest = sorted([c for c in open_jobs if c not in top], key=lambda c: (-(c["published_ms"] or 0), c["title"]))
        top += rest[:TOP_N - len(top)]
    new_count = sum(1 for c in open_jobs if (c["first_seen_ms"] or 0) >= week_ago)
    return {"filters": f, "top": top, "open": len(open_jobs), "new": new_count, "with_views": len(with_views),
            "list_path": alert_jobs_path(cfg, f, cards), "salary_path": salary_path(cfg, f.get("profession"))}


# ---------------------------------------------------------------- template (layout de lib/email.ts)
def build_email(cfg: dict, token: str, content: dict, now_ms: float) -> dict:
    esc = html.escape
    su = cfg["site_url"]
    t = cfg["t"]
    f = content["filters"]

    def tracked(path: str) -> str:
        sep = "&" if "?" in path else "?"
        return f"{su}{path}{sep}utm_source={cfg['utm_source']}&utm_medium=email&utm_campaign={CAMPAIGN}"

    manage = f"{su}{cfg['manage']}?token={urllib.parse.quote(token, safe='')}"
    unsub = f"{su}/api/alerts/unsubscribe?token={urllib.parse.quote(token, safe='')}"

    def icons(size: int, gap: int) -> str:
        return "".join(
            f'<a href="{u}" style="display:inline-block;margin:0 {gap}px;text-decoration:none;"><img src="{su}/email/social-{i}.png" '
            f'width="{size}" height="{size}" alt="{n}" title="{n}" style="display:block;border:0;border-radius:{size // 2}px;"></a>'
            for n, i, u in cfg["social"])

    def button(href: str, label: str) -> str:
        return (f'<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 0;"><tr><td bgcolor="{C["primary"]}" style="border-radius:10px;">'
                f'<a href="{href}" style="display:inline-block;padding:13px 22px;font-family:{FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">{esc(label)}</a></td></tr></table>')

    def para(text: str, extra: str = "") -> str:
        return f'<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:{C["muted"]};{extra}">{text}</p>'

    def chip(value: str, tone: str = "plain") -> str:
        base = "display:inline-block;margin:0 6px 6px 0;padding:3px 9px;border-radius:999px;font-size:12px;line-height:1.4;"
        if tone == "primary":
            return f'<span style="{base}background:{C["primarySoft"]};font-weight:700;color:{C["primary"]};">{esc(value)}</span>'
        return f'<span style="{base}border:1px solid {C["border"]};color:{C["muted"]};">{esc(value)}</span>'

    def job_view(card: dict) -> tuple[str, list[str], list[tuple[str, str]]]:
        meta = [m for m in (card["company"], job_place(card), published_label(cfg, card["published_ms"], now_ms)) if m]
        chips: list[tuple[str, str]] = []
        if card["views"] > 0:
            chips.append((t["views_one"] if card["views"] == 1 else t["views_many"].format(n=cfg["fmt"](card["views"])), "primary"))
        chips.append((cfg["sector_chip"].get(card["sector"], card["sector"]), "plain"))
        if card["contract"] and len(card["contract"]) <= 30 and card["contract"] != "A definir":
            chips.append((card["contract"], "plain"))
        return short_title(card["title"]), meta, chips

    def job_card(card: dict) -> str:
        href = tracked(f"{cfg['prefix']}/{card['slug']}")
        title, meta, chips = job_view(card)
        chips_html = "".join(chip(v, tone) for v, tone in chips)
        return f'''<tr><td style="padding:0 0 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid {C["border"]};border-radius:12px;">
    <tr><td style="padding:16px 16px 12px;font-family:{FONT};">
      <a href="{href}" style="font-size:16px;line-height:1.35;font-weight:700;color:{C["text"]};text-decoration:none;">{esc(title)}</a>
      <div style="margin:4px 0 10px;font-size:14px;line-height:1.5;color:{C["muted"]};">{esc(" · ".join(meta))}</div>
      <div style="margin:0 0 6px;">{chips_html}</div>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 0;"><tr><td bgcolor="{C["primary"]}" style="border-radius:8px;">
        <a href="{href}" style="display:inline-block;padding:9px 18px;font-family:{FONT};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">{esc(t["btn_job"])}</a>
      </td></tr></table>
    </td></tr>
  </table>
</td></tr>'''

    summary = summary_text(cfg, f)
    prof, dist, sector = f.get("profession"), f.get("district"), f.get("sector")
    which = f" ({cfg['sector_word']} {sector.lower()})" if sector else ""
    what = t["of_prof"].format(prof=((prof if (cfg["code"] == "it" and re.match(r"^[A-Z]{2,}$", prof or "")) else (prof or "").lower()))) if prof else t["of_none"]
    where = cfg["loc"](dist) if dist else cfg["where_none"]
    n = content["new"]
    new_line = (t["new_one"] if n == 1 else t["new_many"]).format(n=cfg["fmt"](n), what=what, where=where, which=which) if n > 0 else None
    top = content["top"]
    h_top = t["h_top5"] if len(top) == TOP_N else t["h_top"]
    list_href = tracked(content["list_path"])
    if (prof or dist) and not sector:
        list_label = t["btn_list"].format(where_label=f"{what} {where}")
    else:
        list_label = t["btn_list_generic"]

    links = [(t["today"], tracked(cfg["today"]))]
    if content["salary_path"]:
        links.append((t["salary"].format(prof=prof), tracked(content["salary_path"])))
    links_html = " &nbsp;·&nbsp; ".join(
        f'<a href="{href}" style="color:{C["primary"]};font-weight:700;text-decoration:none;">{esc(label)} →</a>' for label, href in links)

    new_box = ""
    if new_line:
        new_box = (f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 0;background:{C["primarySoft"]};border-radius:12px;">'
                   f'<tr><td style="padding:14px 16px;font-family:{FONT};font-size:15px;line-height:1.5;font-weight:700;color:{C["primary"]};">'
                   f'<a href="{list_href}" style="color:{C["primary"]};text-decoration:none;">{esc(new_line)} →</a></td></tr></table>')

    body = (para(esc(t["intro"].format(summary=summary)))
            + f'<h2 style="margin:20px 0 4px;font-size:17px;line-height:1.35;font-weight:800;color:{C["text"]};">{esc(h_top)}</h2>'
            + f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">\n'
            + "\n".join(job_card(c) for c in top) + "\n</table>"
            + new_box + button(list_href, list_label)
            + f'<div style="margin:22px 0 0;font-family:{FONT};font-size:14px;line-height:1.8;">{links_html}</div>')

    weekly = t["weekly"].format(manage=manage, muted=C["muted"])
    footer = (f'{esc(t["footer"].format(summary=summary))}<br>\n'
              f'<a href="{manage}" style="color:{C["muted"]};text-decoration:underline;">{esc(t["manage_label"])}</a>\n&nbsp;·&nbsp;\n'
              f'<a href="{su}" style="color:{C["muted"]};text-decoration:underline;">{esc(cfg["host"])}</a><br>\n{weekly}')
    brand = cfg["brand"].format(primary=C["primary"], muted=C["muted"])
    doc = f'''<!doctype html>
<html lang="{cfg["lang"]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{esc(t["title"])}</title>
</head>
<body style="margin:0;padding:0;background:{C["page"]};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{esc(t["preheader"])}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{C["page"]}" style="background:{C["page"]};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
      <tr><td style="padding:0 8px 18px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td valign="middle">
        <a href="{tracked("/")}" style="text-decoration:none;font-family:{FONT};">
          <img src="{su}/email/logo-mark.png" width="28" height="24" alt="" style="vertical-align:middle;border:0;">
          <span style="vertical-align:middle;font-size:18px;font-weight:800;letter-spacing:-0.3px;color:{C["text"]};">{brand}</span>
        </a>
        </td>
        <td align="right" valign="middle" style="white-space:nowrap;">{icons(20, 3)}</td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="{C["card"]}" style="background:{C["card"]};border:1px solid {C["border"]};border-radius:16px;padding:28px 24px;font-family:{FONT};">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:800;color:{C["text"]};">{esc(t["title"])}</h1>
        {body}
      </td></tr>
      <tr><td align="center" style="padding:22px 8px 4px;font-family:{FONT};">
        <div style="margin:0 0 10px;font-size:13px;font-weight:600;color:{C["muted"]};">{esc(cfg["social_label"])}</div>
        {icons(32, 5)}
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-family:{FONT};font-size:12px;line-height:1.6;color:{C["subtle"]};">
        {footer}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>'''
    lines = [t["title"], "", t["intro"].format(summary=summary), "", h_top, ""]
    for c in top:
        title, meta, chips = job_view(c)
        lines += [f"• {title}", "  " + " · ".join(meta + [v for v, _ in chips]), f"  {tracked(cfg['prefix'] + '/' + c['slug'])}"]
    lines += [""]
    if new_line:
        lines += [f"{new_line}: {list_href}", ""]
    lines += [f"{label}: {href}" for label, href in links]
    lines += ["", "—", t["footer"].format(summary=summary), f"{t['manage_text']}: {manage}",
              t["weekly_text"].format(manage=manage)]
    subject = t["subject"].format(prof=prof) if prof else t["subject_none"]
    return {"subject": subject, "html": doc, "text": "\n".join(lines),
            "headers": {"List-Unsubscribe": f"<{unsub}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"}}


# ---------------------------------------------------------------- dados externos
def load_alerts(cfg: dict) -> list[dict]:
    path = f"/var/www/{cfg['dir']}/data/alerts.json"
    try:
        with open(path, encoding="utf-8") as fh:
            raw = json.load(fh)
    except FileNotFoundError:
        return []
    return raw if isinstance(raw, list) else raw.get("alerts", [])


def load_json(path: str, default):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (FileNotFoundError, ValueError):
        return default


def save_state(state: dict) -> None:
    """Escrita atómica; preserva dono e modo se o ficheiro já existir (senão root, 600)."""
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)
        fh.flush()
        os.fsync(fh.fileno())
    if os.path.exists(STATE_FILE):
        st = os.stat(STATE_FILE)
        os.chmod(tmp, st.st_mode & 0o777)
        try:
            os.chown(tmp, st.st_uid, st.st_gid)
        except PermissionError:
            pass
    else:
        os.chmod(tmp, 0o600)
    os.replace(tmp, STATE_FILE)


def resend_key() -> str:
    key = read_env(KEY_ENV).get("RESEND_API_KEY", "")
    if not key:
        sys.exit("RESEND_API_KEY em falta")
    return key


def local_day_start_utc(tz: str, now: datetime) -> datetime:
    local = now.astimezone(ZoneInfo(tz))
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def emailed_today(key: str, since: datetime) -> set[str]:
    """Destinatários de qualquer email enviado desde `since` (conta Resend partilhada pelos sites)."""
    seen: set[str] = set()
    after = None
    cutoff = since.strftime("%Y-%m-%d %H:%M:%S")
    for _ in range(300):
        url = "https://api.resend.com/emails?limit=100" + (f"&after={after}" if after else "")
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", "User-Agent": "vagasaude-maint"})
        try:
            data = json.load(urllib.request.urlopen(req, timeout=30))
        except urllib.error.HTTPError as err:
            if err.code == 429:
                time.sleep(1.5)
                continue
            raise
        items = data.get("data", [])
        for item in items:
            if item["created_at"][:19].replace("T", " ") >= cutoff:
                for to in item.get("to") or []:
                    seen.add(to.strip().lower())
        if not data.get("has_more") or not items or items[-1]["created_at"][:19].replace("T", " ") < cutoff:
            break
        after = items[-1]["id"]
        time.sleep(0.6)
    return seen


def digest_windows_pending(cfg: dict, now: datetime) -> list[str]:
    """Janelas do digest diário da app (alert-digest.ts) que ainda vão enviar hoje (aberta agora ou a abrir em <6 h)."""
    state = load_json(f"/var/www/{cfg['dir']}/data/alert-state.json", {})
    local = now.astimezone(ZoneInfo(cfg["tz"]))
    day = local.strftime("%Y-%m-%d")
    hour = local.hour + local.minute / 60
    pending = []
    for name, (start, end), done in (("manhã", cfg["morning"], state.get("lastDigestDay")),
                                      ("fim do dia", cfg["evening"], state.get("lastEveningDigestDay"))):
        if done != day and hour < end and hour >= start - 6:
            pending.append(f"{name} ({start}-{end} h {local.tzname()})")
    return pending


def send_one(key: str, cfg: dict, to: str, content: dict, idem: str) -> tuple[bool, str]:
    payload = json.dumps({"from": cfg["from"], "to": [to], "subject": content["subject"], "html": content["html"],
                          "text": content["text"], "headers": content["headers"],
                          "tags": [{"name": "site", "value": re.sub(r"[^A-Za-z0-9_-]", "_", urllib.parse.urlparse(cfg["site_url"]).hostname or "site")},
                                   {"name": "campaign", "value": CAMPAIGN}]}).encode()
    for attempt in range(4):
        req = urllib.request.Request("https://api.resend.com/emails", data=payload, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
            "User-Agent": "vagasaude-maint", "Idempotency-Key": idem})
        try:
            data = json.load(urllib.request.urlopen(req, timeout=30))
            return True, data.get("id", "")
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", "replace")[:200]
            if err.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            return False, f"HTTP {err.code}: {body}"
        except Exception as err:
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            return False, f"erro: {type(err).__name__}"
    return False, "esgotadas as tentativas"


# ---------------------------------------------------------------- execução
def plan_site(code: str, now: datetime, today_iso: str, state: dict, emailed: set[str], claimed: set[str]) -> dict:
    """Escolhe destinatários e conteúdo de um site. `claimed` = endereços já tratados noutro site nesta execução."""
    cfg = site_config(code)
    now_ms = now.timestamp() * 1000
    alerts = load_alerts(cfg)
    stats = {"alerts": len(alerts), "active": 0, "email_issue": 0, "invalid": 0, "emailed_today": 0,
             "already_sent": 0, "other_site": 0, "no_jobs": 0, "multi": 0}
    result = {"cfg": cfg, "stats": stats, "items": [], "jobs_open": 0}
    if not alerts:
        return result
    cards = load_cards(cfg, now_ms)
    views = load_views(cfg, now)
    result["jobs_open"] = len(cards)
    result["jobs_with_views"] = sum(1 for c in cards if views.get(c["slug"]))
    by_email: dict[str, list[dict]] = {}
    for alert in alerts:
        if alert.get("status") != "active":
            continue
        stats["active"] += 1
        email = (alert.get("email") or "").strip().lower()
        if alert.get("emailIssue"):
            stats["email_issue"] += 1
        elif not EMAIL_RE.match(email) or not alert.get("token"):
            stats["invalid"] += 1
        else:
            by_email.setdefault(email, []).append(alert)
    done = state.get(code, {})
    for email, group in sorted(by_email.items()):
        group.sort(key=lambda a: a.get("updatedAt") or a.get("createdAt") or "", reverse=True)
        if len(group) > 1:
            stats["multi"] += 1
        principal = group[0]
        if email in emailed:
            stats["emailed_today"] += 1
        elif any((done.get(a.get("id")) or {}).get("date") == today_iso for a in group):
            stats["already_sent"] += 1
        elif email in claimed:
            stats["other_site"] += 1
        else:
            content = build_content(cfg, principal, cards, views, now_ms)
            if not content:
                stats["no_jobs"] += 1
                continue
            claimed.add(email)
            result["items"].append({"email": email, "alert": principal, "content": content})
    return result


def pick_previews(items: list[dict], n: int) -> list[dict]:
    """Destinatários reais para os previews: perfis de filtro diferentes primeiro (profissão/região), com visitas."""
    ranked = sorted(items, key=lambda it: -it["content"]["with_views"])
    picked: list[dict] = []
    patterns: set = set()
    for it in ranked:
        f = it["content"]["filters"]
        pattern = (bool(f["profession"]), bool(f["district"]))
        if pattern not in patterns:
            picked.append(it)
            patterns.add(pattern)
        if len(picked) >= n:
            return picked
    for it in ranked:
        if it not in picked:
            picked.append(it)
        if len(picked) >= n:
            break
    return picked


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--send", action="store_true")
    ap.add_argument("--site", choices=SITE_ORDER, help="só este site (por omissão todos)")
    ap.add_argument("--preview-dir", default="/tmp/resumo-domingo-previews")
    ap.add_argument("--previews-per-site", type=int, default=2)
    ap.add_argument("--force", action="store_true", help="ignora a guarda do domingo (só com --send)")
    ap.add_argument("--ignore-digest-windows", action="store_true", help="envia mesmo com o digest diário ainda por sair")
    args = ap.parse_args()

    now = datetime.now(timezone.utc)
    lisbon = now.astimezone(ZoneInfo("Europe/Lisbon"))
    today_iso = lisbon.strftime("%Y-%m-%d")
    if args.send and not args.force and lisbon.weekday() != 6:
        log(f"[weekly-digest] RECUSADO: hoje ({today_iso}) não é domingo em Lisboa; nada enviado (--force só se for intencional)", True)
        return 3
    sites = [args.site] if args.site else SITE_ORDER

    lock = open(LOCK_FILE, "a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("outra instância em curso", file=sys.stderr)
        return 4

    key = resend_key()
    tag = "SEND" if args.send else "dry-run"
    state = load_json(STATE_FILE, {})
    # "hoje": o mais cedo entre o início do dia em Lisboa e o do fuso de cada site (conservador)
    since = min([local_day_start_utc("Europe/Lisbon", now)] + [local_day_start_utc(SITES[s]["tz"], now) for s in sites])
    emailed = emailed_today(key, since)
    log(f"[weekly-digest] {tag} {today_iso}: {len(emailed)} endereços já receberam email nosso desde {since.strftime('%Y-%m-%dT%H:%MZ')}", args.send)
    if args.dry_run:
        os.makedirs(args.preview_dir, exist_ok=True)

    claimed: set[str] = set()
    total_ok = total_fail = 0
    first = True
    for code in sites:
        plan = plan_site(code, now, today_iso, state, emailed, claimed)
        cfg, st, items = plan["cfg"], plan["stats"], plan["items"]
        log(f"[weekly-digest] {tag} {code}: destinatários={len(items)} | alertas={st['alerts']} ativos={st['active']} "
            f"| excluídos: emailIssue={st['email_issue']} inválidos={st['invalid']} recebeu-email-hoje={st['emailed_today']} "
            f"resumo-já-enviado={st['already_sent']} outro-site={st['other_site']} sem-vagas={st['no_jobs']} "
            f"| vagas abertas={plan['jobs_open']} com visitas={plan.get('jobs_with_views', 0)} | endereços com >1 alerta={st['multi']}", args.send)
        if args.dry_run:
            for shown, it in enumerate(pick_previews(items, args.previews_per_site)):
                email = build_email(cfg, "TOKEN-DE-EXEMPLO", it["content"], now.timestamp() * 1000)
                name = f"preview-{code}.html" if shown == 0 else f"preview-{code}-{shown + 1}.html"
                with open(os.path.join(args.preview_dir, name), "w", encoding="utf-8") as fh:
                    fh.write(email["html"])
                log(f"[weekly-digest]   preview: {os.path.join(args.preview_dir, name)} ({mask(it['email'])}) assunto: {email['subject']}", False)
            if not items:
                # sem destinatários (ex.: IT sem alertas): preview sintético com um alerta sem filtros, só para ver o template
                cards = load_cards(cfg, now.timestamp() * 1000)
                synth = build_content(cfg, {"filters": {}}, cards, load_views(cfg, now), now.timestamp() * 1000)
                if synth:
                    email = build_email(cfg, "TOKEN-DE-EXEMPLO", synth, now.timestamp() * 1000)
                    path = os.path.join(args.preview_dir, f"preview-{code}.html")
                    with open(path, "w", encoding="utf-8") as fh:
                        fh.write(email["html"])
                    log(f"[weekly-digest]   preview SINTÉTICO (sem alertas reais): {path} assunto: {email['subject']}", False)
            for it in items:
                c = it["content"]
                log(f"[weekly-digest]   {mask(it['email'])}  abertas={c['open']} novas7d={c['new']} comVisitas={c['with_views']} "
                    f"top={len(c['top'])} salarios={'sim' if c['salary_path'] else 'não'}", False)
            continue

        pending = [] if args.ignore_digest_windows else digest_windows_pending(cfg, now)
        if pending:
            for it in items:
                claimed.discard(it["email"])
            log(f"[weekly-digest] {code}: SALTADO, digest diário ainda por sair hoje: {', '.join(pending)}. "
                f"Repetir mais tarde com --send --site {code} (ou --ignore-digest-windows).", True)
            continue
        for it in items:
            if not first:
                time.sleep(SEND_INTERVAL)
            first = False
            email = it["email"]
            idem = f"weekly-digest-{today_iso}-{hashlib.sha256(email.encode()).hexdigest()[:24]}"
            content = build_email(cfg, it["alert"]["token"], it["content"], time.time() * 1000)
            ok, info = send_one(key, cfg, email, content, idem)
            if ok:
                total_ok += 1
                state.setdefault(code, {})[it["alert"]["id"]] = {
                    "date": today_iso, "sentAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "resendId": info}
                save_state(state)  # logo após cada envio: uma falha a meio não repete emails
                log(f"[weekly-digest] {code} {mask(email)} enviado resend_id={info}", True)
            else:
                total_fail += 1
                log(f"[weekly-digest] {code} {mask(email)} FALHOU {info}", True)
    if args.send:
        log(f"[weekly-digest] fim: {total_ok} enviados, {total_fail} falhados", True)
    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
