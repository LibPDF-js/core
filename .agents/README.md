# .agents

This directory is used by AI agents to track their work, planning, and decision-making process.

## Top-Level Files

### GOALS.md

High-level goals and priorities for the library. Check this before starting new features to ensure work aligns with project direction.

### ARCHITECTURE.md

Current architecture documentation. Review before making architectural changes; update after significant changes to keep it accurate.

## Directories

### plans/

Contains planning documents created during planning mode. These help track the approach and steps for implementing features or solving problems.

**Naming convention**: Use sequential numbering with a descriptive name:

```
001-scanner.md
002-pdf-objects.md
003-token-reader.md
...
011-encryption.md
```

To find the next number, check the existing files and increment.

### justifications/

Contains documents explaining why the agent made specific decisions. This provides transparency and helps with future reference when understanding past choices.

### scratch/

Temporary workspace for notes, drafts, and work-in-progress content that doesn't need to be preserved long-term.
