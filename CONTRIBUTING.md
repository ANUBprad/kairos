# Contributing to Kairos

Thank you for your interest in contributing to Kairos! This document provides guidelines and instructions for contributing.

## Branch Strategy

We use a feature branch workflow with pull requests:

- The `main` branch is the stable, production-ready branch
- Create feature branches from `main` for all new work
- Use descriptive branch names: `feature/add-user-auth`, `fix/login-redirect`, `docs/update-readme`
- Keep branches focused on a single change
- Delete branches after merging

## Coding Standards

### Python
- Use type hints for all function signatures
- Follow PEP 8 style guidelines
- Format code with `ruff format`
- Run `ruff check` before committing

### TypeScript/Next.js
- Follow Next.js conventions and file structure
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use named exports over default exports

### General
- Write clear, descriptive commit messages
- Keep changes focused and minimal
- Document public functions and classes

## Testing Requirements

### Python
- Write unit tests with `pytest`
- Aim for meaningful coverage of business logic
- Place tests in `tests/` directory
- Run `pytest` before submitting PRs

### TypeScript
- Write tests with Jest
- Test component behavior, not implementation details
- Place tests alongside source files or in `__tests__/` directories
- Run `npm test` before submitting PRs

## Pull Request Checklist

Before submitting a pull request, ensure you have:

- [ ] Run the linter and fixed any issues
- [ ] Run all tests and verified they pass
- [ ] Run type checking and resolved any errors
- [ ] Updated documentation if needed
- [ ] Added tests for new functionality
- [ ] Kept commits focused and well-described
- [ ] Rebased on latest `main`

## Development Workflow

1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally
3. **Create a branch** for your feature or fix
4. **Make your changes** following the coding standards
5. **Write or update tests** to cover your changes
6. **Run the test suite** to ensure everything passes
7. **Push** your branch to your fork
8. **Open a pull request** against `main`
9. **Respond to feedback** from code reviewers
10. **Merge** once approved and all checks pass
