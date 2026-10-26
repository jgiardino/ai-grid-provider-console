import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GridCluster, ManagedModel } from '../../api/types';
import { ModelStatusModal } from './ModelStatusModal';

const baseModel: ManagedModel = {
  name: 'granite-8b-instruct',
  namespace: 'ai-grid-models',
  displayName: 'Granite 8B Instruct',
  modelRef: { kind: 'LLMInferenceService', name: 'granite-8b-instruct' },
  resourceVersion: '1',
  locations: ['paris', 'madrid'],
  phase: 'Ready',
  creationTimestamp: '2026-10-14T20:10:06.000Z',
};

const clusters = [
  { name: 'paris-1', location: 'paris', status: 'Ready', aiGridEnabled: true, provisioned: true, labels: {}, resourceVersion: '1' },
  { name: 'madrid-1', location: 'madrid', status: 'Ready', aiGridEnabled: true, provisioned: true, labels: {}, resourceVersion: '1' },
] as GridCluster[];

describe('ModelStatusModal', () => {
  it('shows model name, status label, and Deployment status subtitle', () => {
    render(
      <ModelStatusModal
        model={{
          ...baseModel,
          phase: 'Failed',
          reason: 'ConfigNotFound',
          statusMessage: 'template missing',
          locations: ['paris'],
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('model-status-modal-title')).toHaveTextContent('Granite 8B Instruct');
    expect(screen.getByTestId('model-status-text')).toHaveTextContent('Failed');
    expect(screen.getByTestId('model-status-modal-subtitle')).toHaveTextContent('Deployment status');
    expect(screen.getByTestId('model-status-modal-subtitle').tagName).toBe('P');
    expect(screen.getByText('Deployment failed')).toBeVisible();
    expect(screen.getByText('A runtime template this model needs isn’t installed on the hub.')).toBeVisible();
  });

  it('offers a link to view per-location deployments when Partially available', async () => {
    const user = userEvent.setup();
    const onViewDeployments = vi.fn();
    render(
      <ModelStatusModal
        model={{
          ...baseModel,
          works: [
            { cluster: 'paris-1', phase: 'Ready' },
            { cluster: 'madrid-1', phase: 'Failed' },
          ],
        }}
        clusters={clusters}
        onClose={vi.fn()}
        onViewDeployments={onViewDeployments}
      />,
    );
    expect(screen.getByTestId('model-status-text')).toHaveTextContent('Partially available');
    expect(screen.getByTestId('model-status-modal-message')).toHaveTextContent(
      'One or more model deployments are not ready',
    );
    await user.click(screen.getByTestId('model-status-view-deployments'));
    expect(onViewDeployments).toHaveBeenCalled();
  });
});
