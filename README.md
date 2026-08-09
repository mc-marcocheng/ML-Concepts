<div align="center">
  <h1>
    <img src="public/icons/icon.svg" alt="ML Concepts icon" width="40" height="40" />
    ML Concepts
  </h1>

  <p>
    A static-first learning app for revising machine-learning concepts with notes,
    quizzes, spaced review, highlights, and AI tutoring.
  </p>

  <p>
    <a href="https://ml-concepts.vercel.app/">
      <img alt="Vercel app" src="https://img.shields.io/badge/App-Vercel-black?logo=vercel" />
    </a>
    <a href="https://mc-marcocheng.github.io/ML-Concepts/">
      <img alt="Documentation" src="https://img.shields.io/badge/Docs-GitHub%20Pages-0969DA?logo=githubpages&logoColor=white" />
    </a>
  </p>
</div>

<p align="center">
  <img src="docs/assets/screenshot.png" alt="ML Concepts app screenshot" width="900" />
</p>

## Overview

ML Concepts helps learners review machine-learning topics through:

- concise MDX concept notes
- local quiz sessions
- spaced-review progress tracking
- search across concepts
- notes and highlights
- remote or on-device AI assistance

## Run locally

```bash
npm ci
npm run content:build
npm run dev
```

Open:

```text
http://localhost:3000
```

## Documentation

Full technical documentation is available in the docs site:

- [Getting started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Content authoring](docs/content-authoring.md)
- [Quiz authoring](docs/quiz-authoring.md)
- [Deployment](docs/deployment.md)

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development, content authoring, validation, and PR guidelines.
