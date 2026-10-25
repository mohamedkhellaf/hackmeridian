# Testnet spike code (reference only)

The throwaway contract and scripts that proved the options flow on testnet on 2026-10-25 (results: `../20_rwa_options_spike.md`). Not part of the build: the real contract lives in `contracts/options/`. Start from `contracts/options/src/lib.rs` here.

`setup.cjs` writes testnet keys to `keys.json` at runtime; that file is git-ignored and must never be committed.
