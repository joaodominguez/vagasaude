"""Synlab Italia (diagnostica di laboratorio, Medical Center, punti prelievo): inRecruiting di Intervieweb.

Lista pubblica ``https://inrecruiting.intervieweb.it/app.php?module=career&LAC=synlabitalia`` (~60 annunci,
4 pagine; molti non clinici: accoglienza, HR, acquisti, retail, che si scartano dal titolo senza scaricare
la scheda). Il robots.txt di Intervieweb vieta ``/*LAC*``; Synlab Italia ha AUTORIZZATO la raccolta delle
sue offerte (comunicazione al proprietario del progetto, 2026-11-17). Vedi sources/_intervieweb.py.
"""
from ._intervieweb import InterviewebScraper


class SynlabScraper(InterviewebScraper):
    slug = "synlab"
    name = "Synlab Italia - Lavora con noi"
    company = "Synlab Italia"
    career_url = "https://inrecruiting.intervieweb.it/app.php?module=career&LAC=synlabitalia&lang=it"
