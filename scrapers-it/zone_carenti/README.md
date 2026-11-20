# Zone carenti: dataset e controllo

Dati: pubblicazioni ufficiali 2026 delle Regioni (Lombardia, Piemonte, Toscana, Emilia-Romagna) sugli incarichi vacanti / ambiti carenti
di ruolo unico di assistenza primaria, pediatria di libera scelta ed emergenza territoriale 118. Solo ambiti, posti e scadenze.
Mai nomi, graduatorie nominative o punteggi.

- `build_dataset.py`: scarica i PDF ufficiali (UA identificato, 2 s tra richieste), li legge (pdftotext / pdfplumber) e scrive
  `apps/web-it/src/data/zone-carenti/<regione>.json`. Controlli: somma delle righe contro i totali dichiarati nei documenti.
  Corre sul Mac (o in un venv con pdfplumber), il JSON viene versionato in git e arriva al sito con il deploy.
- `watch.py`: health check giornaliero dal VPS (da `run-scrapers.sh`). Confronta i riferimenti 2026 nelle pagine ufficiali con quelli gia' nel
  dataset; se compare una nuova pubblicazione o la pagina cambia struttura, segnala (log + email interna Resend). Non modifica il sito.
- Perche' un dataset versionato e non un leggitore automatico: le fonti sono PDF di formati diversi, pubblicati 2-4 volte l'anno per regione.
  Il parsing va verificato a occhio (totali, righe doppie), e un errore automatico significherebbe pubblicare posti sbagliati.
