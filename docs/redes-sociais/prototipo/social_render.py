"""Exemplo de post diário BR (carrossel Instagram + imagem única FB/Telegram + textos). Gera social_br/.

Script descartável: venv/bin/python -I social_render.py
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from final1 import horizontal, icon, N, T, DN, DT

OUT = os.path.join(HERE, "social_br")
os.makedirs(OUT, exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CAMPAIGN = "top-vagas-2026-11-17"
SITE = "https://vagasaude.com.br"

# dados das 4 vagas escolhidas (social_pick_br.py), com cidade/UF dos campos locationConcelho/locationDistrict
JOBS = [
    dict(slug="tecnico-de-enfermagem-unidades-de-internacao-unimed-guarulhos-guarulhos-12872563",
         title="Técnico de Enfermagem – Unidades de Internação", company="Unimed Guarulhos",
         place="Guarulhos/SP", area="Enfermagem"),
    dict(slug="fisioterapeuta-fundacao-jose-silveira-fundacao-jose-silveira-fjs-12877357",
         title="Fisioterapeuta", company="Fundação José Silveira", place="Salvador/BA", area="Fisioterapia"),
    dict(slug="dc-farmaceutico-a-centro-blumenau-sc-clamed-drogaria-catarinense-preco-popular-clamed-12875041",
         title="Farmacêutico(a) – Centro", company="Clamed (Drogaria Catarinense)", place="Blumenau/SC", area="Farmácia"),
    dict(slug="tecnico-de-nutricao-cema-hospital-especializado-cemahospitalespecializado-3913317",
         title="Técnico de Nutrição", company="CEMA Hospital Especializado", place="São Paulo/SP", area="Nutrição"),
]

FONT = '<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=block" rel="stylesheet">'
BASE_CSS = f"""*{{box-sizing:border-box;margin:0}} body{{font-family:Outfit,sans-serif}}
.navy{{background:{N};color:#fff}} .white{{background:#fff;color:{N}}}
.pill{{display:inline-block;border-radius:999px;padding:14px 30px;font-weight:600;font-size:34px}}"""


def page(w, h, inner, cls="navy"):
    return (f'<!doctype html><html><head><meta charset=utf-8>{FONT}<style>{BASE_CSS}'
            f'.s{{width:{w}px;height:{h}px;position:relative;overflow:hidden;padding:84px}}</style></head>'
            f'<body><div class="s {cls}">{inner}</div></body></html>')


def deco(color, op):
    return (f'<svg viewBox="0 0 100 100" style="position:absolute;right:-90px;top:-90px;width:520px;opacity:{op}">'
            f'<path d="M38 4h24v34h34v24H62v34H38V62H4V38h34Z" fill="{color}"/></svg>')


def cover():
    inner = (deco(T, .18) + f'<div style="position:absolute;left:84px;top:84px">{horizontal(n=DN, t=DT, h=78)}</div>'
             '<div style="position:absolute;left:84px;right:84px;top:400px">'
             f'<div class=pill style="background:{T};color:#fff">Fim de semana</div>'
             '<div style="font-size:104px;font-weight:700;line-height:1.02;margin-top:40px;letter-spacing:-2px">As vagas de saúde mais procuradas</div>'
             '<div style="font-size:42px;margin-top:36px;color:#cfe6ef">4 oportunidades em SP, BA e SC</div></div>'
             '<div style="position:absolute;left:84px;bottom:84px;font-size:36px;color:#9fd9db">Arraste para ver →</div>')
    return page(1080, 1350, inner)


def job_slide(i, j):
    inner = (f'<div style="position:absolute;left:84px;top:84px">{horizontal(h=60)}</div>'
             f'<div style="position:absolute;right:84px;top:96px;font-size:34px;color:#7b8fa8">{i}/4</div>'
             '<div style="position:absolute;left:84px;right:84px;top:330px">'
             f'<div class=pill style="background:#e3f4f4;color:#0f7e82">{j["area"]}</div>'
             f'<div style="font-size:88px;font-weight:700;line-height:1.05;margin-top:44px;letter-spacing:-1.5px">{j["title"]}</div>'
             f'<div style="font-size:48px;font-weight:500;margin-top:44px;color:#29486e">{j["company"]}</div>'
             f'<div style="font-size:44px;margin-top:18px;color:#5c7290">📍 {j["place"]}</div></div>'
             f'<div style="position:absolute;left:0;right:0;bottom:0;height:200px;background:{N};color:#fff;'
             'display:flex;align-items:center;justify-content:space-between;padding:0 84px">'
             '<div style="font-size:40px;font-weight:600">Candidate-se pelo link na bio</div>'
             f'<div style="font-size:34px;color:{DT}">vagasaude.com.br</div></div>')
    return page(1080, 1350, inner, "white")


def cta():
    inner = (deco(T, .18) + f'<div style="position:absolute;left:84px;top:84px">{horizontal(n=DN, t=DT, h=78)}</div>'
             '<div style="position:absolute;left:84px;right:84px;top:420px">'
             '<div style="font-size:96px;font-weight:700;line-height:1.04;letter-spacing:-2px">Receba vagas como estas no seu e-mail</div>'
             '<div style="font-size:44px;margin-top:40px;color:#cfe6ef">Alertas grátis por profissão e cidade. No máximo 2 e-mails por dia.</div></div>'
             f'<div style="position:absolute;left:84px;bottom:84px" class=pill><span class=pill style="background:{T};color:#fff">vagasaude.com.br/alertas</span></div>')
    return page(1080, 1350, inner)


def square():
    rows = "".join(
        f'<div style="display:flex;gap:26px;align-items:center;padding:30px 0;border-top:2px solid #e3e9f0">'
        f'<div style="width:70px;height:70px;border-radius:18px;background:#e3f4f4;color:#0f7e82;font-weight:700;font-size:38px;'
        f'display:flex;align-items:center;justify-content:center">{k}</div><div><div style="font-size:42px;font-weight:700;line-height:1.1">{j["title"]}</div>'
        f'<div style="font-size:31px;color:#5c7290;margin-top:6px">{j["company"]} · {j["place"]}</div></div></div>'
        for k, j in enumerate(JOBS, 1))
    inner = (f'<div style="display:flex;justify-content:space-between;align-items:center">{horizontal(h=58)}'
             f'<div class=pill style="background:{T};color:#fff;font-size:28px;padding:10px 24px">Mais procuradas</div></div>'
             '<div style="font-size:64px;font-weight:700;margin:46px 0 22px;letter-spacing:-1px;line-height:1.05">As vagas de saúde mais procuradas no fim de semana</div>'
             f'{rows}<div style="margin-top:26px;font-size:32px;color:#0f7e82;font-weight:600">Links na legenda · vagasaude.com.br</div>')
    return page(1080, 1080, inner, "white").replace("padding:84px", "padding:70px")


def shot(name, html, w, h):
    p = os.path.join(OUT, name + ".html")
    open(p, "w").write(html)
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=6000",
                    f"--window-size={w},{h}", f"--screenshot={os.path.join(OUT, name + '.png')}", f"file://{p}"],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def link(j, source):
    return f"{SITE}/vagas/{j['slug']}?utm_source={source}&utm_medium=social&utm_campaign={CAMPAIGN}"


def captions():
    ig = ("As vagas de saúde mais procuradas no fim de semana 👇\n\n"
          + "".join(f"{k}. {j['title']} – {j['company']} ({j['place']})\n" for k, j in enumerate(JOBS, 1))
          + "\n🔗 Candidate-se pelo link na bio.\n🔔 Receba alertas grátis: vagasaude.com.br/alertas\n\n"
            "#vagasdeemprego #vagassaude #enfermagem #tecnicodeenfermagem #fisioterapia #farmacia #nutricao #empregosaude")
    fb = ("As vagas de saúde mais procuradas no fim de semana no VagaSaúde 👇\n\n"
          + "".join(f"{k}. {j['title']} – {j['company']} ({j['place']})\n👉 {link(j, 'facebook')}\n\n" for k, j in enumerate(JOBS, 1))
          + "🔔 Receba vagas como estas no seu e-mail: https://vagasaude.com.br/alertas?utm_source=facebook&utm_medium=social&utm_campaign=" + CAMPAIGN)
    wa = ("*As vagas de saúde mais procuradas no fim de semana* 👇\n\n"
          + "".join(f"*{j['title']}*\n{j['company']} · {j['place']}\n{link(j, 'whatsapp')}\n\n" for j in JOBS)
          + "🔔 Alertas grátis: vagasaude.com.br/alertas")
    return ig, fb, wa


if __name__ == "__main__":
    slides = [("ig-1-capa", cover())] + [(f"ig-{k+1}-vaga", job_slide(k, j)) for k, j in enumerate(JOBS, 1)] + [("ig-6-alertas", cta())]
    for name, html in slides:
        shot(name, html, 1080, 1350)
    shot("fb-telegram", square(), 1080, 1080)
    ig, fb, wa = captions()
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")
    imgs = "".join(f'<img src="{n}.png">' for n, _ in slides)
    prev = f'''<!doctype html><html><head><meta charset=utf-8><title>Post BR — exemplo</title><style>
body{{margin:0;padding:28px;background:#eef0f3;font-family:-apple-system,sans-serif;color:#1f2d3d}}
h2{{font-size:15px;margin:26px 0 10px}} .car{{display:flex;gap:14px;overflow-x:auto;padding-bottom:10px}}
.car img{{height:420px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.12)}}
.row{{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}} .sq{{width:420px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,.12)}}
pre{{white-space:pre-wrap;background:#fff;border-radius:10px;padding:16px 18px;font:14px/1.5 -apple-system,sans-serif;max-width:520px;margin:0}}
</style></head><body>
<h2>Instagram — carrossel (6 imagens 1080×1350)</h2><div class=car>{imgs}</div>
<h2>Legenda Instagram</h2><pre>{esc(ig)}</pre>
<h2>Facebook e Telegram — imagem única (1080×1080) + texto com links</h2><div class=row><img class=sq src="fb-telegram.png"><pre>{esc(fb)}</pre></div>
<h2>Canal de WhatsApp — texto</h2><pre>{esc(wa)}</pre></body></html>'''
    open(os.path.join(OUT, "preview.html"), "w").write(prev)
    print("ok", OUT)
