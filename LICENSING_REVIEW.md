# Licensing review (Phase 06)

**Status: OWNER DECISION REQUIRED. Public redistribution is BLOCKED — LICENSING
EVIDENCE INSUFFICIENT.**

## 1. Evidence found in the repository

| Source | Statement |
| --- | --- |
| Upstream repository | No top-level `LICENSE` file at the time of source review |
| Upstream `README.md` | Stated the project was licensed under the MIT License |
| Upstream `server/package.json` | Declares `"license": "ISC"` |
| `ATTRIBUTION.md` (this repo) | Preserves source attribution, original author/demo links, the owner's private-use permission statement, and the conflicting-license notice |

`ATTRIBUTION.md` is intentionally **unchanged** by Phases 05–06 and must not be
removed or edited to assert a broader grant.

## 2. What this work did and did not do

- Preserved all attribution, copyright and licensing notices exactly as found.
- Did not add a `LICENSE` file, change package `license` fields, or claim
  independent authorship of the upstream code.
- Did not contact the upstream repository or its owner.
- Kept the repository private and pushed only to `origin`.

## 3. Decision required from the owner

Before any public redistribution or downstream licensing claim, the owner must
resolve the MIT-vs-ISC conflict and the missing upstream `LICENSE` file. Options:

1. Obtain and retain an explicit written license grant / `LICENSE` file from the
   original author, consistent with the attribution notice; or
2. Obtain a legal determination that the documented permission is sufficient
   for the intended distribution, recorded in this repository; or
3. Keep Kairos private and make no public redistribution claim.

Until one of these is completed, the repository stays private and the
independent licensing gate remains **E. PUBLIC REDISTRIBUTION BLOCKED —
LICENSING EVIDENCE INSUFFICIENT** for any public-release question. This does not
prevent a controlled, private staging validation (overall classification B in
`RELEASE_READINESS_REPORT.md`) as an engineering step, but it does gate public
release and any new license assertion. Dependency or staging fixes never
resolve this gate.
