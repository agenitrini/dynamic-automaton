# Dynamic finite automata

An educational website for visualizing finite automata and their algorithms.
Enter automata, observe their transformations, and follow the corresponding
pseudocode step by step. The site is inspired by the discrete mathematics
course and the finite automata programming practical.

## Contents

- [Getting started](#getting-started)
- [Describing an automaton](#describing-an-automaton)
- [Using the interface](#using-the-interface)
- [Available operations](#available-operations)
- [Conventions and limits](#conventions-and-limits)
- [Project structure](#project-structure)
- [Tests](#tests)
- [Author and license](#author-and-license)

## Getting started

Open [index.html](./index.html) in a modern browser with JavaScript enabled.
The website runs directly from disk, with no installation, server, Internet
connection, or external dependencies.

An example nondeterministic automaton is loaded into the input on startup,
along with a second automaton for binary operations. The main visualization
remains empty until an operation is selected. All data stays in the page: inputs
are not retained when it is reloaded.
The **EN / FR** button and its flag indicate the language to switch to.
It changes the interface and visualization language without losing the
displayed step. The preference is saved if the browser allows it. You can
also open the page with `?lang=fr` or `?lang=en`.
The **Help** button next to the language selector displays this documentation
in the interface language and pauses playback; use **Close** or Escape to exit.

## Describing an automaton

Enter automaton A in the multiline field. For intersection, union, and
concatenation, also enter automaton B. The format is the one used in the
programming practical:

```text
#E: 0 1 2
#I: 0
#F: 2
#T: (0 a 0)
(0 b 1)
(1 a 2)
```

| Section | Contents |
|---|---|
| `#E:` | Identifiers of all states |
| `#I:` | Identifiers of initial states |
| `#F:` | Identifiers of final states |
| `#T:` | Transitions, in the form `(source symbol destination)` |

The four sections must appear in this order. Identifiers are nonnegative
integers; initial states, final states, and transition endpoints must be
declared in `#E:`. A transition has one non-whitespace character as its
symbol, other than a parenthesis. Sections may be empty, and there may be
multiple initial or final states. Duplicates are ignored. ε-transitions are
not supported; ε denotes only the empty word in the interface and explanations.

For operations requiring an alphabet, enter its characters without separators,
for example `ab`; spaces are ignored. For the complement and minimization, it
must contain all transition labels of A. For recognition, leave the “Word”
field empty to test ε.

## Using the interface

1. Choose an operation: its visualization starts automatically.
2. Edit automaton A and, if the operation requires it, automaton B.
   **Visualize** draws the entered automaton in the preview on the right.
3. Fill in the operation-specific fields. The visualization is recomputed when
   you leave an edited field; a checkbox takes effect immediately.
4. Use the player or select a log entry to examine a step; the message, the
   pseudocode line and the graph are synchronized.

The player provides first and last step, previous and next step, play/pause,
timeline navigation and speed control. When focus is not in a field or button,
<kbd>Space</kbd>, <kbd>←</kbd> and <kbd>→</kbd> control playback.

### Pseudocode

The right-hand panel presents the algorithm **as broad steps**, in English or
French, and highlights the current step. It deliberately does not reproduce
the Python code of the practical, which students must write themselves. When
an algorithm uses another one (for instance the complement, which determinizes
then completes), the **Running algorithms** line shows the sequence and the
displayed pseudocode is that of the called algorithm.

### Graph

- a **red arrow** marks an initial state, a **double circle** a final state;
- **orange** marks the state or transition being processed;
- **blue** marks the states still to be processed;
- a **dashed green ring** surrounds a computed set of states (successors, final
  states, states already seen…);
- during minimization, background colors identify the classes.

States are placed **from left to right** according to their distance from the
initial states, as Graphviz does in the notebook. Each state's position is
computed once for the whole construction: a created state appears directly at
its final place and does not move afterwards. Creations of states and
transitions are animated: the state grows and the transition is drawn from its
origin. Arcs that skip columns or go backwards are curved, and labels over a
large alphabet are abbreviated (`0–9`, `Σ∖{0–9}` for “anything but a digit”;
the details appear on hover).

You can **drag a state** to improve the drawing; the new position is kept for
the whole visualization. **Rearrange** restores the computed layout. The wheel
and the `+` / `−` buttons zoom, dragging the background pans the view and
**Reset view** restores the framing. **Enlarge** gives the graph more room. The
previews of A and B follow the same rules and, during a construction,
highlight the relevant states of the original automaton (for instance the set
of states represented by the current state of the determinization).

### Additional panels

- **Runs** (word recognition): runs appear as `0 ─a→ 1 ─b→ 2`, with blocked
  branches and, once the word has been read, accepting runs.
- **Current partition** (minimization): the classes and, for each state, its
  signature (its class and the class reached by each letter). Two states stay
  in the same class exactly when their signatures match.

After a construction or transformation, **Use result as automaton A** copies
the resulting automaton into field A. Its states are renumbered to match the
input format; you must then choose the next operation, even if it is the same
one. An input error is displayed and the previous visualization remains
visible.

## Available operations

The algorithms follow the behavior of the practical's model solution (same
steps, same state labels, for example `{0,1}` for determinization, `bot` for
the sink, `2_0` for the renamed states of B, `j` for the state added by the
star).

### Construction and traversal

| Operation | Principle and parameters |
|---|---|
| Add a state | Identifier and initial / final attributes; returns False if the identifier already exists |
| Remove a state | Removes the state and its incident transitions |
| Add a transition | Source, symbol and destination; a missing state is added |
| Remove a transition | Source, symbol and destination of an existing transition |
| Successors of a set | Space-separated starting states and the symbol to follow |
| Recognize a word | Set of reached states after each letter, then acceptance or rejection |
| Test determinism | One initial state and at most one successor per state and symbol |
| Test completeness | A transition for each letter of the alphabet, on reachable states |

### Transformations and operations on languages

| Operation | Visualized construction |
|---|---|
| Complete | If the automaton is not complete: sink state `bot`, then the missing transitions, letter by letter |
| Determinize | Reachable subset construction |
| Complement | Determinization if needed, completion if needed, swap of final and non-final states |
| Intersection | Product of automata A and B (possibly nondeterministic); both components must be final |
| Union | Completion of both automata, then product; one final component is enough |
| Concatenation | Copies of A and B, joining transitions, without ε-transitions |
| Positive closure | Joining transitions to the initial states |
| Kleene star | Positive closure plus an isolated initial and final state to accept ε |
| Moore minimization | Determinization, completion, successive refinements of the partition, quotient automaton |

Minimization (lecture 5bis) is not part of the practical; it is presented in
the same spirit.

## Conventions and limits

- As in the practical, the completeness **test** only considers states
  reachable from the initial states; completion does nothing if this test
  succeeds.
- Determinization does not create a transition to the empty set; completion
  adds a sink if needed.
- Two deliberate differences from the model solution, which gave a wrong
  language in special cases: **union** gives a distinct identifier to each
  pair of initial states, and **concatenation** keeps isolated states (the
  model solution lost them, which could lose the empty word).
- If one of the two automata of the **union** has no initial state, the product
  is empty: the product construction then does not yield the union, and the
  visualization says so.
- A visualization is limited to **150 states**, **1,500 transitions** and
  **6,000 steps**; a word to recognize to 60 letters. Exceeding a limit is reported. Some constructions can be
  exponential.
- For recognition, the display of runs is limited to **256 branches** and
  **4,000 run states**. If this limit is reached, path display stops and says
  so; the result remains exact.
- The site neither saves nor transmits any data.

## Project structure

```text
index.html               Interface and controls
style.css                Presentation and responsive layout
automata.js              Input parsing and step-by-step algorithms
pseudo.js                Bilingual pseudocode shown during execution
layout.js                Layered placement, arcs and labels
app.js                   Animated SVG rendering, player and interactions
i18n.js                  Interface texts and step messages (French and English)
README.en.md             This English documentation
help-content.js          Built-in bilingual documentation for offline use
scripts/update-help.js   Generates help from the README files
tests/automata.test.js   Algorithm tests with Node.js
tests/layout.test.js     Layout tests
tests/i18n.test.js       Translation and pseudocode tests
tests/help.test.js       Checks help content and synchronization
LICENSE                  Full license text
```

Each algorithm produces a sequence of steps containing the observed automaton,
a message (translation key and parameters), the pseudocode line and the items
to highlight. Steps of the same construction share a common layout; the SVG
renderer, without external libraries, only updates what changes from one step
to the next, which makes it possible to animate creations and removals.

After any change to the README or its English translation, keep both texts
consistent, then run `node scripts/update-help.js` from the project folder to
refresh the documentation built into Help. This generation is needed so Help
also works when the site is opened directly from disk, without a server.

## Tests

With a recent Node.js version, from the project folder:

```sh
node --test tests/*.test.js
```

The tests check input parsing, pseudocode coverage (every line is highlighted
by at least one run), translations, the languages produced by each
construction on random nondeterministic automata, minimality of quotient
automata, and several behaviors of the model solution.

## Author and license

Author: **Antoine Genitrini**.

Copyright © 2026 Antoine Genitrini.

This software is distributed under the **GNU General Public License, version
3** only (SPDX: `GPL-3.0-only`). It is provided without warranty; see the full
text in [LICENSE](./LICENSE).
