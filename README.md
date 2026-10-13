# Pokémon Strikers

Arcade 3v3 football (terrain vertical, caméra qui suit le ballon, disques colorés par équipe) avec des sprites Pokémon statiques (gen 5), vue de dessus, et des hissatsu façon Inazuma Eleven.
Un **défi du jour** par jour : même équipe imposée et même dresseur canon pour tout le monde (reset à 12:00 heure de Paris, comme Pokédle).

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests du moteur
npm run build
```

## Contrôles

| Action | Clavier | Tactile |
|---|---|---|
| Déplacement | Flèches / ZQSD / WASD | Joystick |
| Tir (maintenir = chargé, direction = coin visé) | Espace ou J | TIR |
| Passe (juste après réception = passe parfaite) | K | PASSE |
| Tacle (sans faute) / feinte avec le ballon | L | TACLE |
| Hissatsu 1 (tir) / 2 (dribble ou tacle) | U / I | boutons orange |
| Timing du duel | Espace | TIRE ! |

## Règles

- 3 contre 3 : gardien, défenseur, attaquant. Le 4e Pokémon du jour est remplaçant (non jouable pour l'instant).

- Match de 90 s, puis mort subite de 30 s si égalité. Égalité = pas de victoire (un cœur perdu).
- 3 cœurs par jour : victoire = défi terminé et série +1 ; sinon -1 cœur ; plus de cœur = série à 0.
- **PP** partagés par équipe (50 au départ, +1,3/s, +4 par tacle réussi).
- **Hissatsu de tir** : lance un duel tireur / gardien. Puissance du tir × efficacité des types × timing (zone verte ×1,2) contre le bouclier du gardien (Abri, ou plongeon de base si plus de PP). Les types abîment le gardien en cas d'arrêt : Feu = brûlure, Eau = ralenti, Électrik = paralysé, Glace = gelé.
- **Hissatsu secondaire** : dribble (invulnérable + sprint) ou tacle (portée et réussite garanties).
- Passe parfaite : appuyer sur PASSE juste à l'arrivée du ballon donne un tir boosté.

## Architecture

- `src/engine/` : simulation pure et déterministe (pas fixe 60 Hz, PRNG seedé, aucune dépendance DOM). Testée avec Vitest.
  - `sim.ts` match, `data.ts` espèces/capacités/dresseurs, `types.ts` table d'efficacité, `daily.ts` seed du jour.
- `src/render.ts` rendu Canvas 2D, `src/ui/` écrans React (accueil, équipe, match, résultat) en glassmorphism clair.
- `src/storage.ts` sauvegarde locale (cœurs, série, record), `src/share.ts` grille de partage.
- Sprites : PokeAPI gen 5 (`public/sprites/{front,back}`). Portraits des dresseurs : sprites Showdown chargés à la volée, avec repli sur l'initiale.

## Hors MVP (idées v2)

Remplaçant jouable, jauge de super-tir du capitaine, items, combos de hissatsu, ARRÊT activable, classement en ligne (Supabase), portraits de dresseurs embarqués.

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` (push sur `main`). `base: './'` : fonctionne sous `/pokemon-strikers/`.
