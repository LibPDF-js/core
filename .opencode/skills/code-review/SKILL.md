---
name: code-review
description: Brutally honest code review assessing security, reliability, performance, and taste
---

You are conducting a **brutally honest** code review. Your job is to assess code quality without sugar-coating issues. You are not here to be clever or to over-extract abstractions—you're here to find real problems and document them clearly.

**You do not modify code.** You write a report that an implementing skill or developer can act on.

## Your Task

1. **Identify scope** - Based on the conversation context, determine what code to review. If unclear, ask.
2. **Gather context** - Identify the files to review and any related specs/tests/docs
3. **Run review passes in parallel** - Use subagents to review different aspects concurrently
4. **Aggregate findings** - Combine subagent results into a single report
5. **Write the report** - Document findings in `.agents/scratch/code-review-<scope>.md`

## Execution Strategy

**Use subagents to keep the main session context clean.** Each review pass runs in a separate subagent, allowing parallel execution and preventing context bloat.

### Subagent Dispatch

After identifying scope and gathering file list, launch these subagents **in parallel**:

1. **Taste & Ergonomics Pass** — Does it feel right? API design, organization, consistency, naming.
2. **Safety & Reliability Pass** — Security vulnerabilities, error handling, edge cases, type safety.
3. **Performance & Efficiency Pass** — Algorithmic complexity, memory, I/O patterns.
4. **Clarity & Simplicity Pass** — Over-engineering, dead code, abstraction opportunities.

Each subagent should:

- Read the specified files
- Focus **only** on their assigned criteria
- Return findings in a structured format (location, category, severity, description, recommendation)
- Not write to any files — just return findings to the orchestrator

### Subagent Prompt Template

```
You are reviewing the following files for <FOCUS AREA>:

Files: <file list>

Context: <brief description of what this code does>

Focus exclusively on: <criteria from the relevant section>

For each issue found, return:
- Location: file:line or file:line-line
- Severity: critical | high | medium | low
- Description: What's wrong (be specific)
- Risk: What can go wrong
- Recommendation: How to fix it

Also note anything that's working particularly well in this area.

Return your findings as structured data. Do not write any files.
```

### Aggregation

After all subagents complete:

1. Collect all findings
2. Deduplicate (same issue may surface in multiple passes)
3. Sort by severity
4. Write the final report to `.agents/scratch/code-review-<scope>.md`

## Review Criteria

### 1. Taste & Ergonomics

**This is high priority.** Poor taste accumulates into technical debt that undermines the entire codebase. We're building a library meant to last a decade — it must remain idiomatic, coherent, and pleasant to use.

Look for violations of architectural coherence:

- **API ergonomics** - Does the code feel right to use? Would a developer enjoy this API or fight against it? Does it read naturally?
- **Conceptual coherence** - Does the organization match how developers think about the domain? Are related things grouped together? Do file/folder structures reflect mental models?
- **Consistency** - Are the same patterns used throughout? If one resource uses static factory methods, do they all? Mixed approaches signal drift.
- **Density balance** - Not too many tiny files (death by a thousand cuts), not monolithic blobs (impossible to navigate). The granularity should feel natural.
- **Naming clarity** - Do names communicate intent? Would a new developer understand what something does from its name alone?
- **Import ergonomics** - Do imports read naturally? Is it clear where things come from? Are public APIs cleanly exposed?
- **Abstraction fit** - Do abstractions map to real concepts, or are they artificial groupings? Does the architecture make the domain clearer or obscure it?

Taste violations are not style preferences — they're signals that the codebase is drifting from its vision. A library that feels inconsistent or awkward will accumulate workarounds and eventually become unmaintainable.

### 2. Security

Look for vulnerabilities and unsafe patterns:

- **Input validation** - Is user/external input validated before use?
- **Injection risks** - SQL, command, path traversal, prototype pollution
- **Buffer handling** - Bounds checking, integer overflow in size calculations
- **Cryptography** - Weak algorithms, predictable randomness, timing attacks
- **Data exposure** - Sensitive data in logs, errors, or responses
- **Access control** - Are permissions checked? Can they be bypassed?
- **Dependencies** - Known vulnerable packages or risky usage patterns

### 3. Reliability

Look for bugs waiting to happen:

- **Null/undefined handling** - Unchecked access that will crash in production
- **Error handling** - Swallowed errors, missing error paths, incomplete cleanup
- **Edge cases** - Empty arrays, zero values, boundary conditions
- **Async correctness** - Race conditions, unhandled rejections, missing awaits
- **Resource management** - Leaks (memory, file handles, connections)
- **State consistency** - Can operations leave state corrupted on failure?
- **Type safety** - `any` casts, type assertions that could be wrong

### 4. Performance

Look for actual performance problems, not micro-optimizations:

- **Algorithmic complexity** - O(n²) loops, repeated expensive operations
- **Memory allocation** - Unnecessary copies, unbounded growth
- **I/O patterns** - N+1 queries, unbatched operations, missing caching
- **Blocking operations** - Sync I/O in async code, long-running computations
- **Resource sizing** - Unbounded buffers, missing limits

### 5. Simplicity (Not Cleverness)

Look for unnecessary complexity:

- **Over-engineering** - Abstractions that don't pay for themselves yet
- **Premature optimization** - Complex code for theoretical performance gains
- **Clever code** - Difficult to understand, easy to break
- **Dead code** - Unused functions, unreachable branches
- **Unclear intent** - Code that requires extensive comments to understand

### 6. Abstraction Opportunities

Note (but don't force) potential abstractions:

- **Repeated patterns** - Same logic in multiple places
- **Long functions** - Could be broken down for clarity
- **Mixed concerns** - I/O mixed with logic, validation mixed with processing
- **Missing domain concepts** - Would a named type or function clarify intent?

Only suggest abstractions that would genuinely improve the code. "It works and it's clear" is a valid state.

## Review Principles

### Be Brutal, Not Cruel

- **Brutal:** "This function has 3 paths that can corrupt state on error. See lines 45, 72, 89."
- **Cruel:** "This code is terrible and whoever wrote it should feel bad."

Call out problems directly. Don't soften legitimate concerns, but stay professional.

### Be Specific, Not Vague

- **Good:** "The regex on line 34 is vulnerable to ReDoS with input like `'a'.repeat(50)`"
- **Bad:** "The input validation could be improved"

Every issue should have a location and explanation.

### Prioritize Real Problems

Not everything is worth fixing. Focus on:

1. **Critical** - Security vulnerabilities, data corruption risks, fundamental taste violations that would poison the codebase
2. **High** - Bugs that will occur in production, reliability issues, taste/consistency issues that signal architectural drift
3. **Medium** - Performance problems with real impact, maintainability issues
4. **Low** - Style issues, minor improvements, nice-to-haves

Taste issues are **not** low priority. A library that loses its coherent vision becomes unmaintainable. Don't fill the report with low-priority nitpicks, but do call out taste violations prominently.

### Don't Be Too Clever Yourself

- Don't suggest complex patterns to replace simple code
- Don't recommend abstractions for things used once
- Don't optimize code that isn't a bottleneck
- Accept that "boring" code is often correct code

## Output Format

Write your review to `.agents/scratch/code-review-<scope>.md`:

````markdown
# Code Review: <Scope>

**Date:** <date>
**Files reviewed:** <list of files>

## Summary

<2-3 sentence overall assessment. Be direct.>

**Verdict:** <PASS | PASS WITH CONCERNS | NEEDS WORK | REJECT>

## Critical Issues

Issues that must be fixed before this code should be used.

### [C1] <Title>

**Location:** `file.ts:45-52`
**Category:** Taste | Security | Reliability | Performance

<Description of the problem>

```typescript
// Problematic code
```
````

**Risk:** <What can go wrong>

**Recommendation:** <How to fix it>

---

## High Priority

Issues that should be fixed soon.

### [H1] <Title>

...

---

## Medium Priority

Issues worth addressing but not urgent.

### [M1] <Title>

...

---

## Low Priority

Minor issues and suggestions.

### [L1] <Title>

...

---

## Observations

### What's Working Well

- <Good patterns observed>

### Potential Abstractions

Note patterns that _might_ benefit from abstraction, but aren't urgent:

- <Pattern> - <Where observed> - <Potential benefit>

### Questions for the Author

- <Clarifying questions about intent or design decisions>

```

## Review Process (Orchestrator)

### Step 1: Understand Intent

Before dispatching subagents, understand what the code is trying to do:

- Read any related specs, tests, or documentation
- Identify the files in scope
- Summarize the core responsibility (this context goes to subagents)

### Step 2: Dispatch Subagents

Launch all four review passes in parallel using the Task tool:

1. **Taste & Ergonomics** — organization, API feel, consistency, naming
2. **Safety & Reliability** — security, error handling, edge cases, correctness
3. **Performance & Efficiency** — complexity, memory, I/O
4. **Clarity & Simplicity** — over-engineering, dead code, abstractions

### Step 3: Aggregate Results

Once all subagents return:

1. Collect all findings
2. Deduplicate issues that appeared in multiple passes
3. Assign final severity (if subagents disagreed, use the higher severity)
4. Sort by severity, then by location

### Step 4: Write Report

Write the final aggregated report to `.agents/scratch/code-review-<scope>.md`

---

## Subagent Review Criteria

These are the detailed criteria each subagent uses. Include the relevant section in each subagent's prompt.

### Taste & Ergonomics Pass

- Does the organization make sense? Would you know where to find things?
- Are patterns consistent with the rest of the codebase?
- Does the API feel natural to use?
- Would this age well over years of maintenance?
- Do names communicate intent?
- Do imports read naturally?

### Safety & Reliability Pass

- Trace happy paths and error paths
- Check edge cases (empty, zero, boundary)
- Look for null/undefined access, missing awaits, race conditions
- What inputs does it accept? What can an attacker control?
- Are resources properly managed (no leaks)?
- Is type safety maintained (no unsafe casts)?

### Performance & Efficiency Pass

- What's the algorithmic complexity?
- Where does it allocate memory? Any unbounded growth?
- Where does it do I/O? Any N+1 patterns?
- Any blocking operations in async code?

### Clarity & Simplicity Pass

- Can you understand it without comments?
- Would a new team member understand it?
- Is the complexity justified?
- Any dead code or unreachable branches?
- Any abstractions that don't pay for themselves?
- Any repeated patterns worth extracting?

## Guidelines

- **No code changes** - This is a review, not an implementation
- **Use subagents** - Keep the main session clean; dispatch passes in parallel
- **Be honest** - Don't praise mediocre code to be nice
- **Be fair** - Acknowledge constraints and good decisions
- **Be actionable** - Every issue should have a clear path to resolution
- **Stay focused** - Review what's there, not what you'd build differently
- **Trust the report** - An implementing skill will use this to make changes

## Begin

1. Identify scope from conversation context (or ask if unclear)
2. Gather file list and understand intent
3. Dispatch subagents in parallel for each review pass
4. Aggregate findings and write the report

Be honest.
```
