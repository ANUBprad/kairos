#!/usr/bin/env node

const required = [
  "DATABASE_URL",
];

const optional = [
  "BETTER_AUTH_SECRET",
  "OPENAI_API_KEY",
  "COHERE_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
];

console.log("🔍 Validating environment variables...\n");

let missing = 0;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`  ❌ Missing required: ${key}`);
    missing++;
  } else {
    console.log(`  ✅ ${key}`);
  }
}

for (const key of optional) {
  if (!process.env[key]) {
    console.log(`  ⚠️  Missing optional: ${key}`);
  } else {
    console.log(`  ✅ ${key}`);
  }
}

console.log("");

if (missing > 0) {
  console.error(`\n❌ ${missing} required variable(s) missing. Copy .env.example to .env and fill in values.`);
  process.exit(1);
} else {
  console.log("✅ All required variables present.\n");
}
