# Test Layout

All tests live under `tests/`, mirroring the `src/` structure:

```
tests/
  unit/
    controllers/
    clients/
    utils/
  integration/
  e2e/
```

- Unit tests: `tests/unit/**/*.test.ts`
- Integration tests: `tests/integration/**/*.test.ts`
- End-to-end tests: `tests/e2e/**/*.test.ts`

Scripts:

- `npm test` — run all tests
- `npm run test:unit` — unit tests only
- `npm run test:integration` — integration tests only
- `npm run test:e2e` — e2e tests only
