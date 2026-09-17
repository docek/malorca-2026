# Malorca 2026 – plán cesty 25. 10. – 2. 11. 2026

Tři rodiny (Maradovi, Pavlasovi, Podařilovi), 12 lidí: 5 dospělých a 7 dětí 4–11 let. Základna: dům Cal Tio v Sa Pobla.

- [Plán cesty](https://docek.github.io/malorca-2026/) – lety, první noc u letiště, základna Cal Tio, týden den po dni se stopami pro tři auta (klik na místo otevře kartu, rozbalovací jídlo + prodloužení), rozdělené dny, výletní menu, historický vlak do Sólleru, mapa s dojezdy, rozhodnutí, otevřené otázky, zdroje
- [Katalog výletů](https://docek.github.io/malorca-2026/vylety.html) – 124 aktivit s filtry (region, typ, věk dětí, déšť, dojezd z Cal Tia) a osobním výběrem
- [Kde jíst](https://docek.github.io/malorca-2026/jidlo.html) – místní speciality a zvláštnosti, trhy v našem termínu, gastroturistika (olejárny, vinařství, historické pekárny) a tabulka „specialita dne“, podniky podle oblastí se zavíracími dny, večeře doma
- [Praktické informace](https://docek.github.io/malorca-2026/prakticke.html) – doklady a pojištění, zdraví, peníze, svátky a sezóna, řízení, půjčovny a transfer, Sa Pobla prakticky, počasí, balení, slovníček katalánských výrazů (v textu všech stránek klikací)

Každé místo, podnik i ubytování má jedinou kartu (boční panel s adresou `#p/<id>`, sdílitelnou do WhatsAppu) (proč tam, co zažijeme, jak se tam dostat, tipy, varování, kuriozita pro děti, fotky z Wikimedia Commons). Web je PWA: jde přidat na plochu telefonu (návod pro Android i iPhone pod tlačítkem 📱) a tlačítko „Uložit pro offline“ stáhne stránky, data i fotky.

Statický web, žádný build. `assets/style.css` a `assets/places.js` sdílí všechny stránky, data popupů jsou v `assets/places.json` (zdroj pravdy; `tools/build_places.py` je jen jednorázově sestavil z karet a rešerše, `tools/fetch_commons.py` doplňuje fotky z Commons, `tools/extra_places.json` drží ručně psané karty ubytování, `tools/terms.json` slovníček). Offline: `sw.js` + `manifest.webmanifest`; při změně webu zvýšit `VERSION` v `sw.js`. Lokální náhled: `python3 -m http.server 8766`.
Dojezdy jsou spočítané routingem OSRM ×1,2. Stav podkladů: 17. 9. 2026.
