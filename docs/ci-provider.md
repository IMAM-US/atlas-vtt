# CI provider operator

The shared registry and operator live in Standalone Search at
`config/ci-providers.json` and `scripts/ci/provider_swap.py`.
This repository's `scripts/ci-provider` forwards its Git remote identity and
all operator arguments to that entry point. Set `SEARCH_CI_REPO` when the shared
checkout is not the sibling `standalone-search` directory.

```sh
scripts/ci-provider --help
scripts/ci-provider
scripts/ci-provider --to github
scripts/ci-provider --to cloudbuild
```

No `--to` selects the registry's preferred provider, Codex. The default operation
is a read-only plan. GitHub Actions and Google Cloud Build remain selectable
secondary providers; selection does not establish qualification or activation.
The registry declares this repository inventory-only. An activation attempt must
fail until an accepted full workload and native provider adapter exist. A plan
can read live repository gates; these local files do not prove live required-check
settings or successful provider execution.

## Existing workload boundary

Current source workflow: Plugin CI. `build-plugin` (npm install, typecheck, lint, community scan, release-channel and changelog checks, reporting-service tests, Vitest, build, postbuild, preflight, installable artifact) and `dependency-review`, joined by `gate`, the one check main's `main-required-checks` ruleset requires.
The existing GitHub Actions workflows remain intact and own execution until a
replacement is qualified against the exact workload and required checks.

Separate operations: CLA, issue triage, beta release and stable release. Provider planning does not authorize or migrate
these operations.

## Deterministic portable workload

`config/ci-workload.json` declares the existing workflow commands, and
`scripts/ci-cloud` delegates to the shared `scripts/ci/portable_codex_job.py`.
It runs all portable scopes, records real exits and logs, and exports
`CI_OUTPUT_DIR/result.json`. This is candidate workload evidence with
`app_bound_proof=false`; provider-native publication and acceptance remain
separate coordinator requirements.

The external supervisor must set `CI_PROVIDER=codex`, `CODEX_CI_RUN_ID`,
`CI_EVENT=push|pull_request`, `CI_EVENT_HEAD` (full SHA), `CI_EVENT_BRANCH`,
and a new absolute `CI_OUTPUT_DIR` outside the tested checkout. For pull requests,
set `CI_BASE_SHA`, positive `CI_PR`, and `CI_DRAFT=false`; the clean checkout must
be the exact base/head merge, with both its parents and merged tree verified.
Push checkouts must match the exact event head. The runner requires native Linux,
Bash, uv, and the workload's declared toolchain. A source mismatch, missing tool,
failed command, timeout or interruption produces a nonzero result.

```sh
# Run only from the supervisor-prepared clean source and environment.
SEARCH_CI_REPO=/path/to/reviewed/standalone-search scripts/ci-cloud
```

The Linux lane executes `build-plugin` and exports the installable `release/` build with file digests. GitHub PR `dependency-review` at moderate severity remains a native control-plane requirement. Linux success therefore returns `incomplete` with exit 2 until the coordinator supplies independent acceptance. Release publishing and CLA remain separate.
