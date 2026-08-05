# Kairos Extensibility Report

## Executive Summary

This report outlines the extensibility framework for Kairos, enabling external developers to build integrations, providers, evaluators, dashboards, and workflows without modifying the core platform. The framework introduces a plugin system, event bus, webhooks, versioned public REST API, SDKs, CLI, and a foundation for an extension marketplace.

The design adheres to the existing architecture, extending it with well-defined extension points while maintaining backward compatibility.

---

## Architecture Overview

Kairos consists of three main layers:

1. **Gateway (Go)**: API gateway handling HTTP/WebSocket requests, authentication, rate limiting, and routing to the intelligence service.
2. **Intelligence Service (Python)**: Core AI orchestration service handling ingestion, retrieval, reranking, LLM interaction, and telemetry via gRPC.
3. **Portal (Next.js)**: User-facing web application for configuration, monitoring, and interaction.

The extensibility framework focuses on extending the Intelligence Service and exposing functionality via the Gateway and Portal.

---

## Plugin Framework

### Plugin Types

Kairos supports the following plugin types:

1. **Provider Plugins**: Alternative LLM providers (e.g., Anthropic, Cohere) or embedding providers.
2. **Embedder Plugins**: Custom embedding models (local, API-based).
3. **Retriever Plugins**: Custom retrieval algorithms (vector, hybrid, graph-based).
4. **Reranker Plugins**: Custom reranking models (cross-encoder, LLM-based rerankers).
5. **Evaluator Plugins**: Custom evaluation metrics for retrieval, generation, or end-to-end tasks.
6. **Exporter Plugins**: Export data to external systems (data lakes, BI tools).
7. **Notifier Plugins**: Send notifications via email, Slack, webhooks, etc.
8. **Auth Plugins**: Custom authentication mechanisms (OAuth, SAML, LDAP).
9. **Storage Plugins**: Alternative storage backends (PostgreSQL, MongoDB, custom vector stores).

### Plugin Manifest

Each plugin must include a `kairos-plugin.yaml` manifest in its root:

```yaml
name: my-plugin
version: 1.0.0
description: "My custom embedding provider"
author: "My Company"
kairos_version: ">=1.1.0 <2.0.0"
entrypoint: my_plugin.plugin:MyEmbedder
plugin_type: embedder
dependencies:
  - name: numpy
    version: ">=1.24.0"
permissions:
  - network
  - storage
```

### Plugin Lifecycle

1. **Install**: Plugin package is copied to the plugins directory.
2. **Enable**: Plugin is loaded and registered with the plugin registry.
3. **Disable**: Plugin is unloaded and unregistered.
4. **Update**: Plugin is replaced with a new version.
5. **Remove**: Plugin is deleted from the plugins directory.
6. **Health**: Plugin reports health status via a standard interface.
7. **Version**: Plugin reports its version for compatibility checks.

### Plugin Registry

The plugin registry is responsible for:
- Discovering plugins in the `plugins/` directory.
- Loading plugin manifests and validating dependencies.
- Instantiating plugin objects based on their entrypoint.
- Providing plugin instances to the core system upon request.
- Managing plugin lifecycle (enable/disable/update/remove).

### Integration with Core

The Intelligence Service's `serve()` function is extended to:
- Load enabled plugins from the registry.
- Allow plugins to override or extend core components (e.g., replace the default embedder with a plugin embedder).
- Provide extension points for event publishing and subscription.

---

## Event Bus

### Event Schema

All events follow a standardized schema:

```json
{
  "event_id": "uuid",
  "event_type": "trace.created",
  "timestamp": "ISO 8601 timestamp",
  "version": "1.0",
  "organization_id": "org_id",
  "project_id": "project_id",
  "correlation_id": "correlation_id",
  "payload": {
    // event-specific data
  }
}
```

### Built-in Events

- `trace.created`
- `trace.completed`
- `evaluation.finished`
- `prompt.updated`
- `experiment.finished`
- `incident.created`
- `alert.fired`
- `provider.failed`
- `dataset.updated`

### Event Publishing

Components within the core can publish events using a global event publisher.

### Event Subscribers

Plugins can subscribe to events by implementing an event handler interface and registering with the event bus.

### Implementation

The event bus is implemented as an in-memory publish-subscribe system with support for asynchronous handlers. For production, it can be backed by a message broker (e.g., Redis Pub/Sub, Apache Kafka) via a plugin.

---

## Webhooks

### Webhook Management

Users can configure webhooks via the Portal or API to receive events.

Each webhook configuration includes:
- URL: The endpoint to send events to.
- Events: List of event types to subscribe to.
- Secret: Used for signing requests (HMAC-SHA256).
- Retry Policy: Exponential backoff with configurable max attempts.
- Enabled: Boolean to enable/disable the webhook.

### Delivery Guarantees

- Webhook delivery is attempted with retries on failure.
- Failed deliveries are logged and can be replayed.
- Delivery logs include status codes, response bodies, and timestamps.

### Security

- Webhook signatures are verified using the shared secret.
- Only HTTPS endpoints are allowed in production.
- Rate limiting can be applied per webhook to prevent abuse.

---

## Public REST API

### Versioning

The API is versioned using the URL path: `/api/v1/resource`.

### Authentication

- API keys (Bearer token) or OAuth2 tokens.
- API keys are managed via the API or CLI.

### Resources

The API exposes the following resources:

- **Organizations**: Create, list, get, update, delete.
- **Projects**: CRUD operations within an organization.
- **Prompts**: Manage prompt templates and versions.
- **Datasets**: Upload, manage, and version datasets.
- **Experiments**: Run and manage experiments.
- **Evaluations**: Retrieve evaluation results.
- **Observability**: Metrics, logs, traces.
- **Incidents**: Create, list, update incidents.
- **Alerts**: Manage alert policies and notifications.
- **Providers**: Configure and manage AI providers.
- **API Keys**: Create and manage API keys.

### Features

- **Pagination**: Cursor-based pagination for list endpoints.
- **Filtering**: Query parameters for filtering results.
- **Sorting**: Sort by fields (e.g., `created_at`, `name`).
- **Expansion**: Expand related resources via `expand` parameter.
- **OpenAPI Documentation**: Interactive API docs available at `/docs`.

### Example Endpoints

```
GET   /api/v1/organizations
POST  /api/v1/organizations
GET   /api/v1/organizations/{org_id}
PATCH /api/v1/organizations/{org_id}
DELETE /api/v1/organizations/{org_id}

GET   /api/v1/projects?organization_id={org_id}
POST  /api/v1/projects
...
```

---

## SDKs

### Supported Languages

- Python
- TypeScript/JavaScript
- Go

### Common Abstractions

All SDKs provide:

- **Authentication**: Automatic token refresh and API key handling.
- **Pagination**: Iterator-based pagination for list operations.
- **Error Handling**: Unified error types with retryable/non-retryable distinctions.
- **Logging**: Optional logging integration.
- **Typed Models**: Strongly typed request/response models.

### Example Usage (Python)

```python
from kairos import KairosClient

client = KairosClient(api_key="sk-...")

# List projects
projects = client.projects.list(organization_id="org_123")

# Create an experiment
experiment = client.experiments.create(
    project_id="proj_456",
    name="My Experiment",
    config={...}
)
```

### SDK Generation

SDKs are generated from the OpenAPI specification using automated tools (e.g., OpenAPI Generator) and manually refined for idiomatic usage.

---

## CLI

### Commands

The `kairos` CLI provides command-line access to the platform:

- `kairos login`: Authenticate and store credentials.
- `kairos logout`: Clear stored credentials.
- `kairos prompts`: Manage prompt templates.
- `kairos evaluate`: Run evaluations on datasets.
- `kairos traces`: Retrieve and analyze traces.
- `kairos incidents`: Manage incidents.
- `kairos alerts`: Configure alert policies.
- `kairos deploy`: Deploy configurations to Kairos.
- `kairos providers`: Manage AI providers.
- `kairos datasets`: Upload and manage datasets.
- `kairos experiments`: Create and run experiments.

### Example

```bash
kairos login --api-key sk-...
kairos datasets upload --file data.csv --name my-dataset
kairos experiments create --dataset my-dataset --prompt-template "summarize: {{text}}"
```

### Extensibility

The CLI supports plugins via command hooks, allowing third-party commands to be installed.

---

## Extension Marketplace (Foundation)

### Plugin Catalog

A curated list of plugins discoverable via the Portal or CLI.

### Categories

Plugins are categorized by type (e.g., Embedder, Retriever) and function (e.g., Embedding, Retrieval).

### Ratings and Reviews

Users can rate and review plugins based on their experience.

### Version Compatibility

The marketplace enforces version compatibility between plugins and the Kairos platform.

### Digital Signatures

Plugins can be signed by trusted publishers to ensure integrity and authenticity.

### Installation Workflow

1. Browse or search for a plugin in the Portal.
2. Review details, permissions, and reviews.
3. Click "Install" to download and install the plugin.
4. The plugin is automatically enabled and ready for use.

### Future Work

- Public marketplace hosting.
- Automated vulnerability scanning.
- Plugin sandboxing for security.

---

## Developer Portal

### Documentation Site

A comprehensive documentation site hosted at `docs.kairos.io` (or similar) includes:

- **API Explorer**: Interactive tool to test API endpoints.
- **SDK Docs**: Guides and reference for each SDK.
- **Plugin Guide**: How to develop, test, and publish plugins.
- **Webhook Guide**: How to consume and secure webhooks.
- **Examples**: Code snippets and tutorials for common tasks.
- **Quickstart**: Getting started guide for new developers.

### Access

The developer portal is accessible via the main Kairos portal or directly at the docs subdomain.

---

## Versioning

### API Versioning

- Backward-compatible changes are released as minor versions (e.g., v1.1 → v1.2).
- Breaking changes require a new major version (e.g., v1.x → v2.0).
- Deprecated endpoints are marked in the API and removed after two minor versions.

### Plugin Compatibility

- Plugins declare a compatible Kairos version range in their manifest.
- The platform checks compatibility upon plugin load.
- Plugins targeting older versions may be loaded with a compatibility shim (if provided).

### Migration Guides

For major version upgrades, migration guides are provided to assist developers in updating their plugins and integrations.

---

## Security Model

### Plugin Sandbox

Plugins run in the same process as the core but are restricted via:

- **Permission System**: Plugins must declare required permissions (e.g., network, file access).
- **Capability Restrictions**: Certain dangerous operations (e.g., arbitrary code execution) are prohibited.
- **Future Sandboxing**: Consideration for running plugins in isolated processes or WebAssembly modules.

### Permission Model

Plugins specify permissions in their manifest. The platform grants or denies permissions based on admin configuration.

### Rate Limiting

- Plugin API calls are subject to the same rate limits as core APIs.
- Individual plugins can have custom rate limits to prevent abuse.

### Secret Isolation

- Plugin secrets (e.g., API keys) are stored encrypted in the platform's secret manager.
- Plugins access secrets via a secure interface that prevents leakage.

### Audit Logs

All plugin lifecycle events (install, enable, disable, update, remove) are logged for auditing.

### Signature Verification

Plugin packages can be signed with a private key; the platform verifies the signature before installation.

---

## Validation and Testing

### TypeScript

- TypeScript code is validated via `tsc` and ESLint.
- Unit tests are written with Jest.

### Prisma

- Prisma schema is validated via `prisma validate`.
- Migration scripts are tested in CI.

### Go

- Go code is vetted with `go vet` and tested with `go test`.

### Python

- Python code is linted with Ruff and tested with pytest.

### API Tests

- End-to-end tests validate API contracts using tools like Postman or Newman.
- Contract testing ensures backward compatibility.

### SDK Tests

- SDKs are tested against a mock server to ensure correct behavior.

### CLI Tests

- CLI commands are tested with automated end-to-end tests.

### Continuous Integration

All validation and testing are integrated into CI pipelines to ensure quality.

---

## Future Roadmap

### Phase 11A: Plugin Framework (Current)
- Implement plugin registry and lifecycle management.
- Define core plugin interfaces.
- Enable plugin loading in the Intelligence Service.

### Phase 11B: Event Bus
- Implement in-memory event bus.
- Define built-in events.
- Add event publishing points in core components.

### Phase 11C: Webhooks
- Build webhook management UI and API.
- Implement delivery retry and logging.
- Add signature verification.

### Phase 11D: Public REST API
- Design and implement versioned API endpoints.
- Add authentication and rate limiting.
- Generate OpenAPI documentation.

### Phase 11E: SDKs
- Generate SDKs from OpenAPI spec.
- Provide idiomatic wrappers for each language.
- Publish SDKs to package registries (PyPI, npm, Go modules).

### Phase 11F: CLI
- Develop core CLI commands.
- Add plugin support for custom commands.
- Publish CLI to package managers (e.g., Homebrew, Scoop).

### Phase 11G: Extension Marketplace
- Build marketplace UI in the Portal.
- Implement plugin installation and update flows.
- Add rating and review system.

### Phase 11H: Developer Portal
- Launch documentation site.
- Create interactive API explorer.
- Publish guides and tutorials.

### Phase 11I: Versioning
- Implement API versioning middleware.
- Add deprecation warnings.
- Provide migration guides.

### Phase 11J: Security
- Implement plugin permission system.
- Add secret management for plugins.
- Implement audit logging.
- Explore sandboxing options.

---

## Conclusion

The extensibility framework transforms Kairos from a monolithic AI platform into an extensible ecosystem where developers can tailor the platform to their specific needs. By providing clear extension points, robust tooling, and a pathway to distribution, Kairos empowers the community to innovate while maintaining a stable and secure core.

This report serves as the foundation for the implementation phases that follow.