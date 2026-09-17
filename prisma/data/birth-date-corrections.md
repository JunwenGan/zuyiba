# Birth-date corrections

Reviewed on 2026-09-13. These 17 dates in `players.csv` failed the game's age validation (14–60 years). Only `birthDate` was changed; clubs, nationalities and other fields were not audited or changed.

Dates use ISO `YYYY-MM-DD`. Sources are official club/league pages except Axel Camblan, whose date was cross-checked between FotMob and [Transfermarkt](https://www.transfermarkt.fr/axel-camblan/profil/spieler/924800).

| Player | Previous date | Corrected date | Source |
| --- | --- | --- | --- |
| Stefan Bajcetic | 2025-06-30 | 2004-10-22 | [Profile or club report](https://www.liverpoolfc.com/team/academy/player/stefan-bajcetic) |
| Lewis Hall | 2025-06-30 | 2004-09-08 | [Profile or club report](https://www.newcastleunited.com/en/teams/mens-team/lewis-hall) |
| El Hadji Malick Diouf | 2023-02-21 | 2004-12-28 | [Profile or club report](https://www.premierleague.com/en/news/4358144/west-ham-sign-senegal-left-back-diouf-from-slavia-prague) |
| Pablo Barrios | 2025-06-30 | 2003-06-15 | [Profile or club report](https://www.laliga.com/en-GB/player/pablo-barrios-rivas) |
| Omar El Hilali | 2025-06-30 | 2003-09-12 | [Profile or club report](https://www.rcdespanyol.com/es/equipos/rcd-espanyol-b/omar/1459) |
| Rubén Sánchez | 2024-06-30 | 2001-02-04 | [Profile or club report](https://www.rcdespanyol.com/en/teams/rcd-espanyol/ruben-s/2335) |
| Umut Tohumcu | 2026-06-30 | 2004-08-11 | [Profile or club report](https://www.bundesliga.com/pt/jogador/umut-tohumcu) |
| Eliesse Ben Seghir | 2025-06-30 | 2005-02-16 | [Profile or club report](https://www.bundesliga.com/en/player/eliesse-ben-seghir) |
| Justin Diehl | 2024-06-30 | 2004-11-27 | [Profile or club report](https://www.vfb.de/de/vfb/profis/kader/2526/justin-diehl/spielerprofil/) |
| Simon Simoni | 2027-06-30 | 2004-07-14 | [Profile or club report](https://profis.eintracht.de/2023-2024/kader/simon-simoni/) |
| Mika Baur | 2022-06-30 | 2004-07-09 | [Profile or club report](https://www.bundesliga.com/pt/jogador/mika-baur) |
| Devis Vásquez | 2026-06-30 | 1998-05-12 | [Profile or club report](https://www.asroma.com/it/notizie/73613/devis-vasquez-e-un-nuovo-calciatore-giallorosso) |
| Nicolò Cambiaghi | 2024-06-30 | 2000-12-28 | [Profile or club report](https://www.laliga.com/jugador/nicolo-cambiaghi) |
| Cristian Volpato | 2026-06-30 | 2003-11-15 | [Profile or club report](https://www.asroma.com/it/notizie/64215/6-statistiche-dopo-roma-hellas-verona) |
| Axel Camblan | 2025-06-30 | 2003-08-30 | [Profile or club report](https://www.fotmob.com/fr/players/1289641/axel-camblan) |
| Issa Soumaré | 2022-06-30 | 2000-10-10 | [Profile or club report](https://www.staderennais.com/actualites/mercato/issa-soumare-est-rouge-et-noir) |
| Guéla Doué | 2025-06-30 | 2002-10-17 | [Profile or club report](https://www.staderennais.com/actualites/club/joyeux-anniversaire-guela) |

## Refresh notes

- El Hadji Malick Diouf uses 28 December 2004 as explicitly reported by the Premier League. Some secondary profiles report 29 December; retain the official league date unless stronger evidence resolves that discrepancy.
- Several invalid dates resemble contract end dates, but the cause has not been established. Do not automatically substitute a guessed year.
- A future `fetch-players` run can overwrite these manual CSV corrections. Recheck this record if validation fails after fetching. The seed validates the complete CSV before writing any players.
- Passing validation checks date format and plausible age, not the factual accuracy of every player's birthday.

