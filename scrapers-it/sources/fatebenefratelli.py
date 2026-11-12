"""Fatebenefratelli (Ordine Ospedaliero di San Giovanni di Dio): RSA, ospedali e centri di riabilitazione.

Widget Allibo ``ats1`` incorporato in https://www.fatebenefratelli.it/lavora-con-noi (lista JSON + schede HTML):
vedi sources/_allibo.py. ~12 annunci (OSS, infermieri, psichiatri, fisioterapisti, educatori, TeRP).
"""
from ._allibo import AlliboScraper


class FatebenefratelliScraper(AlliboScraper):
    slug = "fatebenefratelli"
    name = "Fatebenefratelli - Lavora con noi"
    company = "Fatebenefratelli"
    list_urls = (
        "https://joblink.allibo.com/ats1/Widget/connector.aspx"
        "?DM=kqAUebH9YtJgsMH1%2FtUKdqVg28x1sngiFXGxFkrxu%2Bs%3D&SG=2&FT=727&LN=IT",
    )
