import { describe, expect, it } from 'vitest';
import type { GridCluster, ManagedModel } from '../../api/types';
import { siteDeploymentsOf } from './modelUtils';

const cluster = (name: string, location?: string): GridCluster =>
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

const model = (partial: Partial<ManagedModel> & Pick<ManagedModel, 'locations'>): ManagedModel => ({
  name: 'demo',
  namespace: 'ai-grid-models',
  modelRef: { kind: 'LLMInferenceService', name: 'demo' },
  resourceVersion: '1',
  phase: 'Ready',
  ...partial,
});

describe('siteDeploymentsOf', () => {
  const clusters = [
    cluster('site-paris-1', 'paris'),
    cluster('site-madrid-1', 'madrid'),
    cluster('site-frankfurt-1'),
    cluster('site-berlin-1'),
  ];

  it('lists the same locations as the primary column, not every work cluster', () => {
    const rows = siteDeploymentsOf(
      model({
        locations: ['madrid', 'paris'],
        works: [
          { cluster: 'site-berlin-1', phase: 'Ready' },
          { cluster: 'site-frankfurt-1', phase: 'Ready' },
          { cluster: 'site-madrid-1', phase: 'Ready' },
          { cluster: 'site-paris-1', phase: 'Pending' },
        ],
      }),
      clusters,
    );
    expect(rows.map((row) => row.location)).toEqual(['madrid', 'paris']);
    expect(rows.find((row) => row.location === 'madrid')?.phase).toBe('Ready');
    expect(rows.find((row) => row.location === 'paris')?.phase).toBe('Pending');
  });

  it('uses the model phase when there are no works for a location', () => {
    expect(
      siteDeploymentsOf(model({ locations: ['paris'], phase: 'Pending', works: [] }), clusters),
    ).toEqual([{ id: 'paris', location: 'paris', phase: 'Pending' }]);
  });

  it('is empty when the primary Locations column is empty', () => {
    expect(
      siteDeploymentsOf(
        model({
          locations: [],
          works: [{ cluster: 'site-frankfurt-1', phase: 'Ready' }],
        }),
        clusters,
      ),
    ).toEqual([]);
  });
});
