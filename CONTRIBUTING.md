# Contributing to ML Concepts

Thanks for contributing. This project combines a static Next.js app, authored ML notes, quiz YAML, local-first learning state, and optional AI assistant features.

This guide explains how to make safe, reviewable changes.

---

## Quick start

```bash
npm ci
npm run content:validate
npm run content:build
npm run lint
npm run build
```

For development:

```bash
npm run dev
```

---

## Branches and pull requests

Use short branch names that describe the change:

```text
content/add-policy-gradient-note
fix/quiz-order-grading
docs/assistant-setup
ui/mobile-quiz-layout
```

Before opening a pull request, run:

```bash
npm run content:validate
npm run content:build
npm run lint
npm run build
```

A good PR should include:

- a clear description of the change
- screenshots or short recordings for UI changes
- notes on content additions or quiz behavior
- any known limitations
- linked issue, if applicable

---

## Project structure

```text
content/                  # Concept MDX and quiz YAML
scripts/                  # Content validation/build scripts
src/app/                  # Next.js App Router pages
src/components/           # UI components
src/lib/content/          # Content schemas, loading, graph/order logic
src/lib/quiz/             # Quiz loading/session building
src/lib/grading/          # Deterministic and LLM grading
src/lib/llm/              # Assistant clients/providers/prompts
src/lib/persistence/      # Browser localStorage persistence
src/lib/retrieval/        # Search and context retrieval
docs/                     # MkDocs documentation
```

---

## Content contributions

Concept notes are written in MDX and live under:

```text
content/<category>/<slug>.mdx
```

The frontmatter `id` must exactly match:

```text
<category>/<slug>
```

For example:

```text
content/general-ml/bias-variance.mdx
```

must use:

```yaml
id: general-ml/bias-variance
```

### Required frontmatter

```yaml
---
id: general-ml/example-concept
title: Example Concept
category: general-ml
summary: A concise summary under 200 characters.
tags: [tag-one, tag-two]
difficulty: 3
prereqs: []
related: []
estReadMin: 6
updated: 2026-01-01
---
```

### Current categories

Use one of the category IDs declared in `src/lib/content/categories.ts`:

```text
reinforcement-learning
llms
generative-modeling
applied-ml
general-ml
linear-algebra
```

### MDX components

The following custom components are available in concept notes:

```mdx
<TLDR>
Short high-level summary.
</TLDR>

<Intuition>
Plain-language intuition.
</Intuition>

<Pitfall>
Common mistake or misleading interpretation.
</Pitfall>

<Proof title="Why this works" lines={6}>
Proof content.
</Proof>

<Derivation title="Gradient derivation">
Derivation content.
</Derivation>

<Example title="Worked example">
Example content.
</Example>

<Aside title="Historical note">
Additional context.
</Aside>
```

### Headings

Use `##` and `###` headings for the table of contents and search sections.

Avoid skipping directly from `##` to deeply nested headings unless necessary.

### Math

Use normal Markdown math:

```md
Inline: $p(y \mid x)$

Display:

$$
\nabla_\theta J(\theta)
=
\mathbb{E}[\nabla_\theta \log \pi_\theta(a \mid s) R]
$$
```

### Code

Use fenced code blocks with a language label:

````md
```python
def loss(y_hat, y):
    return ((y_hat - y) ** 2).mean()
```
````

---

## Quiz contributions

Quiz YAML files are optional and live beside a concept note:

```text
content/<category>/<slug>.quiz.yaml
```

Example:

```yaml
- id: example-short
  type: short
  prompt: What is the main purpose of regularization?
  difficulty: 2
  answer: To reduce overfitting by constraining or penalizing model complexity.
  rubric:
    - Mentions reducing overfitting
    - Mentions constraining or penalizing complexity
  hints:
    - Think about what happens to overly flexible models.
  explanation: Regularization discourages overly complex functions, which can improve generalization.
```

### Supported quiz types

#### `mcq`

```yaml
- id: example-mcq
  type: mcq
  prompt: Which quantity is minimized by ordinary least squares?
  options:
    - Sum of squared residuals
    - Sum of absolute residuals
    - Classification error
    - KL divergence
  correctIndex: 0
  difficulty: 1
  explanation: OLS minimizes the sum of squared residuals.
```

`correctIndex` is zero-based.

#### `short`

```yaml
- id: example-short
  type: short
  prompt: Define empirical risk.
  answer: The average loss over the training set.
  rubric:
    - Mentions average or sum over training examples
    - Mentions loss
```

#### `latex`

```yaml
- id: example-latex
  type: latex
  prompt: Write the squared error loss for one prediction.
  answer: (y - \hat{y})^2
  rubric:
    - Gives an equivalent squared difference between target and prediction
```

#### `numeric`

```yaml
- id: example-numeric
  type: numeric
  prompt: If the target is 10 and the prediction is 8, what is the absolute error?
  value: 2
  tolerance: 0.001
```

#### `order`

```yaml
- id: example-order
  type: order
  prompt: Put the supervised-learning workflow in order.
  steps:
    - Collect labelled data
    - Fit model on training data
    - Evaluate on held-out data
    - Deploy or iterate
```

#### `code`

```yaml
- id: example-code
  type: code
  prompt: Fill in the missing NumPy operation.
  lang: python
  scaffold: |
    import numpy as np

    def mse(y_hat, y):
        return ___BLANK_1___
  blanks:
    - id: 1
      answer: np.mean((y_hat - y) ** 2)
      rubric:
        - Computes the mean squared error
```

---

## Validation

Run content validation after editing notes or quizzes:

```bash
npm run content:validate
```

This checks:

- frontmatter shape
- concept ID/path consistency
- quiz item schema
- MCQ options and `correctIndex`
- prereq references
- prereq cycles

Build generated data:

```bash
npm run content:build
```

This writes static JSON files under:

```text
public/data/
```

Do not manually edit generated JSON unless debugging.

---

## Code style

Use TypeScript and keep components focused.

General conventions:

- use `type` imports where possible
- prefer small pure helpers in `src/lib`
- keep browser-only code in client components or modules with `'use client'`
- avoid adding server-only imports into client modules
- avoid unnecessary dependencies
- keep localStorage keys namespaced with `mlc.`

---

## Accessibility

UI changes should preserve:

- keyboard navigation
- visible focus states
- semantic landmarks
- labelled buttons and form controls
- adequate color contrast
- reduced layout shift

For dialogs and sheets, prefer existing Radix-based components.

---

## Assistant and model changes

Assistant-related code lives under:

```text
src/lib/llm/
src/components/chat/
```

Be careful with:

- API keys
- localStorage persistence
- streaming output
- abort handling
- empty model responses
- WebGPU browser compatibility
- trace redaction

Do not log API keys.

Do not include API keys in backups.

---

## Persistence changes

Local app data lives in browser storage.

Relevant modules:

```text
src/lib/persistence/progress.ts
src/lib/persistence/reading.ts
src/lib/persistence/notes.ts
src/lib/persistence/schedule.ts
src/lib/persistence/sessions.ts
src/lib/persistence/backup.ts
```

If changing storage formats:

1. preserve backwards compatibility where possible
2. update backup export/import
3. document the change
4. test with malformed or missing localStorage values

---

## Documentation changes

Documentation lives in:

```text
docs/
mkdocs.yml
```

Build locally with:

```bash
python -m pip install mkdocs
mkdocs build --strict
```

Serve locally with:

```bash
mkdocs serve
```

The docs are deployed by GitHub Actions to GitHub Pages.

---

## Pull request checklist

Before requesting review:

- [ ] `npm ci` succeeds
- [ ] `npm run content:validate` succeeds
- [ ] `npm run content:build` succeeds
- [ ] `npm run lint` succeeds
- [ ] `npm run build` succeeds
- [ ] docs build if docs changed: `mkdocs build --strict`
- [ ] screenshots included for UI changes
- [ ] no secrets committed
- [ ] generated data is up to date if content changed

---

## Security notes

Never commit:

- API keys
- Vercel tokens
- `.env.local`
- local backups containing personal data
- downloaded model weights or browser cache data

Use GitHub repository secrets for deployment credentials.
