#!/usr/bin/env node
/**
 * Guardrail for the staging-only Render blueprint.
 *
 * This check is intentionally dependency-free so it can run in CI with only
 * Node installed. It does not parse arbitrary YAML; it validates the small,
 * constrained structure used by render.staging.yaml. Its purpose is to make
 * "accidentally deploy production from the staging blueprint" impossible to
 * merge silently.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.argv[2] ?? "render.staging.yaml");
const text = readFileSync(file, "utf8");
const lines = text.split(/\r?\n/);

const failures = [];
function check(condition, message) {
    if (!condition) failures.push(message);
}

const serviceHeaders = [];
lines.forEach((line, index) => {
    const match = /^  - type:\s*(\S+)\s*$/.exec(line);
    if (match) serviceHeaders.push({ type: match[1], index });
});

const services = serviceHeaders.map((header, position) => {
    const end = position + 1 < serviceHeaders.length
        ? serviceHeaders[position + 1].index
        : lines.length;
    const body = lines.slice(header.index, end);
    const nameMatch = body.map((line) => /^    name:\s*(\S+)\s*$/.exec(line)).find(Boolean);
    const envKeys = new Map();
    for (let i = 0; i < body.length; i += 1) {
        const keyMatch = /^      - key:\s*(\S+)\s*$/.exec(body[i]);
        if (!keyMatch) continue;
        const key = keyMatch[1];
        // A key is either `sync: false` or has an explicit `value:` line.
        const settings = body.slice(i + 1, i + 4).join("\n");
        envKeys.set(key, {
            syncFalse: /sync:\s*false/.test(settings),
            explicitValue: /^        value:/m.test(settings),
            settings,
        });
    }
    return { type: header.type, name: nameMatch?.[1] ?? null, envKeys, body };
});

const names = services.map((service) => service.name).sort();
check(
    JSON.stringify(names) === JSON.stringify(["kairos-client-staging", "kairos-server-staging"]),
    `expected exactly the two staging services, found ${JSON.stringify(names)}`,
);
check(!text.includes("openbook-server"), "production service name found in staging blueprint");
check(
    !/DEPLOYMENT_ENV\s*\n\s*-?\s*value:\s*production/m.test(text),
    "DEPLOYMENT_ENV=production found in staging blueprint",
);
for (const service of services) {
    check(service.type === "web", `${service.name}: expected type web`);
    for (const [key, setting] of service.envKeys) {
        if (setting.explicitValue && !["NODE_ENV", "DEPLOYMENT_ENV"].includes(key)) {
            check(
                false,
                `${service.name}: ${key} has an inline value instead of sync: false`,
            );
        }
    }
}

const backend = services.find((service) => service.name === "kairos-server-staging");
if (backend) {
    const mustSync = [
        "DATABASE_URL", "CLIENT_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL",
        "OAUTH_STATE_SECRET", "OPENAI_API_KEY", "PINECONE_API_KEY",
        "PINECONE_INDEX", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET", "CLOUDINARY_UPLOAD_PRESET", "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "SERVER_URL",
        "STAGING_DATABASE_ID", "STAGING_RESOURCE_PREFIX", "TRUST_PROXY",
    ];
    for (const key of mustSync) {
        check(backend.envKeys.get(key)?.syncFalse === true, `backend: ${key} must be sync: false`);
    }
    check(backend.envKeys.get("NODE_ENV")?.settings.includes("value: production"), "backend: NODE_ENV must be production");
    check(backend.envKeys.get("DEPLOYMENT_ENV")?.settings.includes("value: staging"), "backend: DEPLOYMENT_ENV must be staging");
    check(backend.body.some((line) => line.trim() === "healthCheckPath: /healthz"), "backend: health check must be /healthz");
}

const frontend = services.find((service) => service.name === "kairos-client-staging");
if (frontend) {
    for (const key of ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_BETTER_AUTH_URL", "BACKEND_INTERNAL_URL"]) {
        check(frontend.envKeys.get(key)?.syncFalse === true, `frontend: ${key} must be sync: false`);
    }
    check(frontend.envKeys.get("DEPLOYMENT_ENV")?.settings.includes("value: staging"), "frontend: DEPLOYMENT_ENV must be staging");
}

const secretPattern = /(sk-[A-Za-z0-9]{20,}|rzp_live_[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{30,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY)/;
check(!secretPattern.test(text), "blueprint contains a high-confidence secret pattern");

if (failures.length > 0) {
    console.error("STAGING BLUEPRINT GUARD: FAIL");
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
}
console.log(`STAGING BLUEPRINT GUARD: PASS (${services.length} staging services, no production service)`);
