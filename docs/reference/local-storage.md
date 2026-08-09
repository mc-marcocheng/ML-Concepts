# Local storage

The app stores user learning state locally in the browser.

## State map

```mermaid
flowchart TD
    subgraph learning["Learning data"]
        attempts["mlc.attempts"]
        schedule["mlc.schedule"]
        readings["mlc.readings"]
        notes["mlc.notes"]
        sessions["mlc.sessions"]
    end

    subgraph prefs["Preferences"]
        theme["mlc.theme"]
        proofs["mlc.expandProofs"]
    end

    subgraph llm["Assistant settings"]
        enabled["mlc.llmEnabled"]
        provider["mlc.llmProvider"]
        models["mlc.onDeviceModel / mlc.remoteModel"]
        remote["mlc.llmBaseUrl, mlc.llmMaxTokens, mlc.llmReasoningEffort"]
        secret["mlc.llmApiKey + mlc.llmRememberApiKey"]
        traces["mlc.llmTraces + mlc.trace"]
    end

    learning --> backup["Backup export"]
    prefs --> backup
    llm --> backup
    secret -.->|excluded| backup
    traces -.->|excluded| backup
```

## Keys

| Key | Purpose |
| --- | --- |
| `mlc.attempts` | Quiz attempt records |
| `mlc.schedule` | Review schedule records |
| `mlc.readings` | Recent reading records |
| `mlc.notes` | Highlights and notes |
| `mlc.sessions` | Completed quiz sessions |
| `mlc.theme` | Light/dark theme |
| `mlc.expandProofs` | Expand collapsible proof/details preference |
| `mlc.llmEnabled` | Assistant enabled flag |
| `mlc.llmProvider` | `remote` or `ondevice` |
| `mlc.onDeviceModel` | Selected WebLLM model key |
| `mlc.remoteModel` | Remote model name |
| `mlc.llmBaseUrl` | Remote API base URL |
| `mlc.llmApiKey` | Optional remembered API key |
| `mlc.llmRememberApiKey` | Whether to persist API key |
| `mlc.llmMaxTokens` | Remote max output tokens |
| `mlc.llmReasoningEffort` | Reasoning effort preference |
| `mlc.llmTraces` | Local assistant/grading traces |
| `mlc.trace` | Enables tracing when set to `1` |

## Backup behavior

```mermaid
flowchart LR
    ls["localStorage"]
    exportBtn["/settings export"]
    file["backup.json"]
    importBtn["/settings import"]
    merged["Restored state"]

    ls --> exportBtn
    exportBtn --> file
    file --> importBtn
    importBtn --> merged
    merged --> ls
```

Backup export includes:

- attempts
- readings
- notes
- sessions
- non-secret settings

Backup export excludes:

- API keys
- browser caches
- downloaded model weights

Backup code lives in:

```text
src/lib/persistence/backup.ts
```

!!! warning "Local only"
    Nothing is synced to a server. Clearing site data, using a private window,
    or switching browsers loses progress unless you exported a backup first.

## Clearing local progress

The Settings page exposes controls for clearing learning data.

During development, you can also clear local storage in DevTools.
