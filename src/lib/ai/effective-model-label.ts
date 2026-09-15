/** Chooses the model actually returned by a call, or the resolved target before it. */
export function effectiveModelLabel(resultModel: string | undefined, resolvedModel: string): string {
  return resultModel ?? resolvedModel;
}
