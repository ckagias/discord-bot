# Testing

## Bot: Jest

`tests/` mirrors `slashCommands/`, `events/`, `handlers/` (including `handlers/components/`), `src/`, and `utils/` file-for-file, so coverage gaps are visible directly from the directory structure. 129 test files as of this writing, covering every command category and most utility modules (`envCheck`, `musicPersistence`, `antiRaid`, `punishments`, `triggerCache`, `upsertRetry`, and more).

Config: `jest.config.js`, `ts-jest` preset, node environment, ignores `dashboard/` and `dist/`.

```bash
npx jest                          # full suite
npx jest tests/slashCommands/economy   # scoped to one category
npx jest tests/utils/antiRaid.test.ts  # single file
```

Run scoped tests while iterating on a specific area, run the full suite once before committing or opening a PR.

## Dashboard: Vitest

Separate suite, `dashboard/vitest.config.ts`. `dashboard/lib/__tests__/` covers `authorize`, `db`, `discord`, `forms`, `session`. Each `[guildId]/<category>/actions.ts` route has an `actions.test.ts` alongside it. `app/api/health/__tests__/route.test.ts` covers the health endpoint.

```bash
cd dashboard && npx vitest        # full dashboard suite
```

## Coverage

`coverage/` at the repo root holds an lcov report (handlers, utils). Regenerate with Jest's `--coverage` flag.

## Adding tests

New tests go under `tests/<mirrored path>/`, not co-located with the source file. See `CONTRIBUTING.md` for the general contribution workflow.
