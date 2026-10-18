# Event Triage and Decision Engine

A product requirements document (PRD) for how Atlas sorts incoming events.
It is a draft from 18 October 2026, and nothing in it is built yet. It is
written for whoever builds the server side of Atlas. Read
[Architecture](architecture.md) first, because this builds on its events.

## Summary

Atlas needs a fast way to handle incoming events, such as emails, calendar
requests and failed CI (continuous integration) runs. Today each event needs
a full commander session to read it. This document proposes four tiers
instead, each one called only when the tier below it is unsure:

1. Deterministic code.
2. A decision model that answers typed questions about the event.
3. Gemini Flash as a fast commander for escalations.
4. Claude for planning, building and deep analysis.

The lower tiers also notice failures that repeat. They raise an improvement
issue for each one, scored with FMEA (failure mode and effects analysis).

## Problem

- Every incoming event needs a commander session to interpret it. That is
  slow and costly for decisions that are simple and repetitive.
- Vague prompts and noisy event streams get the same heavy treatment as
  complex work.
- Recurring failures, such as the same CI error or the same kind of email,
  are handled one at a time. Nothing turns repetition into an improvement.

## Goals

1. Triage incoming events quickly, so most never reach a generative model.
2. Keep the commander session fast and shallow by handing it events that are
   already triaged.
3. Escalate only on low confidence, on something new, or when a person is
   needed.
4. Detect repeated failures automatically and raise improvement issues
   scored with FMEA.
5. Keep client data inside the right boundary, as the rest of Atlas does.

## Non-Goals

- The lower tiers fix nothing. They classify, route, count and raise issues.
- This does not replace Claude for planning, building or deep analysis.
- No fine-tuning of hosted models.
- No automatic action on a client's systems from the fast path.

## Event Sources

| Source            | Examples                                                              | Notes                                                                                   |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Email             | The owner's own company mail; client mail saved as `.msg` to OneDrive | Client content stays on the client laptop. Only metadata or redacted summaries leave it |
| Calendar          | Invitations, reschedules, cancellations                               | Imported into the Atlas database                                                        |
| CI and deployment | Failed runs, flaky tests, failed releases                             | From the GitHub repositories                                                            |
| Agents            | Status changes, failures, completions                                 | These also drive the Atlas animations                                                   |
| Manual prompts    | Quick notes or vague requests from the phone or the sidebar           | Tier 1 interprets them, then Tier 2 if they stay unclear                                |

## Architecture

### Tier 0: Deterministic Code

Target latency is milliseconds, with under 50 ms proposed.

- Parse the event into a normalised state.
- Compute a **fingerprint**. Examples are the CI job and its error signature,
  the sender and a subject pattern, or the calendar organiser and event type.
- Look the fingerprint up in the database.
- For an exact repeat, increase its counters and file it against the
  existing record. No model is called.
- Apply hard rules here, such as allow lists, deny lists and known noise.

### Tier 1: Decision Model

Target latency is under a second. A decision model returns typed answers
with a probability for each, in the style of the Jev models.

- Called only for new or fuzzy events.
- One request per event, with every question in it, because the state is
  billed once per request.
- With high confidence, Tier 1 routes and acts. It files, tags, or assigns
  the event to an agent group.
- With low confidence, it escalates to Tier 2 and attaches its scores.

| Model option                  | Role                                         |
| ----------------------------- | -------------------------------------------- |
| Kev or Laya, on the Mac mini  | Preferred, because data stays on the machine |
| Jev, hosted                   | Fallback, or a benchmark for the others      |
| Gemini with structured output | A way to start before a model is self-hosted |

### Tier 2: Fast Commander

Target latency is seconds. Gemini Flash handles escalations and vague
prompts. It receives the Tier 1 result, with the candidate answers and their
probabilities, so it starts from the triage instead of from nothing. It
makes quick, shallow calls. It picks a route, asks one clarifying question,
or hands the event to Tier 3.

### Tier 3: Claude

Claude does planning, building, fixes and FMEA analysis. Tier 2, an FMEA
issue or the owner can start it.

### Flow

```text
Event -> Tier 0 (fingerprint, rules)
           |-- known repeat -> count + file
           '-- new / fuzzy -> Tier 1 (typed decisions)
                                 |-- confident -> route / act
                                 '-- unsure -> Tier 2 (Gemini Flash)
                                                  |-- resolve -> route / act
                                                  '-- complex -> Tier 3 (Claude)
```

## Decision Schema for Tier 1

Each event gets one request with these questions.

| Question                                    | Type   | Allowed answers                                                            |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| Event type                                  | choice | email-request, email-info, calendar, ci-failure, agent-event, noise, other |
| Client                                      | choice | The owner's own company, known clients, unknown                            |
| Agent group                                 | choice | The agent groups configured in Atlas                                       |
| Urgency                                     | score  | 1 to 5                                                                     |
| Needs the owner                             | yes/no |                                                                            |
| Same failure as a known fingerprint         | choice | The top candidate fingerprints, or none                                    |
| Severity, for failures only                 | score  | 1 to 10                                                                    |
| Contains PII or client-confidential content | yes/no |                                                                            |

PII is personally identifiable information. The schema follows three rules:

- Each question asks for one judgement. Code combines the answers.
- Answer names stay meaningful and stable.
- The schema has a version. The model version is pinned, and a regression
  test runs before any upgrade.

## Escalation Policy

- Each question has one confidence threshold that can be configured. Start
  cautious and tune it from the logs.
- Always escalate when "needs the owner" is yes with high urgency, when PII
  is flagged on a path that would leave its boundary, or when the event type
  is "other".
- Log every escalation with its Tier 1 scores, so the schema can improve.

## Repeated Failures and the FMEA Loop

Tier 0 counts how often each fingerprint occurs over time windows. When a
fingerprint passes a threshold, Atlas raises an improvement issue. The
proposed threshold is three occurrences in seven days.

Each FMEA score comes from a different tier:

| Score      | Comes from                                                                         |
| ---------- | ---------------------------------------------------------------------------------- |
| Occurrence | Fingerprint counts in the database, so it is deterministic                         |
| Severity   | The Tier 1 severity answer                                                         |
| Detection  | Where the failure was caught. Caught at Tier 0 is easy; reaching the owner is hard |

The risk priority number (RPN) is severity × occurrence × detection.

The FMEA skill runs in Tier 3. It describes the failure mode, its cause, its
effect and a proposed control. The issue then enters the Atlas backlog, and
its RPN feeds the business value scale, so fixing a recurring failure earns
points.

## Privacy and Data Classification

- Client mail content stays on the client laptop. Only metadata or redacted
  summaries leave it.
- Anything about a client goes to the self-hosted model on the Mac mini, over
  Tailscale, by default.
- Hosted models, Jev and Gemini, receive only data classified as safe for
  them. Check each provider's data-use terms first, and use paid API tiers
  that do not train on prompts.
- The Tier 1 PII answer decides whether an event may go to a hosted tier.
- The public repository keeps the same client-content checks as the rest of
  Atlas.

## Fit With Atlas

- The database is the master record. Events, fingerprints, decisions and
  escalations are stored there.
- Event outcomes drive the world animations, such as a tight-beam message in
  Astronomer or a ship in Mariner.
- The triage logic and schema are TypeScript, beside the rest of Atlas.
- Triage and FMEA become Atlas skills.

## Success Measures

All targets are proposals.

| Measure                                                 | Target         |
| ------------------------------------------------------- | -------------- |
| Events resolved at Tier 0 or Tier 1                     | More than 80%  |
| Tier 1 latency at the 95th percentile                   | Under 1 second |
| Events escalated to Tier 2                              | Fewer than 15% |
| Tier 1 routing accuracy, checked by sampling            | More than 90%  |
| Repeated failures above threshold raised as FMEA issues | All of them    |
| Recurring failure fingerprints closed a month           | Rising         |

## Phases

1. **Tier 0 and the schema.** Fingerprints, counters, database tables, and
   the decision schema.
2. **Tier 1, first version.** Gemini structured output as the decision
   layer, with everything logged.
3. **Self-hosted decision model.** Kev or Laya on the Mac mini behind an API
   compatible with Jev, compared against the logs.
4. **Tier 2 commander.** The Gemini Flash escalation path.
5. **FMEA loop.** Thresholds, RPN, issue creation, the FMEA skill, and the
   link to business value points.
6. **Event sources.** CI first, then calendar, then the owner's own mail,
   then the client `.msg` flow.

## Open Questions

- Which self-hosted model does best on Atlas's own events: Kev, Laya or
  Clef?
- What confidence threshold should each question have?
- What are the fingerprint rules for each source, above all for email?
- Does the Gemini access include API use, and what are its data-use terms?
- Should the FMEA threshold differ by source, for example CI against email?
- How does the client laptop produce redacted summaries before anything
  leaves it?
