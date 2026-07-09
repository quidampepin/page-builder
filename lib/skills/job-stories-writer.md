---
name: job-stories-writer
description: >
  Write Job Stories, usability testing scenarios, and user need statements from user feedback, rough notes, or research data.
  Use this skill whenever the user wants to: write or generate job stories, create usability testing scenarios or tasks, turn user feedback into structured stories, write user need statements, analyze user research or feedback comments, or convert rough notes into structured UX/product artifacts.
  Trigger on phrases like "write job stories", "create testing scenarios", "turn this feedback into", "user need statements", or when the user pastes a list of user comments and wants them structured.
---

# Job Stories Writer

A skill for turning user feedback, rough notes, and research data into structured UX artifacts: Job Stories, usability testing scenarios, and user need statements.

---

## Job Stories

### Format
```
"When I [situation], I want to [motivation], so I can [expected outcome]."
```

### Process

1. **Extract themes** from input: group similar comments, identify patterns, recurring issues.
2. **For each theme**, define:
   - **Situation**: What triggers the user's need?
   - **Motivation**: What does the user want to achieve?
   - **Outcome**: What is the user's ultimate goal?
3. **Draft the story** using the format above.
4. **Prioritize**: Lead with the top 15 stories organized around the overall service/program process flow. Add lower-priority stories afterward.

### Guidelines
- Use plain, clear language — avoid jargon.
- Keep stories concise but complete.
- Ensure the motivation and outcome align logically with the situation.
- Avoid redundant or overly narrow stories unless they address critical edge cases.

### Example
**Input:** "I failed the citizenship test and don't know what to do next." / "What happens after failing three times?"

**Output:** "When I fail the citizenship test, I want to know the next steps, so I can continue with my application process."

---

## Usability Testing Scenarios

### Format
Present each scenario as a pair:

**Job Story**
When I [situation], I want to [motivation], so I can [expected outcome].

**Scenario**
[A concrete, realistic task the participant can actually answer or complete.]

### Rules for Writing Scenarios
- ✅ Write scenarios where the participant can give a **clear, verifiable answer**.
- ✅ Ask questions with a **definite answer** (yes/no, a specific number, a specific date, etc.).
- ❌ Do NOT ask "where would you go" or "where would you find" — ask what they would find or whether something is true.
- ❌ Avoid vague or open-ended tasks that can't be evaluated.

### Good scenario question patterns
- "Will she be allowed to…?"
- "Does he have to…?"
- "How much will X get every month?"
- "Which day in [month] will your payment be deposited?"
- "Should he apply for…?"
- "Which of the reasons below would cause…?"

### Bad scenario question patterns (avoid)
- "Where on the portal can you find…?"
- "Where would you go to…?"
- "How would you find…?"

### Examples

**Job Story:** When I move my mortgage to a new bank, I want the CRA to put my tax refund into the new account, so I can pay my mortgage on time.
**Scenario:** You renewed your mortgage and moved all your bank accounts to a new bank. What number would you call to get your personal tax refund deposited into your new bank account? *(Answer: 1-800-959-8281)*

**Job Story:** When I need to understand test exemptions, I want to know if my age affects my requirements, so I can prepare accordingly.
**Scenario:** You're 60 years old. Do you have to take the citizenship test?

---

## User Need Statements

### Format
```
Minimize + {the time OR the likelihood} + [object of control] + [optional contextual clarifier]
```

- **Object of Control**: The specific aspect being improved or reduced (e.g., errors made, time spent searching, likelihood of abandonment).
- Use "the time" when the focus is on duration or effort.
- Use "the likelihood" when the focus is on reducing errors, failures, or friction events.

### Examples
- "Minimize the time users spend searching for the correct form."
- "Minimize the likelihood of errors when submitting a benefits application."
- "Minimize the time to recover from a failed authentication attempt."

---

## Output Structure

When given raw input (feedback, notes, research):

1. **Top 15 Job Stories** — organized by the logical flow of the service or program process.
2. **Additional Job Stories** — lower priority, listed after.
3. **Usability Testing Scenarios** (if requested) — one scenario per job story, following the rules above.
4. **User Need Statements** (if requested) — derived from the job stories or themes.
