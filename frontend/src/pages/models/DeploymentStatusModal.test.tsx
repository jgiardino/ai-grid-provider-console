import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ManagedModel } from '../../api/types';
import { DeploymentStatusModal, siteDeploymentConditions } from './DeploymentStatusModal';

const model: ManagedModel = {
  name: 'granite-8b-instruct',
  namespace: 'ai-grid-models',
  displayName: 'Granite 8B Instruct',
  modelRef: { kind: 'LLMInferenceService', name: 'granite-8b-instruct' },
  resourceVersion: '1',
  locations: ['paris'],
  phase: 'Ready',
  creationTimestamp: '2026-10-14T20:10:06.000Z',
};

describe('siteDeploymentConditions', () => {
  it('marks every step success when the site is Ready', () => {
    const steps = siteDeploymentConditions('Ready', model.creationTimestamp);
    expect(steps.every((step) => step.status === 'True')).toBe(true);
    expect(steps.map((step) => step.type)).toContain('DeploymentRequested');
    expect(steps.map((step) => step.type)).toContain('Ready');
  });

  it('fails the workload and ready steps when the site is Failed', () => {
    const steps = siteDeploymentConditions('Failed', model.creationTimestamp);
    expect(steps.find((step) => step.type === 'DeploymentRequested')?.status).toBe('True');
    expect(steps.find((step) => step.type === 'WorkloadsReady')?.status).toBe('False');
    expect(steps.find((step) => step.type === 'Ready')?.status).toBe('False');
  });
});

describe('DeploymentStatusModal', () => {
  it('opens the progress tab with stop and edit actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onEdit = vi.fn();
    const onStop = vi.fn();
    render(
      <DeploymentStatusModal
        model={model}
        deployment={{ id: 'paris', location: 'paris', phase: 'Ready' }}
        locationLabel="Paris DC1 (paris)"
        onClose={onClose}
        onEdit={onEdit}
        onStop={onStop}
      />,
    );
    expect(screen.getByTestId('deployment-status-modal')).toBeVisible();
    const header = screen.getByTestId('deployment-status-modal-header');
    expect(header).toHaveTextContent('Granite 8B Instruct');
    expect(screen.getByTestId('deployment-status-title')).toBeVisible();
    expect(screen.getByTestId('model-status-text')).toHaveTextContent('Ready');
    const subtitle = screen.getByTestId('deployment-status-subtitle');
    expect(subtitle.tagName).toBe('P');
    expect(subtitle).toHaveTextContent(/Deployment status for/);
    expect(screen.getByTestId('deployment-status-location')).toHaveTextContent('Paris DC1 (paris)');
    expect(within(subtitle).getByTestId('deployment-status-location')).toBeVisible();
    expect(screen.getByTestId('deployment-status-steps')).toBeVisible();
    expect(screen.queryByText('Granite 8B Instruct status')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('deployment-status-edit-button'));
    expect(onEdit).toHaveBeenCalled();
    await user.click(screen.getByTestId('deployment-status-stop-button'));
    expect(onStop).toHaveBeenCalled();
  });
});
