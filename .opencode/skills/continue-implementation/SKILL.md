---
name: continue-implementation
description: Continue implementing a spec from a previous session
---

You are continuing implementation of a specification that was started in a previous session. Work autonomously until the feature is complete and tests pass.

## Your Task

1. **Determine the spec** - Based on the conversation context, identify which spec file in `.agents/plans/` to continue implementing. Ask the user if multiple specs exist or if unclear.
2. **Read the spec** - Load the identified specification file
3. **Read ARCHITECTURE.md** - Understand the project's layered architecture and ensure your implementation follows the high-level/low-level API pattern
4. **Read CODE_STYLE.md** for formatting conventions
5. **Assess current state**:
   - Check git status for uncommitted changes
   - Run tests to see what's passing/failing
   - Review any existing implementation
6. **Determine what remains** by comparing the spec to the current state
7. **Plan remaining work** using TodoWrite
8. **Continue implementing** until complete

## Assessing Current State

Run these commands to understand where the previous session left off:

```bash
git status                  # See uncommitted changes
git log --oneline -10       # See recent commits
bun run test:run            # See what tests pass/fail
bun run typecheck           # Check for type errors
```

Review the code that's already been written to understand:

- What's already implemented
- What's partially done
- What's not started yet

## Implementation Guidelines

### Architecture Awareness

Refer to ARCHITECTURE.md to ensure your implementation fits the layered structure:

- **Two API layers**: Implement low-level functionality first, then high-level adapters
- **Layer placement**: Add code to the appropriate layer (Objects, Parser, Drawing, etc.)
- **Design principles**: Follow lenient parsing, lazy loading, async-first patterns

### During Implementation

- Follow CODE_STYLE.md strictly (2-space indent, double quotes, braces always, etc.)
- Use `#src/*` import alias for internal imports
- Co-locate tests as `*.test.ts` files
- Write tests as you go, not at the end
- Mark todos complete as you finish each task
- Commit logical chunks of work

### Layer Separation

When continuing work, verify the architecture:

- Does low-level code avoid high-level abstractions?
- Does high-level code delegate to low-level implementation?
- Are tests at the appropriate level (unit tests for low-level, integration for high-level)?

### Code Quality

- No stubbed implementations or skipped tests
- Handle edge cases and error conditions
- Include descriptive error messages with context
- Use async/await for all I/O operations

### Testing

- Write tests first when practical (TDD)
- Test happy paths and edge cases
- Test error conditions
- Use fixtures from `fixtures/` directory with `loadFixture()`

## Autonomous Workflow

Work continuously through these steps:

1. **Implement** - Write the code for the current task
2. **Test** - Run `bun run test:run` to verify
3. **Fix** - If tests fail, fix and re-run
4. **Typecheck** - Run `bun run typecheck`
5. **Lint** - Run `bun run lint:fix`
6. **Repeat** - Move to next task

## Stopping Conditions

**Stop and report success when:**

- All spec requirements are implemented
- All tests pass
- Typecheck passes
- Lint passes

**Stop and ask for help when:**

- The spec is ambiguous and you need clarification
- You encounter a blocking issue you cannot resolve
- You need to make a decision that significantly deviates from the spec
- External dependencies or fixtures are missing

## Commands

```bash
bun run test                    # Run tests in watch mode
bun run test:run                # Run tests once
bun run test -- --grep "pattern" # Run specific tests
bun run typecheck           # Type check
bun run lint:fix            # Fix lint issues
```

## Begin

Identify the spec file from the conversation context, read it along with CODE_STYLE.md, assess the current implementation state, then continue where the previous session left off. Use TodoWrite to track your progress throughout.
