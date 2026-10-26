import type { CSSProperties, ReactNode } from 'react';
import {
  Alert,
  Button,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  StackItem,
  Title,
} from '@patternfly/react-core';
import type { GridCluster, ManagedModel } from '../../api/types';
import { getPhaseProps } from '../../utilities/phaseLabelUtils';
import {
  hasModelStatusDetails,
  modelDisplayStatus,
  modelStatusTitle,
  PARTIALLY_AVAILABLE,
} from './modelStatusInfo';
import { ModelStatusDetails } from './ModelStatus';

type Props = {
  model: ManagedModel;
  clusters?: GridCluster[];
  onClose: () => void;
  /** Partially available: close the modal and expand the model's location rows. */
  onViewDeployments?: () => void;
};

/**
 * High-level model status (primary table): model name and status label on the first line,
 * "Deployment status" under it. Body copy depends on the display status.
 */
export const ModelStatusModal: React.FC<Props> = ({
  model,
  clusters = [],
  onClose,
  onViewDeployments,
}) => {
  const title = model.displayName ?? model.name;
  const displayStatus = modelDisplayStatus(model, clusters);
  const { icon, status, color } = getPhaseProps(displayStatus);
  const partiallyAvailable = displayStatus === PARTIALLY_AVAILABLE;

  let body: ReactNode;
  if (partiallyAvailable) {
    body = <p data-testid="model-status-modal-message">One or more model deployments are not ready</p>;
  } else if (displayStatus === 'Failed' || hasModelStatusDetails(model, clusters)) {
    body = (
      <Alert
        isInline
        variant={displayStatus === 'Failed' ? 'danger' : 'info'}
        title={modelStatusTitle(model, clusters)}
        data-testid="model-status-modal-alert"
      >
        <ModelStatusDetails model={model} />
      </Alert>
    );
  } else if (displayStatus === 'Pending') {
    body = (
      <Stack hasGutter data-testid="model-status-modal-message">
        <StackItem>
          <p>This model is still being placed or rolled out to its locations.</p>
        </StackItem>
        {model.statusMessage && <StackItem><p>{model.statusMessage}</p></StackItem>}
      </Stack>
    );
  } else {
    body = (
      <p data-testid="model-status-modal-message">
        {model.statusMessage ?? `This model is ${displayStatus.toLowerCase()}.`}
      </p>
    );
  }

  return (
    <Modal
      variant="medium"
      isOpen
      onClose={onClose}
      data-testid="model-status-modal"
      aria-label={`${title} model status`}
    >
      <ModalHeader
        data-testid="model-status-modal-header"
        style={{ '--pf-v6-c-modal-box__header--Gap': 'var(--pf-t--global--spacer--sm)' } as CSSProperties}
      >
        <Title headingLevel="h1" size="2xl" data-testid="model-status-modal-title">
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
                {displayStatus}
              </Label>
            </FlexItem>
          </Flex>
        </Title>
        <p data-testid="model-status-modal-subtitle">Deployment status</p>
      </ModalHeader>
      <ModalBody>{body}</ModalBody>
      {partiallyAvailable && onViewDeployments && (
        <ModalFooter>
          <Button
            variant="link"
            isInline
            onClick={onViewDeployments}
            data-testid="model-status-view-deployments"
          >
            View model deployments per location
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
};
