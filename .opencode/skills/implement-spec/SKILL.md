---
name: implement-spec
description: Implement a spec from the plans directory
---

You are implementing a specification from the `.agents/plans/` directory. Work autonomously until the feature is complete and tests pass.

## Your Task

1. **Determine the spec** - Based on the conversation context, identify which spec file in `.agents/plans/` to implement. Ask the user if multiple specs exist or if unclear.
2. **Read the spec** - Load the identified specification file
3. **Read ARCHITECTURE.md** - Understand the project's layered architecture and how your feature fits into the high-level/low-level API structure
4. **Read CODE_STYLE.md** for formatting conventions
5. **Plan the implementation** using the TodoWrite tool to break down the work
6. **Implement the feature** following the spec and code style
7. **Write tests** for all new functionality
8. **Run tests** and fix any failures
9. **Run typecheck and lint** and fix any issues

## Implementation Guidelines

### Before Coding

- Understand the spec's goals and scope
- Identify the desired API from usage examples in the spec
- Review related existing code to understand patterns
- **Consult ARCHITECTURE.md** - Determine which layer(s) your feature belongs to and how it fits into the overall structure
- Break the work into discrete tasks using TodoWrite

### Architecture Patterns

Most features should implement both low-level and high-level variants:

**Low-level first**:

- Direct manipulation of PDF COS objects (`PdfDict`, `PdfArray`, `PdfStream`)
- Core functionality without ergonomic abstractions
- Typically in `src/core/` or appropriate layer directory

**High-level adapter**:

- User-friendly methods on main classes (`PDF`, `PDFPage`, etc.)
- Validates inputs, provides defaults, handles edge cases
- Delegates to low-level implementation

Example structure:

```
src/
├── core/
│   └── shading.ts          # Low-level: PdfStream creation
└── api/
    └── page.ts             # High-level: page.drawGradient()
```

### During Implementation

- Follow CODE_STYLE.md strictly (2-space indent, double quotes, braces always, etc.)
- Use `#src/*` import alias for internal imports
- Co-locate tests as `*.test.ts` files
- Write tests as you go, not at the end
- Mark todos complete as you finish each task
- Commit logical chunks of work

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
2. **Test** - Run `bun run test` to verify
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

Identify the spec file from the conversation context, read it along with CODE_STYLE.md, then start implementing. Use TodoWrite to track your progress throughout.
