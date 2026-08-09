# Architecture

ML Concepts is designed as a mostly static application.

The authored source of truth is in `content/`. Build scripts convert that source into JSON files under `public/data/`, which are consumed by the Next.js app and client-side features.

## High-level flow

```mermaid
flowchart TD
    mdx["content/**/*.mdx"]
    quiz["content/**/*.quiz.yaml"]
    validate["scripts/validate-content.mjs"]
    search["scripts/build-search-index.mjs"]
    content["scripts/build-content.mjs"]
    json["public/data/*.json"]
    app["Next.js app"]
    pages["Static pages"]
    state["Local browser state"]

    mdx --> validate
    quiz --> validate
    validate --> search
    validate --> content
    search --> json
    content --> json
    json --> app
    mdx --> app
    app --> pages
    pages --> state
```

## Next.js App Router

Pages live in `src/app/`.

Important routes:

| Route | Purpose |
| --- | --- |
| `/` | Concept index |
| `/learn/[...slug]` | Concept page |
| `/quiz` | Quiz launcher |
| `/quiz/session` | Quiz session |
| `/review` | Due review queue |
| `/progress` | Local progress view |
| `/settings` | Assistant, storage, backup, theme |
| `/dev/traces` | Optional trace inspector |

Route relationships:

```mermaid
flowchart LR
    index["/"] --> learn["/learn/{category}/{slug}"]
    index --> quizhome["/quiz"]
    learn --> quizhome
    quizhome --> session["/quiz/session"]
    session --> progress["/progress"]
    session --> review["/review"]
    review --> learn
    progress --> settings["/settings"]
    settings --> traces["/dev/traces"]
```

## Server-side content loading

`src/lib/content/server.ts` handles:

- reading generated concept metadata
- loading MDX files
- compiling MDX with custom components
- applying remark/rehype plugins
- rendering math and code blocks

```mermaid
flowchart TD
    request["Concept route render"]
    meta["public/data/concepts.json"]
    file["content/{category}/{slug}.mdx"]
    compile["compile MDX"]
    remark["remark-math, remark-gfm"]
    rehype["rehype-katex, rehype-slug, rehype-pretty-code"]
    html["Rendered concept page"]

    request --> meta
    meta --> file
    file --> compile
    compile --> remark
    remark --> rehype
    rehype --> html
```

## Client-side data loading

Client-side features fetch generated JSON from:

```text
/data/concepts.json
/data/search-index.json
/data/concept-sections/*.json
/data/quiz/*.json
```

```mermaid
flowchart LR
    search["Search palette"] --> idx["/data/search-index.json"]
    quizui["Quiz launcher"] --> concepts["/data/concepts.json"]
    session["Quiz session"] --> items["/data/quiz/*.json"]
    assistant["Assistant"] --> sections["/data/concept-sections/*.json"]
    assistant --> idx
```

## Generated data

The app generates:

| File | Purpose |
| --- | --- |
| `public/data/concepts.json` | Concept metadata for indexes, navigation, quizzes |
| `public/data/search-index.json` | Search chunks for MiniSearch |
| `public/data/concept-sections/*.json` | Section text for retrieval/assistant context |
| `public/data/quiz/*.json` | Normalized quiz items |

## Local state

Learning state is stored in browser `localStorage`.

```mermaid
flowchart TD
    reading["Concept page"] --> readings["mlc.readings"]
    highlight["Highlight or note"] --> notes["mlc.notes"]
    session["Quiz session"] --> attempts["mlc.attempts"]
    session --> sessions["mlc.sessions"]
    attempts --> schedule["mlc.schedule"]
    schedule --> review["/review queue"]
    attempts --> progress["/progress view"]
    attempts --> backup["Backup export"]
    notes --> backup
    readings --> backup
    sessions --> backup
```

Modules:

| Module | Purpose |
| --- | --- |
| `src/lib/persistence/progress.ts` | Attempts and mastery |
| `src/lib/persistence/schedule.ts` | Review scheduling |
| `src/lib/persistence/reading.ts` | Reading trail |
| `src/lib/persistence/notes.ts` | Highlights and notes |
| `src/lib/persistence/sessions.ts` | Completed quiz sessions |
| `src/lib/persistence/backup.ts` | Export/import backup |

## Assistant stack

Assistant code lives in:

```text
src/lib/llm/
src/components/chat/
```

The app supports:

- OpenAI-compatible remote APIs
- WebGPU on-device WebLLM models
- local grounded fallback context
- trace capture for debugging

## Retrieval stack

Retrieval code lives in:

```text
src/lib/retrieval/
```

It supports:

- current concept context
- selected text context
- section ranking
- MiniSearch concept and section search

```mermaid
flowchart LR
    question["Learner question"]
    selection["Selected text"]
    current["Current concept"]
    rank["Section ranking"]
    mini["MiniSearch query"]
    context["Grounded context bundle"]
    model["Assistant model"]

    question --> mini
    selection --> context
    current --> rank
    rank --> context
    mini --> context
    context --> model
```
