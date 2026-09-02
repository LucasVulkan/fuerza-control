# Fuerza & Control

App de entrenamiento (Expo / React Native). Vive entera en [`mobile/`](mobile/).

```bash
cd mobile && npx expo start      # arrancar la app
npx vitest run                   # tests, desde la raíz
npx eslint .                     # lint, desde la raíz
npm run seed                     # genera historial de prueba (.fitdata)
npm run estado                   # mobile/docs/estado.html desde las specs
```

- Reglas de trabajo: [`mobile/AGENTS.md`](mobile/AGENTS.md)
- Estado de las features y specs: [`mobile/docs/specs/README.md`](mobile/docs/specs/README.md)
- Backend (SQL y Edge Functions): [`supabase/`](supabase/)

Hubo una app web en la raíz (`src/components`, `src/hooks`, `src/store`) con su
propia copia del store. Se borró en sep-2026 tras cuatro meses congelada; el
porqué y el cómo, en
[`mobile/docs/specs/rediseno.md`](mobile/docs/specs/rediseno.md) §2.
