# Contributing to Kairos

We welcome contributions! This document outlines our contributor workflow, coding standards, and expectations.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Strategy](#branch-strategy)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Checklist](#pull-request-checklist)
- [PR Review Process](#pr-review-process)

## Code of Conduct

All contributors must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/kairos.git`
3. Set up the development environment:

```bash
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt  # dev dependencies
```

4. Run the tests to verify your setup:

```bash
pytest tests/ -q
```

## Development Workflow

1. **Pick an issue** — Look for issues tagged `good-first-issue` or `help-wanted`
2. **Discuss** — Comment on the issue to let others know you're working on it
3. **Create a branch** — See branch strategy below
4. **Make changes** — Follow coding standards
5. **Write tests** — All new code must have tests
6. **Run tests** — Ensure all tests pass
7. **Submit a PR** — Follow the PR checklist

## Branch Strategy

| Branch | Purpose | Base Branch |
|--------|---------|-------------|
| `main` | Production-ready code | — |
| `develop` | Integration branch | `main` |
| `feature/*` | New features | `develop` |
| `fix/*` | Bug fixes | `develop` |
| `docs/*` | Documentation | `develop` |
| `release/*` | Release preparation | `main` |

Branch naming convention: `<type>/<short-description>`

Examples:
- `feature/adaptive-planner`
- `fix/confidence-calibration`
- `docs/api-docs-update`

## Coding Standards

### Python

- **Python 3.11+** required
- **Type hints** required for all function signatures
- **Docstrings** — Google-style docstrings for public APIs
- **Line length** — max 100 characters
- **Linting** — `ruff` configuration in `pyproject.toml`
- **Formatting** — `ruff format` before committing
- **Imports** — `isort` compatible (stdlib → third-party → local)

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class Example:
    name: str
    value: float = 0.0
```

### Go

- **Go 1.26+** required
- Standard Go formatting (`gofmt`)
- Follow [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)

## Testing Requirements

- **All new code must have tests** — aim for ≥ 80% coverage on new code
- **Existing tests must not break** — zero regressions required
- **Test naming** — `test_<functionality>_<scenario>` in `test_<module>.py`
- **Run full suite** before submitting:

```bash
pytest tests/ -q --tb=short
```

## Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows coding standards
- [ ] Type hints are complete
- [ ] Tests are written and passing
- [ ] No regressions — full test suite passes
- [ ] Documentation is updated (if applicable)
- [ ] CHANGELOG is updated (if applicable)
- [ ] Branch is up to date with target branch
- [ ] PR description explains the change and motivation
- [ ] Related issues are linked

## PR Review Process

1. **Automated checks** — CI runs lint, type check, and tests
2. **Human review** — At least one maintainer reviews
3. **Address feedback** — Make requested changes or explain why not
4. **Merge** — Maintainer merges when all checks pass

### What reviewers look for

- Correctness
- Test coverage
- Code clarity and maintainability
- Performance considerations
- Security implications

---

*Thank you for contributing to Kairos!*
