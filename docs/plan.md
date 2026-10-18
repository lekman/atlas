# Plan

What comes after the worlds: the dashboard moves into the database, then the
list becomes something you act in and score. Every step starts in Storybook
on the invented dataset; the real dashboard is read only on the Mac mini and
never enters this repository.

## Step 1: The Dashboard Moves Into the Database

The Markdown dashboard has outgrown its format: several skills and scripts
write the same file, and the last writer wins. Atlas becomes the one place
work is kept, and the dashboard becomes a view of it.

### How the Dashboard Maps Into Atlas

| In the dashboard                                     | In Atlas                                             |
| ---------------------------------------------------- | ---------------------------------------------------- |
| A client block under a day                           | Client, as now                                       |
| `- [ ] … **Title.** prose`                           | Task: title and summary                              |
| The first link, `[KEY](url)`                         | Tracker reference: key, link and system              |
| 🔴 🟡 🟢                                             | The task's priority until it has an effort and value |
| 🚧                                                   | Blocked                                              |
| `[x]`                                                | Done, on the day it was ticked                       |
| A day heading, Tomorrow, Future, Unscheduled         | Scheduled date, or none                              |
| `*(added 2 Oct)*`, `*(moved from Fri)*`              | The task's history                                   |
| The client's opening callout, `Watch:`, `Intention:` | A day note for that client                           |
| A "Current situation" callout                        | The client's brief                                   |
| `📅 09:15–09:45` lines                               | Calendar entries: read only, never scored            |
| `[Details](path)`                                    | A details document, read in the app                  |
| Initiatives and their master plans                   | Initiative: a workstream group for each client       |
| The archive's monthly work logs                      | Done tasks and day notes in the archive              |
| Handover callouts                                    | Documents attached to the client                     |

A task keeps its tracker key as its identity when it has one. Otherwise its
identity is its client, the day it first appeared and its details path, so a
reworded title updates the same task. The importer never invents a key.

### How the Import Runs

1. A parser in `core`, with no input or output of its own, tested with
   `bun test` on an invented dashboard of the same shape. A line it cannot
   place goes into a report; it is never guessed.
2. On the Mac mini, a dry run first: counts for each client and day, the
   lines it could not place, tasks waiting for a size, and anything that
   looks like a credential, which is held back and named only by its line.
3. The import after you approve the report. Running it again is safe: a
   changed line updates its record, and nothing is deleted silently.
4. Cutover, one way. The database is the master copy, and the dashboard is
   regenerated from it as a read-only view headed "edit in Atlas".

The vault reaches the Mac mini through Obsidian Sync: the Mac mini runs
Obsidian with its own copy of the vault. The importer and the details
reader read that folder as Sync updates it, and the regenerated dashboard is
written back into it, so Sync carries it to every device. An edit made in
Obsidian to the generated file shows in Atlas as a proposed change, accepted
with one tap and never applied silently.

### The Skills Move With It

An `atlas` plugin in `lekman/ai-toolkit` takes over everything that writes
the dashboard today, and the old skills retire in the same release so
nothing clashes.

| Today                                                                                  | Becomes                                                   |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Planner skills: archive, execute, goal, morning, next, plan, pull, sync, today, triage | Atlas skills calling the MCP tools                        |
| Obsidian dashboard skills: add, dashboard, focus, sync-todo, tick, wrapup              | Atlas skills                                              |
| The planner's shape, roll-forward, move and archive scripts                            | Server logic: days promote themselves; done work archives |
| The dashboard guard hook                                                               | A guard against any write to the generated file           |
| `wrap:day`, `commander:plan-check`                                                     | Read from Atlas                                           |

The MCP tools: `task_add`, `task_update`, `task_complete`, `day_note_set`
and `calendar_add`.

### Details Open in the World's Own Form

A linked details page is imported as a document, with its client's
classification and its source path, and refreshed when the note changes, so
it reads on the iPhone too. It renders a safe subset of Markdown: headings,
lists, tables, code, links and callouts. Raw HTML is never rendered,
wiki-links open the matching record or read as plain text, and embedded
files are listed rather than drawn.

Each world frames it in its own way: a tight-beam transmission for the
Astronomer, a sealed letter for the Mariner, a field notebook for the
Woodsman, a garden journal for the Gardener, a hand scroll for the Samurai
and a referral letter on a clipboard for the Doctor. The title always
carries the real word, "Details", and the buttons keep plain words.

### Privacy

Records keep the vault's classification and stay on the Mac mini, reached
only over Tailscale. The importer logs counts, never text. The parser's
tests use invented lines only.

## Step 2: Act in the List, Scored by Business Value

The goal is not an empty list. Points come from the business value of what
was done.

### Acting

Each task offers, in plain words: Done, Tomorrow, Schedule, Priority, Block
or Unblock, Note, Open details, Open ticket, and Drop. On the iPhone, swipe
for Done and Tomorrow. Every action is an event: it drives the world's
animation and sound, and can be undone for ten seconds.

### Effort and Value

| Scale  | Values                                   |
| ------ | ---------------------------------------- |
| Effort | T-shirt sizes: XS 1, S 2, M 3, L 5, XL 8 |
| Value  | 1, 2, 3, 5, 8, 13                        |

Priority follows value divided by the effort weight: 2 or more is high,
below 0.75 is low, and anything between is normal. Extra large effort with a
value of 3 or less is "Not worth it" whatever the ratio: it sinks to the
bottom with Drop and Split offered. Imported tasks keep their old marker
until they are sized. An agent may suggest a value with a one-line reason;
you confirm it.

### Points

Points are earned at Done, from value alone: effort sets the order of work,
not the reward.

| Kind of work                                         | Weight |
| ---------------------------------------------------- | ------ |
| Client work                                          | × 1.5  |
| Home business, cash flow: invoices, payments, offers | × 1.25 |
| Home business, flow: less manual work                | × 1    |
| Other admin                                          | × 0.75 |

A task that unblocks someone or something earns × 1.5 on top. Adding,
rescheduling, calendar entries and Drop earn nothing. There are no negative
points and no streaks; a task moved three times or more shows as stale.

Points go into a ledger that is only added to: each entry names the task,
the day, the points, the reason and the rule version, so changing a rule is
a deliberate rescore.

### Day, Week and Archive

Each day's score shows by client and in total; weeks run Monday to Sunday,
Canary time. Every archived day keeps its score and what earned it. The
imported archive is scored with the same rules from its markers and marked
"retrospective"; changing a value afterwards rescores that day only, with a
visible note.

## Order of Work

New screens are designed in the Astronomer world first. Shared components
take every world's palette and faces from the theme, and their stories run
the accessibility check once in each world's palette, so the light worlds
stay checked.

1. Storybook: the details reader, the day list, the effort and value
   picker, and the import report.
2. Core: the model additions and the dashboard parser.
3. Server: SQLite on the Mac mini with Litestream, the MCP tools, the dry
   run, the import and the regenerated dashboard.
4. Skills: the `atlas` plugin replaces the planner and Obsidian dashboard
   skills.
5. Storybook: the list's actions, the day score, the week chart and the
   archive.
6. Core: the scoring rules, the ledger and retrospective scoring.
7. The other worlds' reader frames, finish moments and point names.
