"""GVM Care & Research (Lugo, RA; ospedali in Emilia-Romagna, Lazio, Liguria, Lombardia, Marche, Piemonte,
Puglia, Toscana, Veneto): inRecruiting di Intervieweb.

Lista pubblica ``https://jobgvm.intervieweb.it/app.php?module=career`` (~80 annunci, 6 pagine; molti di
pulizie, alberghiero e amministrativo, che si scartano dal titolo senza scaricare la scheda).
Il robots.txt del dominio centrale di Intervieweb vieta ``/*LAC*``; GVM ha AUTORIZZATO la raccolta delle
sue offerte (comunicazione al proprietario del progetto, 2026-11-17). Il sito www.gvmnet.it e' dietro una
challenge Cloudflare e NON viene letto: si usa solo il portale Intervieweb. Vedi sources/_intervieweb.py.
"""
from ._intervieweb import InterviewebScraper


class GvmScraper(InterviewebScraper):
    slug = "gvm"
    name = "GVM Care & Research - Lavora con noi"
    company = "GVM Care & Research"
    career_url = "https://jobgvm.intervieweb.it/app.php?module=career&lang=it"
