# Kairos Security Documentation

## Threat Model

Kairos is a public-facing RAG research workbench. The threat model assumes:
- **Public deployment** with user registration
- **Multi-tenant data isolation** via organization membership
- **AI-powered features** that process user documents and queries
- **File upload capabilities** for document ingestion

### Trust Boundaries
1. **Client ↔ Server**: All requests go through Next.js middleware and API routes
2. **Server ↔ Database**: Prisma ORM with parameterized queries
3. **Server ↔ External APIs**: OpenAI, Gemini, Cloudinary (server-side only)
4. **User ↔ User**: Strict ownership verification on all data access

---

## Authentication

### BetterAuth Configuration
- **Session duration**: 7 days with 24-hour refresh interval
- **Cookie settings**: HttpOnly, Secure (production), SameSite=Lax
- **Cookie prefix**: `kairos_` to avoid conflicts
- **Session caching**: Enabled with 7-day max age

### Session Management
- Sessions are validated on every request via `getServerSession()`
- Failed validation redirects to `/login`
- Session tokens are never exposed to client-side JavaScript
- GitHub OAuth supported as optional social login

### Password Policy
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- Passwords are hashed by BetterAuth (bcrypt)

---

## Authorization

### Data Access Model
Every data access operation follows the organization membership model:

```
User → Member (org) → Project → Resource (KB/Document/Experiment)
```

### Ownership Verification
All server actions and API routes verify:
1. **Authentication**: User must have a valid session
2. **Organization membership**: User must be a member of the resource's organization
3. **Resource existence**: Resource must exist and belong to the user's organization

### API Route Protection
- `/app/*` routes: Protected by middleware (session cookie check)
- `/api/*` routes: Protected by `getServerSession()` in each handler
- Public routes: `/`, `/login`, `/signup`, `/features`, `/pricing`, etc.

---

## Rate Limiting

### Per-Endpoint Policies
| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| Authentication | 15 min | 10 |
| Login | 15 min | 5 |
| Signup | 60 min | 3 |
| Password Reset | 60 min | 3 |
| Chat | 60 sec | 30 |
| Copilot | 60 sec | 20 |
| Upload | 60 sec | 10 |
| Evaluation | 60 sec | 15 |
| Research | 60 sec | 20 |
| General API | 60 sec | 60 |

### Implementation
- In-memory sliding window rate limiter
- Per-user identification via session
- `X-RateLimit-*` headers in responses
- `Retry-After` header on 429 responses

---

## File Upload Security

### Validation Chain
1. **Extension check**: Only `pdf`, `txt`, `md`, `csv`, `docx` allowed
2. **MIME type validation**: Strict MIME type checking
3. **File size limits**: Maximum 10MB per file
4. **Empty file rejection**: Zero-byte files rejected
5. **Duplicate detection**: SHA-256 content hash checked against existing files
6. **Filename sanitization**: Special characters stripped, max 255 chars
7. **Storage isolation**: Files stored in `kbId/timestamp-name` paths

### Storage
- Cloudinary for production (raw upload mode)
- Files never stored in executable paths
- Storage keys are non-guessable (`kbId/timestamp-safename`)

---

## Input Validation

### Server Actions
All server actions validate:
- **Type checking**: Every parameter type-verified
- **Length limits**: Names (255), descriptions (1000), queries (10000)
- **UUID format**: All IDs validated against UUID regex
- **Enum values**: Configurations validated against allowed values
- **Required fields**: Missing fields rejected with clear messages

### API Routes
- JSON body parsing with error handling
- URL parameter validation (UUID format)
- Query string parameter validation
- Request body size limits

---

## Error Handling

### Client-Facing Errors
- Generic error messages only (no stack traces, SQL errors, or internal details)
- Unique error IDs for correlation: `err_{timestamp}_{random}`
- Structured JSON error responses

### Server-Side Logging
- Full error details logged with context
- Stack traces captured (top 5 frames)
- Correlation IDs for request tracing

---

## Security Headers

### HTTP Headers (All Routes)
| Header | Value |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| X-XSS-Protection | 1; mode=block |
| Permissions-Policy | camera=(), microphone=(), ... |
| X-Powered-By | Removed |

### Production-Only Headers
| Header | Value |
|--------|-------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| Content-Security-Policy | default-src 'self'; script-src 'self' ... |

---

## Secrets Management

### Environment Variables
- All secrets loaded from environment variables
- `.env` files gitignored (all variants)
- `.env.example` contains placeholders only
- `NEXT_PUBLIC_*` variables audited for public exposure

### Secret Categories
| Category | Variables | Exposure |
|----------|-----------|----------|
| Database | DATABASE_URL, DIRECT_URL | Server only |
| Auth | BETTER_AUTH_SECRET | Server only |
| Storage | CLOUDINARY_* | Server only |
| OAuth | GITHUB_CLIENT_* | Server only |
| AI | OPENAI_API_KEY, GEMINI_API_KEY | Server only |
| Analytics | NEXT_PUBLIC_POSTHOG_KEY | Client OK |
| Auth URL | NEXT_PUBLIC_BETTER_AUTH_URL | Client OK |

### Rotation Policy
- Database credentials: Rotate quarterly
- Auth secrets: Rotate on compromise
- API keys: Rotate monthly for production
- OAuth secrets: Rotate on team member departure

---

## Dependency Management

### Audit Process
- `npm audit` run for JavaScript dependencies
- `pip-audit` run for Python dependencies
- Critical/High vulnerabilities addressed immediately
- Medium/Low vulnerabilities addressed before release

### Supply Chain Security
- Dependencies pinned to specific versions in lock files
- Only trusted registries (npm, PyPI)
- No post-install scripts from untrusted packages

---

## Logging & Monitoring

### Structured Logging
All logs are JSON-formatted with:
- ISO 8601 timestamps
- Log level (debug, info, warn, error)
- Context (module/action name)
- Correlation IDs for request tracing

### Log Redaction
Automatically redacts:
- Email addresses
- JWT tokens
- Database connection strings
- API keys and secrets
- Passwords and tokens

### Audit Logging
- Document uploads/deletions tracked
- Authentication events logged
- Data access patterns monitored

---

## Responsible Disclosure

### Reporting Vulnerabilities
1. **Email**: security@kairos.dev (preferred)
2. **GitHub**: Private vulnerability report
3. **Response time**: Within 48 hours

### Scope
- Authentication bypass
- Authorization bypass
- Data exposure
- Remote code execution
- SQL injection
- Cross-site scripting (XSS)
- Server-side request forgery (SSRF)

### Rewards
- Credit in SECURITY.md
- Responsible disclosure badge
- No bounties at this time

---

## Compliance Considerations

### Data Protection
- User data isolated by organization
- No cross-tenant data access
- File storage encrypted at rest (Cloudinary)
- Database encrypted at rest (Supabase/RDS)

### AI Safety
- Prompts sanitized before LLM calls
- Retrieved context validated
- No PII in AI training data
- User consent for document processing

---

## Security Checklist

- [ ] All secrets in environment variables
- [ ] No hardcoded credentials in source
- [ ] `.env` files gitignored
- [ ] Authentication on all protected routes
- [ ] Authorization verified on all data access
- [ ] Input validation on all endpoints
- [ ] Rate limiting on all public endpoints
- [ ] File upload validation complete
- [ ] Error messages sanitized
- [ ] Security headers configured
- [ ] CSP enabled in production
- [ ] HSTS enabled in production
- [ ] Dependency audit clean
- [ ] Log redaction active
- [ ] No stack traces to client
