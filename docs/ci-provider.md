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

Current source workflow: Plugin CI. `build-plugin` (npm install, typecheck, lint, community scan, release-channel and changelog checks, reporting-service tests, Vitest, build, postbuild, preflight, installable artifact) and `dependency-review`.
The existing GitHub Actions workflows remain intact and own execution until a
replacement is qualified against the exact workload and required checks.

Separate operations: CLA, issue triage, beta release and stable release. Provider planning does not authorize or migrate
these operations.
