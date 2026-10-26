// Adapted from odh-dashboard packages/model-serving DeploymentStatusModal and
// llmd-serving getLLMdDeploymentConditions (Progress tab only).
import type { CSSProperties } from 'react';
import {
  Button,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ProgressStep,
  ProgressStepper,
  Stack,
  StackItem,
  Tab,
  Tabs,
  TabTitleText,
  Timestamp,
  TimestampTooltipVariant,
  Title,
} from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import type { ManagedModel } from '../../api/types';
import { getPhaseProps } from '../../utilities/phaseLabelUtils';
import type { ModelSiteDeployment } from './modelUtils';

type ConditionStatus = 'True' | 'False' | 'Unknown';

type DeploymentCondition = {
  type: string;
  label: string;
  status: ConditionStatus;
  lastTransitionTime?: string;
  message?: string;
  children?: DeploymentCondition[];
};

type Props = {
  model: ManagedModel;
  deployment: ModelSiteDeployment;
  locationLabel: string;
  onClose: () => void;
  onEdit?: () => void;
  onStop?: () => void;
};

const stepVariant = (status: ConditionStatus) => {
  if (status === 'True') {
    return 'success' as const;
  }
  if (status === 'False') {
    return 'danger' as const;
  }
  return 'pending' as const;
};

/**
 * Illustrative KServe-shaped progress for a site deployment. The fake exposes per-work
 * Applied/Available/ready, not the full LLMISvc condition tree, so steps are derived from the
 * site phase for the console demo (Ready / Pending / Failed).
 */
export const siteDeploymentConditions = (
  phase: string,
  baseTime: string | undefined,
): DeploymentCondition[] => {
  const start = baseTime ? new Date(baseTime).getTime() : Date.now();
  const at = (offsetSeconds: number) => new Date(start + offsetSeconds * 1000).toISOString();
  const ready = phase === 'Ready';
  const failed = phase === 'Failed';

  const trueAt = (offset: number): Pick<DeploymentCondition, 'status' | 'lastTransitionTime'> => ({
    status: 'True',
    lastTransitionTime: at(offset),
  });
  const pending = (): Pick<DeploymentCondition, 'status'> => ({ status: 'Unknown' });
  const falseAt = (
    offset: number,
    message: string,
  ): Pick<DeploymentCondition, 'status' | 'lastTransitionTime' | 'message'> => ({
    status: 'False',
    lastTransitionTime: at(offset),
    message,
  });

  const workload = ready
    ? trueAt(45)
    : failed
      ? falseAt(5, 'Failed to apply manifest work')
      : pending();
  const router = ready ? trueAt(15) : failed ? trueAt(5) : pending();
  const deploymentReady = ready ? trueAt(45) : failed ? falseAt(5, 'NotAsExpected') : pending();

  return [
    { type: 'DeploymentRequested', label: 'Deployment requested', ...trueAt(0) },
    {
      type: 'PresetsCombined',
      label: 'Presets combined',
      ...(ready || failed ? trueAt(5) : pending()),
    },
    {
      type: 'WorkloadsReady',
      label: 'Model workload',
      ...workload,
      children: [{ type: 'MainWorkloadReady', label: 'Main workload ready', ...workload }],
    },
    {
      type: 'RouterReady',
      label: 'Router / scheduler',
      ...router,
      children: [
        { type: 'GatewaysReady', label: 'Gateway ready', ...(ready || failed ? trueAt(5) : pending()) },
        {
          type: 'HTTPRoutesReady',
          label: 'HTTP routes ready',
          ...(ready ? trueAt(15) : failed ? trueAt(5) : pending()),
        },
      ],
    },
    { type: 'Ready', label: 'Deployment ready', ...deploymentReady },
  ];
};

const ConditionTimestamp: React.FC<{ isoString?: string }> = ({ isoString }) => {
  if (!isoString) {
    return null;
  }
  return (
    <Timestamp
      date={new Date(isoString)}
      tooltip={{ variant: TimestampTooltipVariant.default }}
      dateFormat="long"
      timeFormat="long"
    />
  );
};

const ConditionChildren: React.FC<{ children: DeploymentCondition[] }> = ({ children }) => (
  <ProgressStepper isVertical style={{ paddingTop: 'var(--pf-t--global--spacer--sm)' }}>
    {children.map((child) => (
      <ProgressStep
        key={child.type}
        variant={stepVariant(child.status)}
        aria-label={`${child.label}: ${child.status}`}
        id={`condition-child-${child.type}`}
        titleId={`condition-child-${child.type}-title`}
        description={<ConditionTimestamp isoString={child.lastTransitionTime} />}
        data-testid={`deployment-condition-${child.type}`}
      >
        {child.label}
      </ProgressStep>
    ))}
  </ProgressStepper>
);

/** Per-location deployment status: Progress tab with a KServe-shaped stepper (odh-dashboard). */
export const DeploymentStatusModal: React.FC<Props> = ({
  model,
  deployment,
  locationLabel: locationText,
  onClose,
  onEdit,
  onStop,
}) => {
  const title = model.displayName ?? model.name;
  const { icon, status, color } = getPhaseProps(deployment.phase);
  const conditions = siteDeploymentConditions(deployment.phase, model.creationTimestamp);

  return (
    <Modal
      variant="medium"
      isOpen
      onClose={onClose}
      data-testid="deployment-status-modal"
      aria-label={`${title} at ${locationText}`}
    >
      <ModalHeader
        data-testid="deployment-status-modal-header"
        style={{ '--pf-v6-c-modal-box__header--Gap': 'var(--pf-t--global--spacer--sm)' } as CSSProperties}
      >
        <Title headingLevel="h1" size="2xl" data-testid="deployment-status-title">
          <Flex gap={{ default: 'gapMd' }} alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>{title}</FlexItem>
            <FlexItem>
              <Label
                icon={icon}
                status={status}
                color={color}
                variant="filled"
                data-testid="model-status-text"
              >
                {deployment.phase}
              </Label>
            </FlexItem>
          </Flex>
        </Title>
        <p data-testid="deployment-status-subtitle">
          Deployment status for{' '}
          <Label color="grey" data-testid="deployment-status-location">
            {locationText}
          </Label>
        </p>
      </ModalHeader>
      <ModalBody>
        <Stack hasGutter>
          <StackItem>
            <Tabs activeKey="progress" aria-label="Deployment status tabs" data-testid="deployment-status-tabs">
              <Tab
                eventKey="progress"
                aria-label="progress"
                title={<TabTitleText>Progress</TabTitleText>}
                data-testid="deployment-status-progress-tab"
              />
            </Tabs>
          </StackItem>
          <StackItem>
            <Stack hasGutter>
              <StackItem>
                <HelperText data-testid="deployment-status-progress-disclaimer">
                  <HelperTextItem
                    variant="indeterminate"
                    icon={
                      <InfoCircleIcon style={{ color: 'var(--pf-t--global--color--nonstatus--purple--400)' }} />
                    }
                    style={{ fontWeight: 'var(--pf-t--global--font--weight--body--bold)' }}
                  >
                    Steps may occur in any order, depending on the deployment type.
                  </HelperTextItem>
                </HelperText>
              </StackItem>
              <StackItem>
                <ProgressStepper isVertical data-testid="deployment-status-steps">
                  {conditions.map((condition) => (
                    <ProgressStep
                      key={condition.type}
                      variant={stepVariant(condition.status)}
                      aria-label={`${condition.label}: ${condition.status}`}
                      id={`condition-${condition.type}`}
                      titleId={`condition-${condition.type}-title`}
                      description={
                        <>
                          <ConditionTimestamp isoString={condition.lastTransitionTime} />
                          {condition.children && condition.children.length > 0 && (
                            <ConditionChildren>{condition.children}</ConditionChildren>
                          )}
                        </>
                      }
                      data-testid={`deployment-condition-${condition.type}`}
                    >
                      {condition.label}
                    </ProgressStep>
                  ))}
                </ProgressStepper>
              </StackItem>
            </Stack>
          </StackItem>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Flex gap={{ default: 'gapMd' }}>
          {onStop && (
            <FlexItem>
              <Button variant="primary" onClick={onStop} data-testid="deployment-status-stop-button">
                Stop deployment
              </Button>
            </FlexItem>
          )}
          {onEdit && (
            <FlexItem>
              <Button variant="link" onClick={onEdit} data-testid="deployment-status-edit-button">
                Edit deployment
              </Button>
            </FlexItem>
          )}
        </Flex>
      </ModalFooter>
    </Modal>
  );
};
