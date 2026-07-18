# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within Kairos, please report it responsibly.

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to security@kairos.dev.

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Advisories

We will publish security advisories for confirmed vulnerabilities. Please watch this repository for security updates.

## Security Measures

Kairos implements the following security measures:

### Authentication & Authorization
- Shared secret authentication via `X-Secret` header
- Constant-time comparison to prevent timing attacks
- Namespace-based access isolation

### Input Validation
- Magic-byte MIME detection (not trusting client Content-Type headers)
- PDF bomb detection (>10,000 pages rejected)
- Path traversal prevention in filename sanitization
- File size limits (configurable, default 50MB)
- Content-Type whitelist (PDF + plain text only)

### Network Security
- Rate limiting per namespace with burst support
- CORS configuration (environment-driven, not wildcard by default)
- HTTP security headers (CSP, HSTS, Permissions-Policy)
- Error message sanitization (no information leakage)

### Data Security
- All secrets via environment variables (never hardcoded)
- No credentials in Docker images
- Prometheus metrics endpoint requires no authentication (internal only)

### Infrastructure
- Multi-stage Docker builds (no build tools in runtime images)
- Distroless runtime for Go gateway
- Resource limits on all services
- Health checks on all services

## Best Practices

When deploying Kairos, please ensure:

- Use environment variables for all secrets and API keys
- Enable HTTPS in production (use a reverse proxy like nginx or Caddy)
- Keep dependencies up to date
- Follow the principle of least privilege for database access
- Use strong, unique values for `KAIROS_SECRET`
- Enable rate limiting in production
- Monitor Prometheus metrics for anomalies
