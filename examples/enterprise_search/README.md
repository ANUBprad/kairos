# Enterprise Search Example

Demonstrates Kairos as an enterprise document search platform with multi-domain support.

## Usage

```bash
cd examples/enterprise_search
pip install -r requirements.txt
python run.py
```

## What it demonstrates

- Multi-namespace document indexing
- Cross-domain search
- Namespace-isolated retrieval
- Enterprise-scale configuration

## Expected output

```
Domain: Finance
  Query: What is the current Fed rate?
  Result: The federal funds rate target is 5.25-5.50%...

Domain: Legal
  Query: What is GDPR?
  Result: The General Data Protection Regulation (GDPR) is...
```
