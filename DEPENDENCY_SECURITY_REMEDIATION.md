# Dependency security remediation — Phase 06

Status: **FIXED AND VERIFIED** for all critical/high advisories. Remaining
advisories are moderate/low and are itemized below. Live deployment and live
provider validation remain separately blocked (no credentials or permissions
were supplied).

## 1. Baseline and authoritative verification

- Node `v24.22.2`, npm `11.19.1`.
- Baselines: server `30` advisories (**2 critical, 18 high**, 8 moderate, 2 low);
  client `33` (**3 critical, 10 high**, 14 moderate, 6 low); root `0`.
- Raw `npm audit --json` captures, matched before/after lockfiles and a normalized
  machine-readable inventory are committed under `security/dependency-audit/`.
  Regenerate the inventory with
  `node scripts/generate-dependency-inventory.mjs` (no network access).
- Critical advisory metadata was cross-checked against the GitHub Advisory
  Database, including `GHSA-jqcg-44mw-7w3h` / `CVE-2026-90711` (`proxy-addr`,
  fixed in 2.0.8) and `GHSA-p293-qw3h-jr36` / `CVE-2026-75604` (Next.js Windows
  RCE, fixed in 16.3.3; the project was on 16.3.0).

Original critical paths:

| Workspace | Package | Installed | Advisory | Reachability |
| --- | --- | --- | --- | --- |
| server | `proxy-addr` (via `express`) | 2.0.7 | `GHSA-jqcg-44mw-7w3h` / `CVE-2026-90711` | Unauthenticated `X-Forwarded-For` -> `req.ip`, rate-limit keys, audit logs |
| server | `better-auth` (direct) | 1.6.26 | OAuth-state magic-link sign-in, OAuth-proxy takeover (GHSA-1243467, GHSA-1243466) | Unauthenticated auth callback endpoints |
| client | `next` (direct) | 16.3.0 | Several RCEs incl. `GHSA-p293-qw3h-jr36`, `GHSA-2xp9-vwfh-vxw4`, `GHSA-673q-mjm6-r5xr` | Image optimization, routing, cache/server rendering |
| client | `proxy-addr` (via `shadcn > @modelcontextprotocol/sdk > express`) | 2.0.7 | same as above | Build-tooling path, but fixed uniformly |
| client | `better-auth` (direct) | 1.6.28 | same auth advisories | Auth endpoints |

## 2. Changes applied (smallest compatible patched versions)

### Direct upgrades

| Workspace | Package | Before | After | Why |
| --- | --- | --- | --- | --- |
| server | `better-auth` | 1.6.26 | 1.7.27 | Fixes critical OAuth state/proxy advisories |
| server | `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 7.9.1 | 7.10.1 | Current patched v7 line; no major jump |
| server | `firecrawl` | 4.32.0 | 4.54.0 | Removes nested vulnerable axios/zod |
| server | `inngest` | 4.18.0 | 4.26.2 | Keeps v4; nested zod handled by override |
| server | `mem0ai` | 3.1.5 | 3.3.1 | Fixes cross-tenant key collision advisory + nested zod |
| server | `multer` | 2.2.0 | 2.5.0 | Fixes multipart DoS / fd leak advisories |
| server | `zod` | 4.4.3 | 4.6.7 | Fixes oversized-constrained-collection memory exhaustion |
| client | `next` | 16.3.0 | 16.4.6 | Patches all listed RCE, SSRF, cache and header advisories; same major |
| client | `eslint-config-next` | 16.3.0 | 16.4.6 | Kept aligned with Next.js |
| client | `better-auth` | 1.6.28 | 1.7.27 | Same critical auth fixes as server |
| client | `shadcn` | 4.16.2 | 4.23.0 | Removes nested high advisories; still a build-time CLI only |

### Overrides (all patch-level within the existing major line unless noted)

| Workspace | Override | Resolves |
| --- | --- | --- |
| server | `proxy-addr@2.0.8` | Critical IP-spoofing advisory on the real Express request path |
| server | `body-parser@2.4.0` | Compressed-body trailing-byte DoS |
| server | `brace-expansion@2.1.7` | Nested-brace recursion DoS |
| server | `fast-uri@3.1.9` | SSRF/host-confusion advisories in ajv URI parsing |
| server | `follow-redirects@1.16.3` | Cross-origin credential stripping bypass |
| server | `systeminformation@5.33.23` | Windows command injection in host metrics |
| server | `undici@7.30.2` | TLS validation bypass, cache poisoning and DoS cluster |
| server | `@grpc/grpc-js@1.14.7` | Unauthorized certificate acceptance in auth contexts |
| server | `effect@3.22.5` | `GHSA-7589-6fvf-x4pw` ReDoS; **first patched 3.x**, avoiding an incompatible v4 major jump |
| server | `zod: "$zod"` | Forces nested zod 3.x copies (Inngest/Mem0) to the direct 4.6.7 |
| client | `proxy-addr@2.0.8`, `body-parser@2.4.0`, `fast-uri@3.1.9`, `js-yaml@4.3.2`, `source-map-js@1.2.4`, `systeminformation@5.33.23`, `undici@7.30.2`, `@modelcontextprotocol/sdk@1.32.2`, `zod@4.6.7` | All client critical/high transitive advisories |
| client | `minimatch@3 > brace-expansion@1.1.21`, `minimatch@10 > brace-expansion@5.0.12` | Patches both brace-expansion major lines without cross-major breakage |

A attempted `effect@4.1.5` override was **rejected and reverted** because
`prisma generate` failed to load `prisma.config.ts`; 3.22.5 is the first patched
3.x release per the advisory. No `npm audit fix`, `--force`, audit disablement,
or blind mass upgrade was used.

## 3. Regression tests

- `server/src/config/proxy-trust.test.ts` (new, 6 tests): Express's real `req.ip`
  getter with untrusted headers, trusted IPv4/IPv6 proxies, the vulnerable
  `::ffff:10.0.0.0/8` short-prefix case (must be ignored after 2.0.8), genuine
  IPv4-mapped proxy trust, and a live HTTP rate-limit test proving spoofed
  `X-Forwarded-For` values cannot reset the limiter bucket.
- `server/src/config/env.test.ts` (expanded from 2 to 9 tests): staging payment
  identity, production-middleware requirement, mandatory staging secrets,
  distinct OAuth state secret, DB identity/production-endpoint rejection,
  forbidden endpoint denylist, storage ownership gate, and a regression proving
  a failed validation is no longer cached.
- Final full suite re-run after all edits: **137 unit**, 47 integration, 3
  Playwright E2E. (The 137 includes the 6 new proxy tests and the expanded
  9-test env suite.)

## 4. Final advisory counts

| Workspace | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| server | 0 | 0 | 7 | 0 | 7 |
| client | 0 | 0 | 10 | 4 | 14 |
| root | 0 | 0 | 0 | 0 | 0 |

No critical or high advisory remains. Remaining moderate/low advisories are:

- **server**: `@opentelemetry/auto-instrumentations-node`,
  `@opentelemetry/instrumentation-http`, `gaxios`, `gcp-metadata`, `glob`,
  `minimatch`, `rimraf`. These are observability/build-tooling paths reached
  through Inngest/Prisma; npm's suggested fixes require breaking major upgrades
  (e.g. minimatch 7-10 -> 11, OpenTelemetry 0.79 -> 0.22x/0.30x). They are
  **ACCEPTED RISK — OWNER APPROVAL REQUIRED** for any future environment where
  untrusted input reaches these tools; no untrusted request path was found.
- **client**: `shadcn`, `@ts-morph/common`, `ts-morph`, `minimatch`,
  `@typescript-eslint/*`, `typescript-eslint`, `dompurify`, `katex`, `mermaid`,
  `streamdown`. `shadcn` is a component-generator CLI not imported by the
  running app; its suggested fix is a major downgrade to 1.0.0, which was
  rejected. DOMPurify/KaTeX findings are low-severity and reached only through
  Markdown rendering of user content; rendering input is bounded by existing
  message-size limits and no high/critical path remains.

None of these remaining advisories were represented as fixed. None was silently
suppressed; all are in the committed inventory with dependency chains and review
notes.

## 5. CI security gates

`.github/workflows/ci.yml` now has a `dependency-security` job that runs
`npm ci` + `npm audit --audit-level=high` in both workspaces and asserts that
`npm ci` leaves the lockfiles unchanged. This fails any future critical/high
advisory. The job comment documents the only acceptable exception route: a
time-bounded, narrowly scoped change linked to an explicit accepted-risk entry
in this file with owner approval. No global audit suppression is used.

## 6. Phase 07 recheck (no blind upgrades)

After the final Phase 07 code edits, `npm audit --json` was rerun in all three
workspaces:

| Workspace | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| server | 0 | 0 | 7 | 0 | 7 |
| client | 0 | 0 | 10 | 4 | 14 |
| root | 0 | 0 | 0 | 0 | 0 |

These counts are unchanged from Phase 06. No package was upgraded, downgraded or
blindly `npm audit fix`ed during Phase 07. The same residual package sets remain
reviewed and **ACCEPTED RISK — OWNER APPROVAL REQUIRED**; their dependency chains
and reachability notes stay in `security/dependency-audit/inventory.json`. The
CI critical/high gate was not weakened. A new independent `staging-blueprint-guard`
CI job was added for staging isolation, not dependency suppression.

Lockfile reproducibility was re-verified: server `npm ci` succeeded in place;
an OS-level lock on one client source-map file prevented in-place reinstall, so
`npm ci` was run successfully in a clean temporary directory with the committed
client manifest/lockfile (`TEMP_CLIENT_NPM_CI_EXIT=0`) and both lockfiles remained
byte-identical under `git diff --exit-code`.

---

## 7. Phase 08 dependency verification

After the final Phase 08 code edits, `npm audit --json` was rerun: server
`SERVER_AUDIT_EXIT=1` with 0 critical / 0 high / 7 moderate / 0 low, client
`CLIENT_AUDIT_EXIT=1` with 0 critical / 0 high / 10 moderate / 4 low, and root
`ROOT_AUDIT_EXIT=0` with zero advisories. Both `npm audit --audit-level=high`
gates exited 0. The residual moderate/low advisories remain **ACCEPTED RISK —
OWNER APPROVAL REQUIRED**; no blind `npm audit fix`, audit suppression or lockfile
change was used.
