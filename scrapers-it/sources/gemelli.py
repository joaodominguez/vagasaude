"""Fondazione Policlinico Universitario Agostino Gemelli IRCCS (Roma): inRecruiting di Intervieweb.

Lista pubblica ``https://policlinicogemelli.intervieweb.it/app.php?module=career`` (~20 annunci, 2 pagine).
Il robots.txt del dominio centrale di Intervieweb vieta ``/*LAC*``; il Gemelli ha AUTORIZZATO la raccolta
delle sue offerte (comunicazione al proprietario del progetto, 2026-11-17). Vale solo per questo cliente.
Solo ruoli clinici: medici, infermieri, fisioterapisti, biologi; bandi di ricerca, stage, amministrativi
e data/IT restano fuori. Vedi sources/_intervieweb.py.
"""
from ._intervieweb import InterviewebScraper


class GemelliScraper(InterviewebScraper):
    slug = "gemelli"
    name = "Policlinico Gemelli - Lavora con noi"
    company = "Policlinico Gemelli"
    career_url = "https://policlinicogemelli.intervieweb.it/app.php?module=career&lang=it"
