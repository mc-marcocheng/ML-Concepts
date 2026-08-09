# Deployment

The repository has separate deployment paths for:

- the Next.js app on Vercel
- the MkDocs documentation on GitHub Pages

## Pipeline overview

```mermaid
flowchart TD
    pr["Pull request"]
    push["Push to master"]
    dispatch["workflow_dispatch"]

    ci["ci.yml"]
    preview["deploy-preview.yml"]
    prod["deploy-production.yml"]
    docs["deploy-docs.yml"]

    previewUrl["Vercel preview URL"]
    prodUrl["Vercel production"]
    pages["GitHub Pages"]
    buildOnly["Docs build validation only"]

    pr --> ci
    pr --> preview
    pr --> docs
    push --> ci
    push --> prod
    push --> docs
    dispatch --> prod
    dispatch --> docs

    preview --> previewUrl
    prod --> prodUrl
    docs -->|push or dispatch| pages
    docs -->|pull request| buildOnly
```

## App deployment

App deployment workflows:

```text
.github/workflows/deploy-preview.yml
.github/workflows/deploy-production.yml
```

### Preview deployments

Preview deployments run on pull requests from the same repository.

Forked pull requests are skipped because GitHub does not expose repository secrets to forks.

```mermaid
flowchart TD
    open["Pull request opened"]
    fork{"From a fork?"}
    skip["Job skipped"]
    secrets["Read Vercel secrets"]
    pull["vercel pull"]
    build["vercel build"]
    deploy["vercel deploy --prebuilt"]
    url["Preview URL"]

    open --> fork
    fork -->|yes| skip
    fork -->|no| secrets
    secrets --> pull
    pull --> build
    build --> deploy
    deploy --> url
```

Required secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

### Production deployments

Production deployments run on:

- pushes to `master`
- manual `workflow_dispatch`

The production workflow uses:

```bash
vercel pull --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

## CI

The CI workflow is:

```text
.github/workflows/ci.yml
```

```mermaid
flowchart LR
    checkout["checkout"] --> node["Node setup"]
    node --> ci["npm ci"]
    ci --> validate["npm run content:validate"]
    validate --> content["npm run content:build"]
    content --> lint["npm run lint"]
    lint --> build["npx next build"]
    build --> assert["Output assertions"]
```

## Documentation deployment

Docs are built with MkDocs Material and deployed through GitHub Pages.

Workflow:

```text
.github/workflows/deploy-docs.yml
```

```mermaid
flowchart TD
    trigger["docs/** or mkdocs.yml change"]
    setup["Set up Python 3.12"]
    deps["pip install -r docs/requirements.txt"]
    build["mkdocs build --strict"]
    event{"Pull request?"}
    stop["Stop after build validation"]
    artifact["upload-pages-artifact"]
    configure["configure-pages"]
    deploy["deploy-pages"]
    live["GitHub Pages site"]

    trigger --> setup
    setup --> deps
    deps --> build
    build --> event
    event -->|yes| stop
    event -->|no| artifact
    artifact --> configure
    configure --> deploy
    deploy --> live
```

It runs on:

- pushes to `master` that affect docs or `mkdocs.yml`
- manual dispatch
- pull requests for build validation only

## Enable GitHub Pages

In repository settings:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

No deployment secret is required for GitHub Pages when using the official Pages actions.

## Build docs locally

```bash
python -m pip install -r docs/requirements.txt
mkdocs build --strict
```

Serve docs locally:

```bash
mkdocs serve
```

!!! warning "Strict mode is on"
    `mkdocs.yml` sets `strict: true`, and the workflow also passes `--strict`.
    Broken internal links, missing nav files, or unknown extensions fail the build.
