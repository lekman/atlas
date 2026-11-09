# Core Model

This page lists the records that every capability and view depends on, and
how they link. Read [Capabilities](capabilities.md) first. The names are
working names.

**State:** mostly target. Atlas already has questions, decisions and tasks.
Its decision records what was decided, the item or requirement it settles
and the question it came from. The target decision also holds the outcome, the confidence and the precedents
used. The other records do not exist yet.

## The Records

| Record               | Holds                                                                                                | Links to                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Signal               | Source, kind, received at, client, a reference to the payload, status                                | The decisions it led to                     |
| Orchestrator charter | Name, general or client, client, scope, rules, allowed actions, budget, confidence floor, version    | Its decisions                               |
| Decision             | Act, ask, delegate or digest; confidence; reason; precedents used; the outcome, once known           | Signal, charter, question or delegation     |
| Question             | Text, options, recommendation, evidence, deadline, answer, answered at                               | Decision                                    |
| Delegation           | Contract (goal, Definition of Done, budget, deadline, shape of the return), worker, workspace, state | Decision, task, the block that did the work |
| Task                 | The record in the task database                                                                      | Delegation, details page, pull requests     |
| Thesis               | Problem, prediction, metric, kill criteria; go, park or kill                                         | Signal, experiments                         |
| Experiment           | Test plan, the estimate as a prediction, phase                                                       | Thesis, delegations, measurements           |
| Building block       | Slot, version, kind (skill, agent, model, hook, tool), owner, status (champion, challenger, retired) | Slot, measurements                          |
| Slot                 | Phase, contract (inputs, outputs, success measure)                                                   | Building blocks                             |
| Measurement          | Metric, value, predicted value, when, which judge                                                    | Experiment or building block                |

## From Signal to Task

A signal can lead to more than one decision. In the example, signal S2
led to decision D2 (run the test again) and then to D3 (delegate a fix).
A decision can use earlier decisions as precedent.

```mermaid
erDiagram
  SIGNAL ||--o{ DECISION : "leads to"
  ORCHESTRATOR_CHARTER ||--o{ DECISION : makes
  DECISION }o--o{ DECISION : "uses as precedent"
  DECISION ||--o| QUESTION : asks
  DECISION ||--o| DELEGATION : creates
  DELEGATION ||--|| TASK : "tracked as"
  SIGNAL {
    string source
    string kind
    datetime receivedAt
    string client
    string status
  }
  DECISION {
    string outcome
    float confidence
    string reason
    string result
  }
  QUESTION {
    string text
    string recommendation
    datetime deadline
    string answer
  }
  DELEGATION {
    string goal
    string definitionOfDone
    string budget
    string worker
    string state
  }
```

## Experiments and Building Blocks

The experiment side holds the prediction and the measurement. A
measurement belongs either to an experiment, when it measures a piece of
work, or to a building block, when it scores the block.

```mermaid
erDiagram
  SIGNAL ||--o| THESIS : "may become"
  THESIS ||--o{ EXPERIMENT : "tested by"
  EXPERIMENT ||--o{ DELEGATION : "runs as"
  EXPERIMENT ||--o{ MEASUREMENT : "measured by"
  SLOT ||--o{ BUILDING_BLOCK : "filled by"
  BUILDING_BLOCK ||--o{ DELEGATION : "does the work of"
  BUILDING_BLOCK ||--o{ MEASUREMENT : "scored by"
  THESIS {
    string problem
    string prediction
    string metric
    string killCriteria
    string verdict
  }
  EXPERIMENT {
    string testPlan
    float estimate
    string phase
  }
  MEASUREMENT {
    string metric
    float value
    float predicted
    string judge
  }
  BUILDING_BLOCK {
    string version
    string kind
    string status
  }
  SLOT {
    string phase
    string contract
  }
```

## Why the Predicted Value Sits in the Measurement

A measurement stores the predicted value beside the actual one. Calibration
needs both, and the prediction must be written before the result is known.
[The Scientific Method](scientific-method.md) explains why that order
matters.
