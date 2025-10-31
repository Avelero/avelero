# Check Code Quality

Run all quality checks to ensure code meets professional standards.

## Steps

1. Run TypeScript type checking:
   ```bash
   npm run type-check
   ```

2. Run ESLint to check for code quality issues:
   ```bash
   npm run lint
   ```

3. Check code formatting:
   ```bash
   npm run format:check
   ```

4. If there are issues, provide a summary of:
   - Number of TypeScript errors (if any)
   - Number of ESLint warnings/errors (if any)
   - Formatting issues (if any)

5. If all checks pass, confirm: "✅ All quality checks passed - code is ready for commit"

6. If there are issues, ask: "Would you like me to fix these issues automatically?"
