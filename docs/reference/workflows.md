# GitHub workflows

Workflow files live in:

```text
.github/workflows/
```

## Trigger matrix

```mermaid
flowchart LR
    pr["pull_request"]
    push["push to master"]
    dispatch["workflow_dispatch"]

    ci["ci.yml"]
    preview["deploy-preview.yml"]
    prod["deploy-production.yml"]
    docs["deploy-docs.yml"]

    pr --> ci
    pr --> preview
    pr --> docs
    push --> ci
    push --> prod
    push --> docs
    dispatch --> prod
    dispatch --> docs
```

## CI

File:

```text
.github/workflows/ci.yml
```

Runs on:

- pull requests
- pushes to `master`

Main checks:

```bash
npm ci
npm run content:validate
npm run content:build
npm run lint
npx next build
```

## Vercel preview deployment

File:

```text
.github/workflows/deploy-preview.yml
```

Runs on pull requests from the same repository.

Skipped for forked PRs because secrets are unavailable.

Requires:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## Vercel production deployment

File:

```text
.github/workflows/deploy-production.yml
```

Runs on:

- pushes to `master`
- manual dispatch

Uses the production Vercel environment.

## Docs deployment

File:

```text
.github/workflows/deploy-docs.yml
```

Runs on:

- pushes to `master` that affect docs
- manual dispatch
- pull requests for build validation

```mermaid
flowchart TD
    build["build job<br/>mkdocs build --strict"]
    gate{"github.event_name != pull_request"}
    artifact["upload-pages-artifact"]
    deployJob["deploy job<br/>github-pages environment"]
    site["https://mc-marcocheng.github.io/ml-concepts/"]

    build --> gate
    gate -->|false| done["Validation only"]
    gate -->|true| artifact
    artifact --> deployJob
    deployJob --> site
```

Deploys with GitHub Pages using official Pages actions.

Docs dependencies are pinned in:

```text
docs/requirements.txt
```
