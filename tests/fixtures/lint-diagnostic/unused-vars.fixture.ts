/**
 * Fixture sintética: declaração não utilizada.
 * Deve disparar exatamente `@typescript-eslint/no-unused-vars`.
 */
export function unusedVarsFixture(value: number): number {
  const unusedConstant = value + 1;
  return value;
}
