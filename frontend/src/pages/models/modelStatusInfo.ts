import type { GridCluster, ManagedModel } from '../../api/types';
import { siteDeploymentsOf } from './modelUtils';

/**
 * What the terminal Ready=False reasons (KServe's ConfigNotFound, RefsInvalid, GatewaysNotReady;
 * see mock/areas/models.md) mean to an administrator, and what to do next.
 */
export const failureExplanations: Record<string, { summary: string; next: string }> = {
  ConfigNotFound: {
    summary: 'A runtime template this model needs isn’t installed on the hub.',
    next: 'Install the template on the hub, or deploy the model with another runtime.',
  },
  RefsInvalid: {
    summary: 'The model refers to a resource that doesn’t exist or isn’t valid.',
    next: 'Check the model URI and the runtime, then deploy the model again.',
  },
  GatewaysNotReady: {
    summary: 'The gateway that serves this model isn’t ready.',
    next: 'Check the AI Grid gateway on the hub.',
  },
};

/** Display status when some locations are Ready and others are not. */
export const PARTIALLY_AVAILABLE = 'Partially available';

export const modelPhase = (model: ManagedModel): string => model.phase ?? 'Pending';

/**
 * Status shown in the Models list and details: the backend phase, except a placed model with
 * mixed per-location readiness reads as Partially available (warning), and all locations Ready
 * reads as Ready even when the rollout has not finished reporting Complete.
 */
export const modelDisplayStatus = (model: ManagedModel, clusters: GridCluster[]): string => {
  const sites = siteDeploymentsOf(model, clusters);
  if (sites.length === 0) {
    return modelPhase(model);
  }
  const ready = sites.filter((site) => site.phase === 'Ready').length;
  if (ready > 0 && ready < sites.length) {
    return PARTIALLY_AVAILABLE;
  }
  if (ready === sites.length) {
    return 'Ready';
  }
  return modelPhase(model);
};

/** The status's title: "Deployment failed" for Failed, else the display status. */
export const modelStatusTitle = (model: ManagedModel, clusters: GridCluster[] = []): string => {
  const status = modelDisplayStatus(model, clusters);
  return status === 'Failed' ? 'Deployment failed' : status;
};

/**
 * Whether the status label opens an explanation. Ready never does; other display statuses do
 * when the backend sent a reason or message.
 */
export const hasModelStatusDetails = (model: ManagedModel, clusters: GridCluster[] = []): boolean => {
  if (modelDisplayStatus(model, clusters) === 'Ready') {
    return false;
  }
  return !!(model.reason || model.statusMessage);
};
