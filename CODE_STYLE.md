# Code Style Guide

This document defines the code style conventions for @libpdf/core.

## Tooling

- **Formatter/Linter**: Biome with 2-space indentation, double quotes
- **Imports**: Use `#src/*` path alias for internal imports
- **Tests**: Co-located as `*.test.ts` files
- **No barrel files**: Avoid `index.ts` files that just re-export. Import directly from source files.

## Whitespace & Formatting

### Blank Lines Between Concepts

```typescript
// Blank line after imports
import { prisma } from "@documenso/prisma";

export const findDocuments = async () => {
  // ...
};

// Blank line between logical sections
const user = await prisma.user.findFirst({ where: { id: userId } });

let team = null;

if (teamId !== undefined) {
  team = await getTeamById({ userId, teamId });
}

// Blank line before return statements
const result = await someOperation();

return result;
```

### Function/Method Spacing

```typescript
// No blank lines between chained methods in same operation
const documents = await prisma.document
  .findMany({ where: { userId } })
  .then(docs => docs.map(maskTokens));

// Blank line between different operations
const document = await createDocument({ userId });

await sendDocument({ documentId: document.id });

return document;
```

### Object and Array Formatting

```typescript
// Multi-line when complex
const options = {
  userId,
  teamId,
  status: ExtendedDocumentStatus.ALL,
  page: 1,
};

// Single line when simple
const coords = { x: 0, y: 0 };

// Array items on separate lines when objects
const recipients = [
  {
    name: "John",
    email: "john@example.com",
  },
  {
    name: "Jane",
    email: "jane@example.com",
  },
];
```

### Control Flow

Always use braces for `if`, `else`, `for`, `while`, etc. — no single-line statements.

```typescript
// Bad: single-line if
if (condition) return early;

// Good: always use braces
if (condition) {
  return early;
}
```

### Prefer Early Returns Over Else

Avoid `else` and `else if` when possible. Early returns reduce nesting and make code easier to follow — once you hit an `else`, you have to mentally track "what was the condition again?" which is annoying.

```typescript
// Bad: else creates unnecessary mental context-switching
function getStatus(user: User): string {
  if (user.isAdmin) {
    return "admin";
  } else if (user.isModerator) {
    return "moderator";
  } else {
    return "user";
  }
}

// Good: early returns, flat structure
function getStatus(user: User): string {
  if (user.isAdmin) {
    return "admin";
  }

  if (user.isModerator) {
    return "moderator";
  }

  return "user";
}

// Bad: nested else blocks
function processData(data: Data | null): Result {
  if (data) {
    if (data.isValid) {
      return compute(data);
    } else {
      throw new Error("Invalid data");
    }
  } else {
    throw new Error("No data provided");
  }
}

// Good: guard clauses with early returns
function processData(data: Data | null): Result {
  if (!data) {
    throw new Error("No data provided");
  }

  if (!data.isValid) {
    throw new Error("Invalid data");
  }

  return compute(data);
}
```

Sometimes `else` is unavoidable (e.g., ternaries, complex branching where both paths continue), but don't reach for it by default.

## Naming Conventions

### Classes

- PDF object types: `Pdf` prefix (e.g., `PdfDict`, `PdfStream`, `PdfName`)
- Parsers: `*Parser` suffix (e.g., `ObjectParser`, `TokenReader`)
- Filters: `*Filter` suffix (e.g., `FlateFilter`, `LZWFilter`)

### Files

- Classes: kebab-case matching class name (e.g., `pdf-dict.ts`, `object-parser.ts`)
- Tests: Same name with `.test.ts` suffix (e.g., `pdf-dict.test.ts`)

### Methods

- Typed getters on PdfDict: `get*` pattern (e.g., `getName()`, `getNumber()`, `getBool()`)
- Async operations: Use descriptive verbs (e.g., `getDecodedData()`, `parse()`)

## Error Handling

- Throw descriptive errors with context
- Include relevant values in error messages
- Use recovery mode for lenient parsing when appropriate

```typescript
// Good: descriptive with context
throw new Error(`Invalid LZW code: ${code} at position ${position}`);

// Good: include what was expected vs received
throw new Error(`Expected /Type /ObjStm, got ${type?.value ?? "none"}`);
```

## Async Patterns

- All I/O operations are async
- Use `async/await` over raw promises
- Lazy initialization for expensive operations

```typescript
// Good: lazy async initialization
async parse(): Promise<void> {
  if (this.index !== null) {
    return; // Already parsed
  }

  this.decodedData = await this.stream.getDecodedData();
  this.index = this.parseIndex();
}
```

## Type Annotations

- Prefer inference where types are obvious
- Explicit return types on public methods
- Use `readonly` for immutable properties

```typescript
// Good: explicit return type on public method
async getObject(index: number): Promise<PdfObject | null> {
  // ...
}

// Good: readonly for immutable
readonly name = "FlateDecode";
```
