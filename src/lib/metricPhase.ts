/** Lifecycle of a displayed figure: Panel/Table/MetricState render one state per phase. */
export type MetricPhase = 'loading' | 'live' | 'empty' | 'error' | 'stale' | 'unfillable';

export const DASH = '-';
