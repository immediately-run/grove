// The bundler's module evaluation, behind one seam (R3-1289).
//
// `module.getModuleEvaluationContext` is the sandbox bundler's hook: it transpiles and
// evaluates the module at an absolute path and hands back its exports — the same call
// `<Include>` makes for an entry body. It is a free identifier the bundler provides at
// runtime, so a test cannot reach it as a global (the test runner binds `module` itself);
// this module is the one place that names it, and what a test mocks instead.

declare const module: {
  getModuleEvaluationContext: (name: string) => Promise<{ exports: Record<string, unknown> }>;
};

/** Evaluate the module at `path` and return its exports. */
export async function evaluateModule(path: string): Promise<Record<string, unknown>> {
  return (await module.getModuleEvaluationContext(path)).exports;
}
