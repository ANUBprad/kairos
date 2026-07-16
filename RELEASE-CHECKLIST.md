# Release Checklist

## Pre-Release

- [ ] All tests passing (`pytest tests -x -q`)
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)
- [ ] Prisma schema valid (`npx prisma validate`)
- [ ] Python lint clean (`ruff check`)
- [ ] No TODO/FIXME in new code
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped

## Release

- [ ] Git tag created
- [ ] GitHub Release published
- [ ] Docker images built and pushed
- [ ] PyPI package published (if applicable)
- [ ] npm package published (if applicable)

## Post-Release

- [ ] Deployment verified
- [ ] Smoke tests passing
- [ ] Monitoring alerts checked
- [ ] Announcement drafted
- [ ] Blog post scheduled (if major release)
