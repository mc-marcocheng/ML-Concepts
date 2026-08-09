# Assistant

The app includes an optional assistant for concept questions and quiz explanation.

The assistant can use:

1. a remote OpenAI-compatible API
2. an on-device WebGPU model through WebLLM
3. a grounded local fallback when model generation is unavailable

## Mode selection

```mermaid
flowchart TD
    start["Assistant request"]
    enabled{"mlc.llmEnabled?"}
    provider{"mlc.llmProvider"}
    remote["Remote OpenAI-compatible API"]
    webgpu{"WebGPU available<br/>and weights cached?"}
    ondevice["WebLLM on-device model"]
    fallback["Grounded local fallback"]
    off["Assistant UI hidden"]
    answer["Answer rendered in chat panel"]

    start --> enabled
    enabled -->|no| off
    enabled -->|yes| provider
    provider -->|remote| remote
    provider -->|ondevice| webgpu
    webgpu -->|yes| ondevice
    webgpu -->|no| fallback
    remote -->|network error| fallback
    remote --> answer
    ondevice --> answer
    fallback --> answer
```

## Where settings live

Open:

```text
/settings
```

The settings page includes assistant configuration, health checks, model download controls, and backup options.

## Remote model mode

Remote mode expects an OpenAI-compatible chat-completions endpoint.

Typical base URL:

```text
https://api.openai.com/v1
```

Required fields:

- base URL
- model name
- API key
- max output tokens
- reasoning effort

The app calls:

```text
POST <baseUrl>/chat/completions
```

and may call:

```text
GET <baseUrl>/models
```

for health checks.

## On-device mode

On-device mode uses WebLLM and WebGPU.

Current model options are declared in:

```text
src/lib/llm/capability.ts
```

The app includes Qwen3 WebLLM model specs.

On-device mode requires:

- a browser with WebGPU
- enough storage quota
- enough GPU memory
- model weights downloaded into browser cache/storage

```mermaid
flowchart LR
    pick["Pick a model in /settings"]
    probe["Capability probe"]
    download["Download weights"]
    cache["Browser cache storage"]
    engine["WebLLM engine"]
    infer["Local inference"]

    pick --> probe
    probe -->|WebGPU ok| download
    probe -->|no WebGPU| blocked["Use remote mode instead"]
    download --> cache
    cache --> engine
    engine --> infer
```

## Browser support

WebGPU support varies by browser and device.

If WebGPU is unavailable, use remote mode or leave the assistant off.

On iOS, install the app to the Home Screen before downloading large model weights. Storage quota is usually larger for installed web apps.

## Grounded context

Assistant prompts are grounded in:

- selected text
- current concept metadata
- nearby concept sections
- retrieved related note chunks

```mermaid
sequenceDiagram
    autonumber
    participant U as Learner
    participant C as Chat panel
    participant R as Retrieval
    participant D as Generated JSON
    participant M as Model

    U->>C: Ask a question
    C->>R: Selection + current concept
    R->>D: Load concept sections
    R->>D: MiniSearch over search index
    D-->>R: Ranked chunks
    R-->>C: Grounded context bundle
    C->>M: System prompt + context + question
    M-->>C: Streamed answer
    C-->>U: Answer with concept references
```

Generated section context comes from:

```text
public/data/concept-sections/*.json
```

Search chunks come from:

```text
public/data/search-index.json
```

## Grading

Quiz grading uses:

1. deterministic checks where possible
2. LLM rubric judging for open answers when assistant is enabled
3. self-grade fallback when grading is unavailable

```mermaid
flowchart TD
    submit["Answer submitted"]
    kind{"Item type"}
    det["Deterministic check<br/>mcq, numeric, order"]
    open["Open answer<br/>short, latex, code"]
    llm{"Assistant enabled?"}
    rubric["LLM rubric judge"]
    self["Self-grade fallback"]
    result["Attempt result"]
    store["mlc.attempts + mlc.schedule"]

    submit --> kind
    kind --> det
    kind --> open
    det --> result
    open --> llm
    llm -->|yes| rubric
    llm -->|no| self
    rubric -->|error| self
    rubric --> result
    self --> result
    result --> store
```

Grading code lives in:

```text
src/lib/grading/
```

## Tracing

Tracing can be enabled by setting:

```text
localStorage["mlc.trace"] = "1"
```

Then open:

```text
/dev/traces
```

Trace storage is local and bounded.

If `NEXT_PUBLIC_TRACE_ENDPOINT` is set, spans may also be exported with `fetch`.

```mermaid
flowchart LR
    span["Assistant or grading span"]
    flag{"mlc.trace = 1?"}
    local["mlc.llmTraces (bounded)"]
    viewer["/dev/traces"]
    endpoint{"NEXT_PUBLIC_TRACE_ENDPOINT set?"}
    post["fetch POST export"]

    span --> flag
    flag -->|no| drop["Discarded"]
    flag -->|yes| local
    local --> viewer
    local --> endpoint
    endpoint -->|yes| post
```
