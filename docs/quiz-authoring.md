# Quiz authoring

Quiz files are YAML files that live beside concept MDX files.

For:

```text
content/general-ml/bias-variance.mdx
```

the quiz file is:

```text
content/general-ml/bias-variance.quiz.yaml
```

## From YAML to a graded attempt

```mermaid
flowchart TD
    yaml["content/{category}/{slug}.quiz.yaml"]
    validate["npm run content:validate"]
    build["npm run content:build"]
    json["public/data/quiz/{category}__{slug}.json"]
    launcher["/quiz launcher"]
    session["/quiz/session"]
    grade["src/lib/grading/"]
    attempt["mlc.attempts"]
    schedule["mlc.schedule"]
    review["/review queue"]

    yaml --> validate
    validate --> build
    build --> json
    json --> launcher
    launcher --> session
    session --> grade
    grade --> attempt
    attempt --> schedule
    schedule --> review
```

## Quiz item fields

Common fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | Recommended | Stable item ID |
| `type` | string | Yes | `mcq`, `short`, `latex`, `code`, `numeric`, or `order` |
| `prompt` | string | Yes | Question text |
| `difficulty` | integer | No | 1 to 5, defaults to 3 |
| `answer` | string | For many item types | Reference answer |
| `rubric` | string array | Recommended | Criteria for grading |
| `hints` | string array | Optional | Hints shown to learner |
| `explanation` | string | Optional | Explanation after answer |
| `anchor` | string | Optional | Link to section anchor |

## Choosing an item type

```mermaid
flowchart TD
    start["What is being tested?"]
    recall["Recognition of one correct option"]
    concept["Explanation in prose"]
    formula["A formula"]
    number["A computed value"]
    process["A process or pipeline"]
    impl["An implementation detail"]

    start --> recall
    start --> concept
    start --> formula
    start --> number
    start --> process
    start --> impl

    recall --> mcq["type: mcq"]
    concept --> short["type: short"]
    formula --> latex["type: latex"]
    number --> numeric["type: numeric"]
    process --> order["type: order"]
    impl --> code["type: code"]
```

## Multiple choice

```yaml
- id: ols-objective
  type: mcq
  prompt: Which quantity is minimized by ordinary least squares?
  difficulty: 1
  options:
    - Sum of squared residuals
    - Sum of absolute residuals
    - Classification error
    - KL divergence
  correctIndex: 0
  explanation: Ordinary least squares minimizes the sum of squared residuals.
```

`correctIndex` is zero-based.

## Short answer

```yaml
- id: empirical-risk
  type: short
  prompt: Define empirical risk.
  difficulty: 2
  answer: The average loss over the training set.
  rubric:
    - Mentions loss
    - Mentions average or sum over the training examples
```

## LaTeX answer

```yaml
- id: mse-loss
  type: latex
  prompt: Write the squared error loss for one prediction.
  difficulty: 1
  answer: (y - \hat{y})^2
  rubric:
    - Gives an equivalent squared difference between target and prediction
```

## Numeric answer

```yaml
- id: absolute-error
  type: numeric
  prompt: If the target is 10 and the prediction is 8, what is the absolute error?
  difficulty: 1
  value: 2
  tolerance: 0.001
```

## Ordered steps

```yaml
- id: supervised-workflow
  type: order
  prompt: Put the supervised-learning workflow in order.
  difficulty: 1
  steps:
    - Collect labelled data
    - Fit model on training data
    - Evaluate on held-out data
    - Deploy or iterate
```

## Code cloze

```yaml
- id: mse-code
  type: code
  prompt: Fill in the missing NumPy expression.
  difficulty: 2
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

## Validation rules

Run:

```bash
npm run content:validate
```

The validator checks item shape and required fields.

For MCQ items, include:

- non-empty `options`
- integer `correctIndex`

## Generated quiz data

Run:

```bash
npm run content:build
```

Quiz JSON is written to:

```text
public/data/quiz/<safe-concept-id>.json
```

Concept IDs are made filesystem-safe by replacing `/` with `__`.

Example:

```text
general-ml/bias-variance
```

becomes:

```text
general-ml__bias-variance.json
```

!!! tip "Write rubrics even for deterministic items"
    Rubrics are reused by the assistant when it explains a wrong answer,
    so they improve feedback quality even when grading is deterministic.
    See [Assistant](assistant.md).
