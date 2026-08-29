// The ambient `fs` + `module` types the immediately.run SANDBOX provides to app
// code — declared by the package that owns the surface: `@immediately-run/sdk`
// (R3-276b moved them there from `@immediately-run/dev-fs`, whose job is the local
// `vite dev` disk bridge, not the contract). One line, complete from sdk 0.49.0.
/// <reference types="@immediately-run/sdk/ambient" />
