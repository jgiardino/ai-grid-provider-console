// Ported from krisv/ai-grid-cloud-provider-poc src/app/pages/models/ModelsPage.tsx at 62319b8.
// Adapted from packages/model-serving/src/components/deployments/DeploymentsTable.tsx
// and components/global/GlobalDeploymentsView.tsx.
// upstream commit: 8051fbbea117457b4da4074fb2856b732e6677a4
// Expandable per-site rows follow osac-bmaas ServicesModelsTable / InternalDeploymentsTable
// (Location + Status only; compact grey labels in the primary Locations cell).
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  AlertActionLink,
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Label,
  LabelGroup,
  PageSection,
  Stack,
  ToolbarItem,
} from '@patternfly/react-core';
import { ExpandableRowContent, Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import type { ThProps } from '@patternfly/react-table';
import type { UserService } from '../../api/ConsoleService';
import { ServiceError } from '../../api/ConsoleService';
import type { ClustersService } from '../../api/clusters';
import type { GridCluster, ManagedModel } from '../../api/types';
import { LoadError } from '../../components/LoadError';
import { PageHeader } from '../../components/PageHeader';
import { PageLoading } from '../../components/PageLoading';
import { PaginatedTable } from '../../components/PaginatedTable';
import { RelativeTime } from '../../components/RelativeTime';
import { SimpleMenuActions } from '../../components/SimpleMenuActions';
import { ToolbarSearch } from '../../components/ToolbarSearch';
import { TableEmptyRow } from '../../components/TableEmptyRow';
import { useServiceData } from '../../hooks/useServiceData';
import { EMPTY_VALUE } from '../../utilities/format';
import { getPhaseProps } from '../../utilities/phaseLabelUtils';
import { DeploymentStatusModal } from './DeploymentStatusModal';
import type { ModelSiteDeployment } from './modelUtils';
import { locationLabel, modelPath, siteDeploymentsOf, siteNamesOf } from './modelUtils';
import { ModelStatusLabel } from './ModelStatus';
import { ModelStatusModal } from './ModelStatusModal';
import { PARTIALLY_AVAILABLE, modelDisplayStatus } from './modelStatusInfo';
import type { ModelDeleteService } from './useDeleteModel';
import { useDeleteModel } from './useDeleteModel';

type Props = { service: ModelDeleteService & UserService & Pick<ClustersService, 'listClusters'> };

type Column = { label: string; sort: (a: ManagedModel, b: ManagedModel) => number };

const columns: Column[] = [
  { label: 'Name', sort: (a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name) },
  { label: 'Model', sort: (a, b) => (a.modelName ?? a.modelRef.name).localeCompare(b.modelName ?? b.modelRef.name) },
  { label: 'Replicas', sort: (a, b) => (a.replicas ?? 0) - (b.replicas ?? 0) },
  { label: 'Locations', sort: (a, b) => a.locations.length - b.locations.length },
  { label: 'Created', sort: (a, b) => (a.creationTimestamp ?? '').localeCompare(b.creationTimestamp ?? '') },
  { label: 'Status', sort: (a, b) => (a.phase ?? '').localeCompare(b.phase ?? '') },
];

const keyOf = (model: ManagedModel) => `${model.namespace}/${model.name}`;

const SiteStatusLabel: React.FC<{ phase: string; onClick: () => void }> = ({ phase, onClick }) => {
  const { icon, status, color } = getPhaseProps(phase);
  return (
    <Label icon={icon} status={status} color={color} variant="filled" isClickable onClick={onClick}>
      {phase}
    </Label>
  );
};

const ModelSiteDeploymentsTable: React.FC<{
  model: ManagedModel;
  clusters: GridCluster[];
  siteNames: Map<string, string>;
  onOpenStatus: (deployment: ModelSiteDeployment) => void;
}> = ({ model, clusters, siteNames, onOpenStatus }) => {
  const deployments = siteDeploymentsOf(model, clusters);
  const title = model.displayName ?? model.name;
  return (
    <Table
      aria-label={`Deployments for ${title}`}
      variant="compact"
      isNested
      data-testid={`model-site-deployments-${model.name}`}
    >
      <Thead>
        <Tr resetOffset>
          <Th>Location</Th>
          <Th modifier="fitContent">Status</Th>
        </Tr>
      </Thead>
      <Tbody>
        {deployments.map((deployment) => (
          <Tr key={deployment.id} resetOffset>
            <Td dataLabel="Location">
              <Label color="grey">{locationLabel(deployment.location, siteNames)}</Label>
            </Td>
            <Td dataLabel="Status" modifier="fitContent">
              <SiteStatusLabel phase={deployment.phase} onClick={() => onOpenStatus(deployment)} />
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export const ModelsPage: React.FC<Props> = ({ service }) => {
  const navigate = useNavigate();
  const [deployments, loaded, error, refresh] = useServiceData<ManagedModel[]>(() => service.listModels(), []);
  const [clusters] = useServiceData(() => service.listClusters(), [], 0);
  const [user] = useServiceData(() => service.getUser(), undefined, 0);
  const siteNames = useMemo(() => siteNamesOf(clusters), [clusters]);
  const canWrite = !!user?.isProviderAdmin;
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<{ index: number; direction: 'asc' | 'desc' }>({ index: 0, direction: 'asc' });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [statusModal, setStatusModal] = useState<{
    model: ManagedModel;
    deployment: ModelSiteDeployment;
  } | null>(null);
  const [modelStatusModal, setModelStatusModal] = useState<ManagedModel | null>(null);
  const [confirmDelete, deleteModal] = useDeleteModel(service, {
    models: deployments,
    refresh: () => void refresh(),
    onDeleted: () => void refresh(),
  });

  const rows = useMemo(() => {
    const term = filter.toLowerCase();
    const compare = columns[sortBy.index].sort;
    return deployments
      .filter((d) =>
        `${d.displayName ?? ''} ${d.name} ${d.modelName} ${d.locations.join(' ')}`.toLowerCase().includes(term),
      )
      .sort((a, b) => (sortBy.direction === 'asc' ? compare(a, b) : compare(b, a)));
  }, [deployments, filter, sortBy]);

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deployButton = canWrite ? (
    <Button component={(props) => <Link {...props} to="/models/deploy" />}>Deploy model</Button>
  ) : null;

  const sortParams = (index: number): ThProps['sort'] => ({
    sortBy,
    onSort: (_event, i, direction) => setSortBy({ index: i, direction }),
    columnIndex: index,
  });

  const errorAlert =
    error &&
    (error instanceof ServiceError && error.isNotImplemented ? (
      <LoadError subject="Models" error={error} />
    ) : (
      <Alert
        isInline
        variant="danger"
        title="Error loading models"
        actionLinks={<AlertActionLink onClick={() => void refresh()}>Retry</AlertActionLink>}
      >
        {error.message}
      </Alert>
    ));

  const body = () => {
    // A failed refresh keeps the last list and shows the error above it.
    if (error && deployments.length === 0) {
      return errorAlert;
    }
    if (deployments.length === 0) {
      return (
        <EmptyState titleText="No models" headingLevel="h2">
          <EmptyStateBody>Add a deployment to configure a model for serving.</EmptyStateBody>
          {deployButton && (
            <EmptyStateFooter>
              <EmptyStateActions>{deployButton}</EmptyStateActions>
            </EmptyStateFooter>
          )}
        </EmptyState>
      );
    }
    return (
      <Stack hasGutter>
        {errorAlert}
        <PaginatedTable
          rows={rows}
          toolbar={
            <>
              <ToolbarSearch
                label="Filter models"
                placeholder="Filter by name or location"
                value={filter}
                onChange={setFilter}
              />
              {deployButton && <ToolbarItem>{deployButton}</ToolbarItem>}
            </>
          }
        >
          {(pageRows) => (
            <Table aria-label="Model deployments" isExpandable data-testid="model-deployments-table">
              <Thead>
                <Tr>
                  <Th screenReaderText="Row expansion" />
                  {columns.map((c, i) => (
                    <Th key={c.label} sort={sortParams(i)} modifier="wrap">
                      {c.label}
                    </Th>
                  ))}
                  {canWrite && <Th screenReaderText="Actions" />}
                </Tr>
              </Thead>
              {rows.length === 0 ? (
                <Tbody>
                  <TableEmptyRow
                    colSpan={columns.length + 1 + (canWrite ? 1 : 0)}
                    body="Change the filter to see more models."
                    onClear={() => setFilter('')}
                  />
                </Tbody>
              ) : (
                pageRows.map((deployment, rowIndex) => {
                  const title = deployment.displayName ?? deployment.name;
                  const id = keyOf(deployment);
                  const siteRows = siteDeploymentsOf(deployment, clusters);
                  const hasSites = siteRows.length > 0;
                  const isExpanded = hasSites && expanded.has(id);
                  return (
                    <Tbody key={id} isExpanded={isExpanded} data-testid={`model-row-${deployment.name}`}>
                      <Tr isContentExpanded={isExpanded}>
                        {hasSites ? (
                          <Td
                            expand={{
                              rowIndex,
                              isExpanded,
                              onToggle: () => toggleExpanded(id),
                              expandId: `expand-${deployment.name}`,
                            }}
                          />
                        ) : (
                          <Td />
                        )}
                        <Td dataLabel="Name">
                          <Link to={modelPath(deployment)}>{title}</Link>
                        </Td>
                        <Td dataLabel="Model" modifier="breakWord">
                          {deployment.modelName ?? deployment.modelRef.name}
                        </Td>
                        <Td dataLabel="Replicas">{deployment.replicas ?? EMPTY_VALUE}</Td>
                        <Td dataLabel="Locations" data-testid={`model-locations-${deployment.name}`}>
                          {deployment.locations.length === 0 ? (
                            EMPTY_VALUE
                          ) : (
                            <LabelGroup numLabels={4} data-testid={`model-location-labels-${deployment.name}`}>
                              {deployment.locations.map((location) => (
                                <Label key={location} color="grey" isCompact>
                                  {locationLabel(location, siteNames)}
                                </Label>
                              ))}
                            </LabelGroup>
                          )}
                        </Td>
                        <Td dataLabel="Created" modifier="nowrap">
                          <RelativeTime time={deployment.creationTimestamp} />
                        </Td>
                        <Td dataLabel="Status">
                          <ModelStatusLabel
                            model={deployment}
                            clusters={clusters}
                            onOpen={() => setModelStatusModal(deployment)}
                          />
                        </Td>
                        {canWrite && (
                          <Td isActionCell>
                            <SimpleMenuActions
                              testId={`model-actions-${deployment.name}`}
                              ariaLabel={`Actions for ${title}`}
                              dropdownItems={[
                                { key: 'view', label: 'View details', onClick: () => navigate(modelPath(deployment)) },
                                {
                                  key: 'edit',
                                  label: 'Edit',
                                  onClick: () => navigate(`${modelPath(deployment)}/edit`),
                                },
                                { isSpacer: true },
                                {
                                  key: 'delete',
                                  label: 'Delete',
                                  isDanger: true,
                                  onClick: () => confirmDelete(deployment),
                                },
                              ]}
                            />
                          </Td>
                        )}
                      </Tr>
                      {hasSites && (
                        <Tr isExpanded={isExpanded}>
                          <Td />
                          <Td noPadding colSpan={columns.length}>
                            <ExpandableRowContent>
                              <div className="pf-v6-u-pb-lg">
                                <ModelSiteDeploymentsTable
                                  model={deployment}
                                  clusters={clusters}
                                  siteNames={siteNames}
                                  onOpenStatus={(site) => setStatusModal({ model: deployment, deployment: site })}
                                />
                              </div>
                            </ExpandableRowContent>
                          </Td>
                          {canWrite && <Td />}
                        </Tr>
                      )}
                    </Tbody>
                  );
                })
              )}
            </Table>
          )}
        </PaginatedTable>
      </Stack>
    );
  };

  return (
    <>
      <PageHeader title="Models" description="Add and remove model deployments." />
      {!(error && deployments.length === 0) && !loaded ? (
        <PageLoading label="Loading models" />
      ) : (
        <PageSection isFilled>{body()}</PageSection>
      )}
      {deleteModal}
      {statusModal && (
        <DeploymentStatusModal
          model={statusModal.model}
          deployment={statusModal.deployment}
          locationLabel={locationLabel(statusModal.deployment.location, siteNames)}
          onClose={() => setStatusModal(null)}
          onEdit={
            canWrite
              ? () => {
                  setStatusModal(null);
                  navigate(`${modelPath(statusModal.model)}/edit`);
                }
              : undefined
          }
          onStop={
            canWrite
              ? () => {
                  const model = statusModal.model;
                  setStatusModal(null);
                  confirmDelete(model);
                }
              : undefined
          }
        />
      )}
      {modelStatusModal && (
        <ModelStatusModal
          model={modelStatusModal}
          clusters={clusters}
          onClose={() => setModelStatusModal(null)}
          onViewDeployments={
            modelDisplayStatus(modelStatusModal, clusters) === PARTIALLY_AVAILABLE
              ? () => {
                  const id = keyOf(modelStatusModal);
                  setModelStatusModal(null);
                  setExpanded((current) => new Set(current).add(id));
                }
              : undefined
          }
        />
      )}
    </>
  );
};
