<section class="docs-hero">
  <div class="docs-hero__copy">
    <p class="docs-hero__eyebrow">Machine-learning revision app</p>

    <h1>
      Learn, <span class="text-highlight">quiz</span>, and review ML concepts.
    </h1>

    <p class="docs-hero__lead">
      ML Concepts is a static-first Next.js app built from MDX notes and quiz
      YAML. Content is compiled into JSON at build time, and every learner
      record — attempts, review schedules, notes — stays in the browser.
    </p>

    <div class="docs-hero__actions">
      <a class="docs-button" href="getting-started/">
        Get started <span aria-hidden="true">→</span>
      </a>

      <a class="docs-button docs-button--secondary" href="content-authoring/">
        Author a concept
      </a>
    </div>
  </div>

  <div class="docs-hero__pipeline">
    <p class="docs-hero__pipeline-title">Content pipeline</p>

    <ol aria-label="Content pipeline">
      <li>Author MDX notes and quiz YAML</li>
      <li>Validate frontmatter and items</li>
      <li>Build search and section indexes</li>
      <li>Emit static JSON to public/data</li>
      <li>Render pages with the App Router</li>
      <li>Track progress in local storage</li>
    </ol>
  </div>
</section>

<section class="docs-section">
  <div class="docs-section__heading">
    <p class="docs-section__eyebrow">Project overview</p>
    <h2>Main components</h2>
    <p>
      The app is deliberately simple: authored source under
      <code>content/</code>, generated JSON under <code>public/data/</code>,
      a static Next.js export, and browser-local learning state.
    </p>
  </div>

  <div class="docs-card-grid">
    <article class="docs-card">
      <h3>MDX concept notes</h3>
      <p>
        Notes live in <code>content/&lt;category&gt;/&lt;slug&gt;.mdx</code> with typed
        frontmatter and custom components for TLDRs, intuitions, proofs, and
        pitfalls.
      </p>
      <span class="docs-card__label">MDX · frontmatter</span>
    </article>

    <article class="docs-card">
      <h3>Generated static data</h3>
      <p>
        Build scripts emit concept metadata, a MiniSearch index, per-concept
        section text, and normalized quiz items into <code>public/data/</code>.
      </p>
      <span class="docs-card__label">Node scripts · JSON</span>
    </article>

    <article class="docs-card">
      <h3>Quizzes and grading</h3>
      <p>
        MCQ, short, LaTeX, numeric, ordering, and code-cloze items graded
        deterministically, by LLM rubric, or by self-grade fallback.
      </p>
      <span class="docs-card__label">YAML · grading</span>
    </article>

    <article class="docs-card">
      <h3>Spaced review</h3>
      <p>
        Attempts feed an FSRS-based schedule so the review queue surfaces the
        concepts that are actually due.
      </p>
      <span class="docs-card__label">ts-fsrs · localStorage</span>
    </article>

    <article class="docs-card">
      <h3>Optional assistant</h3>
      <p>
        Remote OpenAI-compatible APIs, on-device WebLLM over WebGPU, or a
        grounded local fallback, all fed by retrieval over your notes.
      </p>
      <span class="docs-card__label">WebLLM · retrieval</span>
    </article>

    <article class="docs-card">
      <h3>Two deploy targets</h3>
      <p>
        The app ships to Vercel from GitHub Actions; this documentation is
        built with MkDocs Material and published to GitHub Pages.
      </p>
      <span class="docs-card__label">Vercel · GitHub Pages</span>
    </article>
  </div>
</section>

## Architecture

```mermaid
flowchart TD
    author["Author"]
    mdx["content/**/*.mdx"]
    quiz["content/**/*.quiz.yaml"]
    validate["scripts/validate-content.mjs"]
    build["npm run content:build"]
    data["public/data/*.json"]
    next["Next.js App Router"]
    out["Static export in out/"]
    vercel["Vercel"]
    browser["Browser"]
    storage["localStorage<br/>progress, schedule, notes"]
    llm["Assistant<br/>remote or on-device"]

    author --> mdx
    author --> quiz
    mdx --> validate
    quiz --> validate
    validate --> build
    build --> data
    data --> next
    mdx --> next
    next --> out
    out --> vercel
    vercel --> browser
    browser --> storage
    browser --> llm
    data --> llm
```

## Common tasks

| Task | Command |
| --- | --- |
| Install dependencies | `npm ci` |
| Validate content | `npm run content:validate` |
| Build generated data | `npm run content:build` |
| Run dev server | `npm run dev` |
| Typecheck/lint | `npm run lint` |
| Build app | `npm run build` |
| Serve docs locally | `mkdocs serve` |
| Build docs | `mkdocs build --strict` |

## Start here

- [Getting started](getting-started.md)
- [Architecture](architecture.md)
- [Content authoring](content-authoring.md)
- [Quiz authoring](quiz-authoring.md)
- [Assistant](assistant.md)
- [Deployment](deployment.md)
- [Troubleshooting](troubleshooting.md)
