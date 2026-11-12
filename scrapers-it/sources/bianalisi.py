"""Bianalisi (laboratori analisi e diagnostica): widget Allibo ``ats9`` su https://bianalisi.it/ricerca-personale-sanitario.

Il widget FT=100460 e' la sola candidatura spontanea (esclusa); FT=100480 e' la lista di annunci (TSRM, radiologi,
infermieri, medici del lavoro...). Vedi sources/_allibo.py.
"""
from ._allibo import AlliboScraper


class BianalisiScraper(AlliboScraper):
    slug = "bianalisi"
    name = "Bianalisi - Ricerca personale sanitario"
    company = "Bianalisi"
    list_urls = (
        "https://joblink.allibo.com/ats9/Widget/connector.aspx"
        "?DM=W5jnMuQnVuBemiSJS%2Ftq2i87PUXobVNIdAT8w95adKg%3D&SG=2&FT=100480&LN=IT",
    )
