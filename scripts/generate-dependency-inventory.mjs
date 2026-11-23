#!/usr/bin/env node
/**
 * Normalizes the raw `npm audit --json` captures from Phase 06 into a single
 * machine-readable inventory. It never contacts the network and never mutates
 * the audit captures. Review classifications live in review-map.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const auditDir = resolve(root, "security/dependency-audit");
const reviewMap = JSON.parse(
    readFileSync(resolve(auditDir, "review-map.json"), "utf8"),
);

const CVE_BY_GHSA = {
    "GHSA-jqcg-44mw-7w3h": "CVE-2026-90711",
    "GHSA-p293-qw3h-jr36": "CVE-2026-75604",
    "GHSA-7589-6fvf-x4pw": "CVE-2026-121707",
};

function readJson(path) {
    return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function lockPackages(area, phase) {
    return readJson(
        `security/dependency-audit/phase06-${phase}.${area}.lock.json`,
    ).packages ?? {};
}

function resolveDependencyPath(packages, parentPath, name) {
    let cursor = parentPath;
    while (true) {
        const candidate = cursor
            ? `${cursor}/node_modules/${name}`
            : `node_modules/${name}`;
        if (packages[candidate]) return candidate;
        if (!cursor) return null;
        const marker = cursor.lastIndexOf("/node_modules/");
        cursor = marker >= 0 ? cursor.slice(0, marker) : "";
    }
}

function dependencyChain(packages, targetPath) {
    if (!targetPath) return [];
    const queue = [[{ path: "", names: [] }, 0]];
    const visited = new Set([""]);
    while (queue.length > 0) {
        const [node] = queue.shift();
        const pkg = packages[node.path] ?? { dependencies: {}, devDependencies: {} };
        const deps = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
            ...(pkg.optionalDependencies ?? {}),
        };
        for (const name of Object.keys(deps)) {
            const childPath = resolveDependencyPath(packages, node.path, name);
            if (!childPath) continue;
            const names = [...node.names, name];
            if (childPath === targetPath) return names;
            if (!visited.has(childPath)) {
                visited.add(childPath);
                queue.push([{ path: childPath, names }]);
            }
        }
    }
    const match = targetPath.match(/(?:^|\/)node_modules\/([^/]+)$/);
    return match ? [match[1]] : [];
}

function advisoryDetails(via) {
    const advisories = [];
    for (const entry of via) {
        if (typeof entry === "string") {
            advisories.push({ id: entry, via: entry });
            continue;
        }
        const ghsa = entry.url?.match(/GHSA-[a-z0-9-]+/i)?.[0] ?? null;
        advisories.push({
            id: ghsa ?? String(entry.source),
            source: entry.source,
            title: entry.title,
            severity: entry.severity,
            range: entry.range,
            cve: CVE_BY_GHSA[ghsa ?? ""] ?? null,
            url: entry.url ?? null,
        });
    }
    return advisories;
}

function patchedBounds(advisories) {
    const bounds = new Set();
    for (const advisory of advisories) {
        const match = advisory.range?.match(/<\s*=?\s*([0-9][0-9A-Za-z.+-]*)/);
        if (match) bounds.add(match[1]);
    }
    return [...bounds];
}

function normalize(area, phase) {
    const audit = readJson(`security/dependency-audit/phase06-${phase}.${area}.json`);
    const packages = lockPackages(area, phase);
    return Object.entries(audit.vulnerabilities ?? {}).map(
        ([name, vulnerability]) => {
            const nodePath = vulnerability.nodes?.[0] ?? `node_modules/${name}`;
            const advisories = advisoryDetails(vulnerability.via ?? []);
            return {
                workspace: area,
                phase,
                package: name,
                installedVersion: packages[nodePath]?.version ?? null,
                severity: vulnerability.severity,
                direct: vulnerability.isDirect,
                vulnerableRange: vulnerability.range,
                firstPatchedBounds: patchedBounds(advisories),
                fixAvailable: vulnerability.fixAvailable ?? null,
                dependencyChain: dependencyChain(packages, nodePath),
                nodes: vulnerability.nodes ?? [],
                advisories,
                review: reviewMap.packages[name] ?? reviewMap.default,
            };
        },
    );
}

const before = [
    ...normalize("server", "before"),
    ...normalize("client", "before"),
];
const after = [
    ...normalize("server", "after"),
    ...normalize("client", "after"),
];
const afterByKey = new Map(
    after.map((entry) => [`${entry.workspace}:${entry.package}`, entry]),
);

const inventory = before.map((entry) => {
    const resolved = afterByKey.get(`${entry.workspace}:${entry.package}`);
    return {
        ...entry,
        finalStatus: resolved
            ? {
                  state: "remaining",
                  severity: resolved.severity,
                  vulnerableRange: resolved.vulnerableRange,
              }
            : { state: "resolved" },
    };
});

const output = {
    generatedBy: "scripts/generate-dependency-inventory.mjs",
    source: "npm audit --json captures in security/dependency-audit/",
    generatedAt: new Date().toISOString(),
    counts: {
        before: before.reduce(
            (acc, entry) => {
                acc[entry.severity] = (acc[entry.severity] ?? 0) + 1;
                return acc;
            },
            {},
        ),
        after: after.reduce(
            (acc, entry) => {
                acc[entry.severity] = (acc[entry.severity] ?? 0) + 1;
                return acc;
            },
            {},
        ),
    },
    advisories: inventory,
};

writeFileSync(
    resolve(auditDir, "inventory.json"),
    JSON.stringify(output, null, 2) + "\n",
);
console.log(
    `Wrote ${inventory.length} inventory entries (before) / ${after.length} (after).`,
);
