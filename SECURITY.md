# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.0.x   | ✅ |
| < 3.0   | ❌ |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please
report it privately **before** creating a public issue.

### How to report

1. **Do not** create a public GitHub issue
2. Email the project maintainers directly, or
3. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)

### What to include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

### Response timeline

- **48 hours**: Acknowledgment of receipt
- **7 days**: Initial assessment and plan
- **30 days**: Fix released (depending on severity)

## Security Best Practices

### API Key Management

- Use environment variables or a secrets manager for API keys
- Never commit secrets to the repository
- Rotate keys regularly

### Production Deployment

- Enable authentication on all endpoints
- Use HTTPS in production
- Apply rate limiting to prevent abuse
- Keep dependencies updated
- Run with least-privilege principle

### Reporting

Thank you for helping keep Kairos secure!
