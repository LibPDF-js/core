---
description: Review developer experience and API ergonomics
argument-hint: <module-or-feature (optional)>
---

You are reviewing the developer experience (DX) of the library to ensure it feels good to use. As a library consumed by other developers, ergonomics matter as much as functionality.

## Your Task

1. **Identify scope** - Review `$ARGUMENTS` if provided, otherwise review the main public API
2. **Analyze the API surface** - How do developers interact with this code?
3. **Evaluate ergonomics** - Is it intuitive, consistent, and pleasant to use?
4. **Report findings** - Document issues and recommendations

## DX Evaluation Criteria

### 1. Discoverability

- Can developers find what they need?
- Are method names intuitive and searchable?
- Is the API surface appropriately sized (not too sprawling)?

### 2. Consistency

- Do similar operations work the same way?
- Are naming conventions consistent across the API?
- Do return types follow predictable patterns?

### 3. Ergonomics

- Is the common case easy? (pit of success)
- Are required parameters actually required?
- Do defaults make sense for typical usage?
- Is there unnecessary boilerplate?

### 4. Error Experience

- Are errors actionable? (tells you what went wrong AND how to fix it)
- Do errors surface at the right time? (fail fast)
- Are error types specific enough to catch programmatically?

### 5. Type Experience

- Does autocomplete guide developers?
- Are types precise (not too wide like `any` or `string`)?
- Do generics add value or just complexity?

### 6. Documentation in Code

- Are public methods documented with JSDoc?
- Do examples in comments actually work?
- Are parameter constraints documented?

### 7. Comparison to Standards

- How does this compare to similar libraries developers know?
- Does it follow platform conventions (Node.js, Web APIs)?
- Would a developer's intuition from other libraries apply here?

## Review Process

### Step 1: Use the API

Put yourself in a consumer's shoes:

- What would a developer try first?
- What questions would they have?
- Where would they get stuck?

### Step 2: Read the Types

Examine the TypeScript definitions:

- What does autocomplete show?
- Are overloads clear or confusing?
- Do type errors make sense?

### Step 3: Trace Common Workflows

Walk through typical tasks:

- Opening a PDF and reading metadata
- Modifying form fields
- Saving changes
- Handling errors

### Step 4: Look for Friction

Identify pain points:

- Unnecessary ceremony or boilerplate
- Confusing parameter orders
- Inconsistent patterns
- Missing conveniences

## Output Format

Write your review to `.agents/scratch/dx-review-<scope>.md`:

````markdown
# DX Review: <Scope>

## Summary

Overall assessment and top priorities.

## What's Working Well

- Positive patterns to preserve

## Issues Found

### Issue 1: <Title>

**Severity:** High/Medium/Low
**Category:** Discoverability/Consistency/Ergonomics/Errors/Types/Docs

**Problem:**
Description of the issue from a developer's perspective.

**Example:**

```typescript
// Current awkward usage
```
````

**Recommendation:**

```typescript
// Proposed improvement
```

### Issue 2: ...

## Recommendations Summary

Prioritized list of changes to improve DX.

## Comparison Notes

How we compare to pdf-lib, pdfjs, or other libraries developers might know.

```

## Guidelines

- **Be specific** - Vague feedback isn't actionable
- **Show, don't tell** - Include code examples
- **Prioritize** - Not all issues are equal
- **Be constructive** - Propose solutions, not just problems
- **Consider tradeoffs** - Note when fixing one thing might hurt another
- **Think like a user** - You're advocating for developers who will use this

## Begin

Review `$ARGUMENTS` (or the main API if not specified) and document your DX findings.
```
