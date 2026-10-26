import type { GridCluster, ManagedModel } from '../../api/types';

/** A model deployment's page. */
export const modelPath = (model: Pick<ManagedModel, 'namespace' | 'name'>) =>
  `/models/${encodeURIComponent(model.namespace)}/${encodeURIComponent(model.name)}`;

/** Each location's site name, from the first cluster at that location that has one. */
export const siteNamesOf = (clusters: GridCluster[]): Map<string, string> => {
  const names = new Map<string, string>();
  for (const cluster of clusters) {
    if (cluster.location && cluster.siteName && !names.has(cluster.location)) {
      names.set(cluster.location, cluster.siteName);
    }
  }
  return names;
};

/** "Paris DC1 (paris)", or the bare location when no cluster names its site. */
export const locationLabel = (location: string, siteNames: Map<string, string>): string => {
  const site = siteNames.get(location);
  return site ? `${site} (${location})` : location;
};

/** One row of the Models page's expandable per-site table. */
export type ModelSiteDeployment = {
  /** The location key; same set as the primary Locations column. */
  id: string;
  location: string;
  phase: string;
};

/** Worst phase among works at one location: Failed > Pending > Ready. */
const locationPhase = (phases: string[], fallback: string): string => {
  if (phases.some((phase) => phase === 'Failed')) {
    return 'Failed';
  }
  if (phases.length === 0) {
    return fallback;
  }
  if (phases.every((phase) => phase === 'Ready')) {
    return 'Ready';
  }
  return 'Pending';
};

/**
 * Deployments under an expanded model row: one row per decided `location` (the same list as the
 * primary Locations column). Status comes from rollout works on clusters at that location when
 * the backend reported them; otherwise the model's overall phase.
 */
export const siteDeploymentsOf = (model: ManagedModel, clusters: GridCluster[]): ModelSiteDeployment[] => {
  const fallback = model.phase ?? 'Pending';
  return model.locations.map((location) => {
    const clusterNames = new Set(
      clusters.filter((cluster) => cluster.location === location).map((cluster) => cluster.name),
    );
    const phases = (model.works ?? [])
      .filter((work) => clusterNames.has(work.cluster))
      .map((work) => work.phase);
    return { id: location, location, phase: locationPhase(phases, fallback) };
  });
};
