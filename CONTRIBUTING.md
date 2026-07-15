# Contributing to Kairos

Kairos is a solo-maintained open-source project. Contributions are welcome.

## Getting Started

```bash
git clone https://github.com/ANUBprad/kairos.git
cd kairos/apps/portal
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

## Coding Standards

### Python
- Type hints on all functions
- `ruff format` and `ruff check` before committing
- `pytest` for tests

### TypeScript
- Next.js conventions, strict mode, functional components
- `npm run lint` and `npx tsc --noEmit` before committing

## Reporting Issues

Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## Pull Requests

1. Fork the repo
2. Create a branch from `main`
3. Make your changes
4. Run linters and tests
5. Open a PR against `main`

Keep PRs focused on a single change.
