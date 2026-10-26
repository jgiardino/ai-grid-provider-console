import { useState } from 'react';
import { ExpandableSection, Label, Popover, Stack } from '@patternfly/react-core';
import type { GridCluster, ManagedModel } from '../../api/types';
import { getPhaseProps } from '../../utilities/phaseLabelUtils';
import {
  failureExplanations,
  hasModelStatusDetails,
  modelDisplayStatus,
  modelPhase,
  modelStatusTitle,
} from './modelStatusInfo';

/**
 * The status in words: a sentence and the next step for a known failure, else the controller's
 * message; the controller's raw reason and message fold away under "Details".
 */
export const ModelStatusDetails: React.FC<{ model: ManagedModel }> = ({ model }) => {
  const known = model.reason ? failureExplanations[model.reason] : undefined;
  const failed = modelPhase(model) === 'Failed';
  if (!known && !failed) {
    return <>{model.statusMessage ?? model.reason}</>;
  }
  return (
    <Stack hasGutter>
      <p>{known?.summary ?? 'The controller couldn’t deploy this model.'}</p>
      {known && <p>{known.next}</p>}
      <ExpandableSection toggleText="Details">
        <code className="pf-v6-u-font-size-sm pf-v6-u-text-break-word">
          {[model.reason, model.statusMessage].filter(Boolean).join(': ')}
        </code>
      </ExpandableSection>
    </Stack>
  );
};

type LabelProps = {
  model: ManagedModel;
  /** Clusters used to derive per-location readiness for Partially available. */
  clusters?: GridCluster[];
  /**
   * When set (Models list), every non-Ready label opens this instead of a popover.
   * Ready stays outline and not clickable.
   */
  onOpen?: () => void;
};

/**
 * High-level model status: Ready is outline and not clickable; other statuses are filled.
 * On the Models list, `onOpen` opens ModelStatusModal; elsewhere a popover may explain failures.
 */
export const ModelStatusLabel: React.FC<LabelProps> = ({ model, clusters = [], onOpen }) => {
  const [open, setOpen] = useState(false);
  const status = modelDisplayStatus(model, clusters);
  const { icon, status: tone, color } = getPhaseProps(status);
  const isReady = status === 'Ready';
  const opensModal = !isReady && !!onOpen;
  const opensPopover = !isReady && !onOpen && hasModelStatusDetails(model, clusters);
  const label = (
    <Label
      icon={icon}
      status={tone}
      color={color}
      variant={isReady ? 'outline' : 'filled'}
      isClickable={opensModal || opensPopover}
      onClick={
        opensModal
          ? onOpen
          : opensPopover
            ? () => setOpen((previous) => !previous)
            : undefined
      }
    >
      {status}
    </Label>
  );
  return (
    <span data-testid="model-phase">
      {opensPopover ? (
        <Popover
          isVisible={open}
          shouldClose={() => setOpen(false)}
          headerContent={modelStatusTitle(model, clusters)}
          bodyContent={<ModelStatusDetails model={model} />}
        >
          {label}
        </Popover>
      ) : (
        label
      )}
    </span>
  );
};
