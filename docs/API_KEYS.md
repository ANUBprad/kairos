# API Keys — Kairos

## Overview

API keys allow programmatic access to Kairos features.

## Generating Keys

1. Go to Account Settings → API Keys
2. Enter a name for your key
3. Click "Generate Key"
4. Copy the key immediately — it won't be shown again

## Key Format

Keys start with `kairos_` followed by a hex string:
```
kairos_a1b2c3d4e5f6...
```

## Usage

Include the key in the `Authorization` header:
```
Authorization: Bearer kairos_a1b2c3d4e5f6...
```

## Scopes

API keys inherit the permissions of the user who created them.

## Rate Limits

Rate limits apply per API key:
- Free: No API access
- Starter: 100 requests/min
- Pro: 500 requests/min
- Team: 1,000 requests/min
- Enterprise: Custom

## Revocation

Revoke a key at any time from Account Settings → API Keys.

## Security

- Keys are hashed (SHA-256) before storage
- Only the key prefix is stored in plaintext
- Keys are shown once at creation time
- Revoked keys cannot be recovered
