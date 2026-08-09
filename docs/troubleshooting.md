# Troubleshooting

## Where to start

```mermaid
flowchart TD
    problem["Something is wrong"]
    stage{"Which stage?"}
    install["Install / npm ci"]
    contentStage["Content pipeline"]
    runtime["App runtime"]
    ai["Assistant"]
    ship["Deployment"]

    problem --> stage
    stage --> install
    stage --> contentStage
    stage --> runtime
    stage --> ai
    stage --> ship

    install --> a["Check Node version and lockfile"]
    contentStage --> b["Run content:validate then content:build"]
    runtime --> c["Check public/data output"]
    ai --> d["Check provider, keys, WebGPU"]
    ship --> e["Check workflow logs and secrets"]
```

## `npm ci` fails

Check:

- Node.js version is `>=20.11.0`
- `package-lock.json` exists
- npm is not using a stale global cache

Try:

```bash
node --version
npm --version
npm ci
```

## Content validation fails

Run:

```bash
npm run content:validate
```

Common causes:

- MDX frontmatter `id` does not match file path
- missing required frontmatter field
- `difficulty` is outside `1..5`
- `summary` is too long
- quiz item is missing `prompt`
- MCQ item is missing `options` or `correctIndex`
- prereq references an unknown concept

## Content does not show up

```mermaid
flowchart TD
    missing["Concept or quiz missing in the app"]
    validate["npm run content:validate"]
    pass{"Validation passes?"}
    fix["Fix reported frontmatter or item errors"]
    build["npm run content:build"]
    concepts{"Present in public/data/concepts.json?"}
    path["Check file path and frontmatter id"]
    quizfile{"Quiz JSON generated?"}
    beside["Put {slug}.quiz.yaml beside {slug}.mdx"]
    restart["Restart npm run dev and hard reload"]

    missing --> validate
    validate --> pass
    pass -->|no| fix
    fix --> validate
    pass -->|yes| build
    build --> concepts
    concepts -->|no| path
    path --> validate
    concepts -->|yes| quizfile
    quizfile -->|no| beside
    beside --> build
    quizfile -->|yes| restart
```

## Concept does not appear

Run:

```bash
npm run content:build
```

Check that the concept appears in:

```text
public/data/concepts.json
```

Also confirm:

- file ends in `.mdx`
- file is under a category directory
- frontmatter `id` matches `<category>/<slug>`

## Quiz does not appear

Check that the quiz file is beside the MDX file:

```text
content/<category>/<slug>.quiz.yaml
```

Run:

```bash
npm run content:validate
npm run content:build
```

Check generated output:

```text
public/data/quiz/<category>__<slug>.json
```

## Search result missing

Run:

```bash
npm run content:build
```

Search chunks are generated from MDX sections and written to:

```text
public/data/search-index.json
```

Make sure the content is not hidden inside syntax that the index stripper removes.

## Assistant returns empty response

```mermaid
flowchart TD
    empty["Empty assistant response"]
    mode{"Remote or on-device?"}
    tokens["Raise max output tokens"]
    effort["Lower reasoning effort"]
    model["Try a non-reasoning model"]
    health["Run the remote health check"]
    cors["Check CORS and /chat/completions support"]
    gpu["Confirm WebGPU support"]
    weights["Confirm weights finished downloading"]
    smaller["Try a smaller model"]

    empty --> mode
    mode -->|remote| tokens
    tokens --> effort
    effort --> model
    model --> health
    health --> cors
    mode -->|on-device| gpu
    gpu --> weights
    weights --> smaller
```

Try:

- increasing max output tokens
- lowering reasoning effort
- using a non-reasoning model
- running the remote health check
- confirming the API base URL supports `/chat/completions`
- checking CORS headers if using a custom endpoint

## Remote model network error

Common causes:

- wrong base URL
- missing API key
- CORS blocked by provider
- browser offline
- endpoint does not implement OpenAI-compatible API

## On-device model fails

Check:

- browser supports WebGPU
- model weights are downloaded
- device has enough storage quota
- device has enough GPU memory
- browser is up to date

Try a smaller model.

## Docs deployment fails

Run locally:

```bash
python -m pip install -r docs/requirements.txt
mkdocs build --strict
```

Check:

- `mkdocs.yml` has valid nav paths
- all linked docs files exist
- mermaid fences use ```` ```mermaid ```` and valid syntax
- GitHub Pages source is set to GitHub Actions

## Vercel deployment fails

Check repository secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Also check the workflow logs for the failing command:

- `vercel pull`
- `vercel build`
- `vercel deploy`
