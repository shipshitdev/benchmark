# Fixtures

Every `.jsonl` file in this directory is hand-written synthetic data shaped to match each CLI's
documented event schema (`DESIGN.md` section 2, and the flags verified against `<cli> --help` /
`<cli> --version` on 2026-09-06). None of it was captured from a real run; the adapters are never
executed against the live CLIs in this repo's tests or CI.
