// How the wiki reaches the running corpus scan (MDX_FROM_MOUNT_SPEC D8).
//
// The default is the fork packaging's answer: the bundler's index is complete at boot, so
// every key is settled and there is nothing to prioritize. Only a dispatched viewer, which
// builds its index at runtime, provides a live scan here.
import { createContext } from 'react';
import type { CorpusScanGate } from './corpusScan';

const COMPLETE: CorpusScanGate = {
  isSettled: () => true,
  prioritize: () => undefined,
};

export const CorpusScanContext = createContext<CorpusScanGate>(COMPLETE);
