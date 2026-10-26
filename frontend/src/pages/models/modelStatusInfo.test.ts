import { describe, expect, it } from 'vitest';
import type { GridCluster, ManagedModel } from '../../api/types';
import { modelDisplayStatus, PARTIALLY_AVAILABLE } from './modelStatusInfo';

const cluster = (name: string, location: string): GridCluster =>
  ({
    name,
    status: 'Ready',
    aiGridEnabled: true,
    provisioned: true,
    provisioningStatus: 'Provisioned',
    location,
    resourceVersion: '1',
    labels: {},
  }) as GridCluster;

const model = (partial: Partial<ManagedModel>): ManagedModel => ({
  name: 'demo',
  namespace: 'ai-grid-models',
  modelRef: { kind: 'LLMInferenceService', name: 'demo' },
  resourceVersion: '1',
  locations: [],
  phase: 'Pending',
  ...partial,
});

describe('modelDisplayStatus', () => {
  const clusters = [cluster('site-paris-1', 'paris'), cluster('site-madrid-1', 'madrid')];

  it('is Partially available when some locations are Ready and others are not', () => {
    expect(
      modelDisplayStatus(
        model({
          phase: 'Failed',
          locations: ['madrid', 'paris'],
          works: [
            { cluster: 'site-madrid-1', phase: 'Failed' },
            { cluster: 'site-paris-1', phase: 'Ready' },
          ],
        }),
        clusters,
      ),
    ).toBe(PARTIALLY_AVAILABLE);
  });

  it('is Ready when every location is Ready', () => {
    expect(
      modelDisplayStatus(
        model({
          phase: 'Pending',
          locations: ['madrid', 'paris'],
          works: [
            { cluster: 'site-madrid-1', phase: 'Ready' },
            { cluster: 'site-paris-1', phase: 'Ready' },
          ],
        }),
        clusters,
      ),
    ).toBe('Ready');
  });

  it('uses the backend phase when there are no locations', () => {
    expect(modelDisplayStatus(model({ phase: 'Failed', locations: [] }), clusters)).toBe('Failed');
  });
});
