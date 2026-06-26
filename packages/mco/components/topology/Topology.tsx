import * as React from 'react';
import { getMajorVersion } from '@odf/mco/utils';
import HandleErrorAndLoading from '@odf/shared/error-handler/ErrorStateHandler';
import { useDeepCompareMemoize } from '@odf/shared/hooks/deep-compare-memoize';
import { useFetchCsv } from '@odf/shared/hooks/use-fetch-csv';
import {
  BaseTopologyView,
  useSelectionHandler,
  useTopologyControls,
  useVisualizationSetup,
} from '@odf/shared/topology';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import { MirrorPeerModel } from '@odf/shared';
import { referenceForModel } from '@odf/shared/utils';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  AlertActionCloseButton,
  AlertVariant,
  EmptyState,
  EmptyStateBody,
  Title,
} from '@patternfly/react-core';
import { TopologyIcon } from '@patternfly/react-icons';
import {
  GraphElement,
  useVisualizationController,
  VisualizationProvider,
} from '@patternfly/react-topology';
import { ODFMCO_OPERATOR } from '../../constants';
import {
  getManagedClusterResourceObj,
  getDRPolicyResourceObj,
  useProtectedAppsByCluster,
  useDRPoliciesByClusterPair,
  useActiveDROperations,
} from '../../hooks';
import { ACMManagedClusterKind, DRPolicyKind, MirrorPeerKind } from '../../types';
import { hasConflictingPeering } from '../create-dr-policy/utils/cluster-peering-validators';
import { CreateDRPolicyModal } from '../create-dr-policy/CreateDRPolicyModal';
import { TopologyDataContext } from './context/TopologyContext';
import { mcoTopologyComponentFactory } from './factory/MCOStyleFactory';
import TopologySideBar from './sidebar/TopologySideBar';
import TopologyToolbar from './TopologyToolbar';
import { TopologyViewLevel, FilterType } from './types';
import { generateClusterNodesModel } from './utils/node-generator';
import './topology.scss';

const TopologyViewComponent: React.FC = () => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [searchValue, setSearchValue] = React.useState('');
  const [selectedFilters, setSelectedFilters] = React.useState<FilterType[]>(
    []
  );
  const controller = useVisualizationController();

  const [isSideBarOpen, setSideBarOpen] = React.useState(false);
  const {
    clusters,
    setSelectedElement,
    clusterAppsMap,
    clusterPairPoliciesMap,
    clusterPairOperationsMap,
  } = React.useContext(TopologyDataContext);

  const onCloseSideBar = React.useCallback(() => {
    setSideBarOpen(false);
    setSelectedIds([]);
  }, []);

  useSelectionHandler({
    controller,
    setSelectedElement,
    setSelectedIds,
    setSideBarOpen,
  });

  const prevStructureKeyRef = React.useRef<string>('');

  const memoizedClusters = useDeepCompareMemoize(clusters);
  const memoizedPolicies = useDeepCompareMemoize(clusterPairPoliciesMap);
  const memoizedOperations = useDeepCompareMemoize(clusterPairOperationsMap);
  const memoizedApps = useDeepCompareMemoize(clusterAppsMap);

  const model = React.useMemo(() => {
    return generateClusterNodesModel(
      memoizedClusters,
      memoizedPolicies,
      memoizedOperations,
      memoizedApps,
      {
        searchValue,
        filterTypes: selectedFilters,
      }
    );
  }, [
    memoizedClusters,
    memoizedPolicies,
    memoizedOperations,
    memoizedApps,
    searchValue,
    selectedFilters,
  ]);

  // Memoize structure key to avoid recreating arrays on every render
  const structureKey = React.useMemo(() => {
    return (model.nodes || [])
      .map((n) => n.id)
      .sort()
      .join(',');
  }, [model.nodes]);

  // Initialize and update model when data changes
  React.useEffect(() => {
    if (!controller) return;

    controller.fromModel(model);

    if (structureKey !== prevStructureKeyRef.current) {
      prevStructureKeyRef.current = structureKey;
      const graph = controller.getGraph();
      if (!graph) return;

      // Delay fit until after the layout engine finishes positioning nodes
      requestAnimationFrame(() => {
        // Check if controller still exists (component may have unmounted)
        if (!controller) return;
        graph.layout();
        requestAnimationFrame(() => {
          // Check again before calling fit (double RAF delay)
          if (!controller) return;
          graph.fit(100);
        });
      });
    }
  }, [controller, model, structureKey]);

  const controlButtons = useTopologyControls({ controller });

  // Derive sidebar data from the reactive model instead of selectedElement.getData().
  // getData() reads from the GraphElement which is updated by fromModel() in an
  // effect — one render behind. The model is computed from context maps and is current.
  // When the element no longer exists in the model (e.g. operation completed),
  // return undefined so the sidebar closes rather than showing stale data.
  const selectedElement = React.useContext(TopologyDataContext).selectedElement;
  const selectedElementId = selectedElement?.getId();
  const selectedElementData = React.useMemo(() => {
    if (!selectedElementId) return undefined;
    const node = model.nodes?.find((n) => n.id === selectedElementId);
    if (node) return node.data;
    const edge = model.edges?.find((e) => e.id === selectedElementId);
    return edge?.data;
  }, [selectedElementId, model]);

  // Close sidebar when the selected element disappears from the model
  React.useEffect(() => {
    if (selectedElementId && selectedElementData === undefined) {
      onCloseSideBar();
    }
  }, [selectedElementId, selectedElementData, onCloseSideBar]);

  // Check what type of element is selected
  const isEdgeSelected =
    selectedElementData?.policies !== undefined ||
    selectedElementData?.isOperation !== undefined;
  const isAppNodeSelected =
    (selectedElementData?.operation !== undefined &&
      selectedElementData?.isSource !== undefined) ||
    selectedElementData?.isStatic === true; // Also handle static apps
  const isFailoverNodeSelected = selectedElementData?.operations !== undefined;

  const sidebarResource =
    isEdgeSelected || isAppNodeSelected || isFailoverNodeSelected
      ? null
      : selectedElementData?.resource;
  const sidebarEdgeData =
    isEdgeSelected || isAppNodeSelected || isFailoverNodeSelected
      ? selectedElementData
      : undefined;

  return (
    <>
      <TopologyToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
      />
      <div className="mco-topology__content">
        <BaseTopologyView
          controlButtons={controlButtons}
          sideBar={
            <TopologySideBar
              resource={sidebarResource}
              edgeData={sidebarEdgeData}
              onClose={onCloseSideBar}
              isExpanded={isSideBarOpen}
            />
          }
          sideBarOpen={isSideBarOpen}
          selectedIds={selectedIds}
        />
      </div>
    </>
  );
};

const TopologyEmptyState: React.FC = () => {
  const { t } = useCustomTranslation();

  return (
    <EmptyState
      titleText={
        <Title headingLevel="h4" size="lg">
          {t('No clusters found')}
        </Title>
      }
      icon={TopologyIcon}
    >
      <EmptyStateBody>
        {t('Connect managed clusters to view the topology')}
      </EmptyStateBody>
    </EmptyState>
  );
};

const Topology: React.FC = () => {
  const { t } = useCustomTranslation();
  const controller = useVisualizationSetup({
    componentFactory: mcoTopologyComponentFactory,
  });
  const [selectedElement, setSelectedElement] =
    React.useState<GraphElement | null>(null);

  // Modal state for cluster pairing
  const [isPairModalOpen, setIsPairModalOpen] = React.useState(false);
  const [pairModalClusters, setPairModalClusters] = React.useState<string[]>(
    []
  );
  const [pairValidationError, setPairValidationError] = React.useState('');

  const [managedClusters, loaded, loadError] = useK8sWatchResource<
    ACMManagedClusterKind[]
  >(getManagedClusterResourceObj());

  const [mirrorPeers] = useK8sWatchResource<MirrorPeerKind[]>({
    kind: referenceForModel(MirrorPeerModel),
    isList: true,
    namespaced: false,
  });

  const [drPolicies] = useK8sWatchResource<DRPolicyKind[]>(
    getDRPolicyResourceObj()
  );

  const [clusterAppsMap, appsLoaded, appsLoadError] =
    useProtectedAppsByCluster();

  const [clusterPairPoliciesMap, policiesLoaded, policiesLoadError] =
    useDRPoliciesByClusterPair();

  const [clusterPairOperationsMap, operationsLoaded, operationsLoadError] =
    useActiveDROperations();

  const [csv] = useFetchCsv({
    specName: ODFMCO_OPERATOR,
  });
  const odfMCOVersion = getMajorVersion(csv?.spec?.version);

  const handleOpenPairModal = React.useCallback(
    (sourceCluster: string, targetCluster: string) => {
      const clusterNames = [sourceCluster, targetCluster];
      if (hasConflictingPeering(clusterNames, mirrorPeers, drPolicies)) {
        setPairValidationError(
          t(
            'A mirror peer configuration already exists for one or more of the selected clusters, ' +
              'either from an existing or deleted DR policy. To create a new DR policy with these clusters, ' +
              'delete any existing mirror peer configurations associated with them and try again.'
          )
        );
        return;
      }
      setPairValidationError('');
      setPairModalClusters(clusterNames);
      setIsPairModalOpen(true);
    },
    [mirrorPeers, drPolicies, t]
  );

  const isClusterPairingBlocked = React.useCallback(
    (sourceCluster: string, targetCluster: string) =>
      hasConflictingPeering(
        [sourceCluster, targetCluster],
        mirrorPeers,
        drPolicies
      ),
    [mirrorPeers, drPolicies]
  );

  const handleClosePairModal = React.useCallback(() => {
    setIsPairModalOpen(false);
    setPairModalClusters([]);
  }, []);

  const topologyDataContextData = React.useMemo(() => {
    return {
      clusters: managedClusters || [],
      selectedElement,
      setSelectedElement,
      visualizationLevel: TopologyViewLevel.CLUSTERS,
      odfMCOVersion,
      clusterAppsMap,
      clusterPairPoliciesMap,
      clusterPairOperationsMap,
      onOpenPairModal: handleOpenPairModal,
      isClusterPairingBlocked,
    };
  }, [
    managedClusters,
    selectedElement,
    setSelectedElement,
    odfMCOVersion,
    clusterAppsMap,
    clusterPairPoliciesMap,
    clusterPairOperationsMap,
    handleOpenPairModal,
    isClusterPairingBlocked,
  ]);

  const hasNoClusters =
    loaded && (!managedClusters || managedClusters.length === 0);

  return (
    <TopologyDataContext.Provider value={topologyDataContextData}>
      <VisualizationProvider controller={controller}>
        <div className="mco-topology" id="mco-topology">
          {pairValidationError && (
            <Alert
              className="pf-v6-u-m-md odf-alert"
              variant={AlertVariant.danger}
              title={t('Selected clusters cannot be used to create a DRPolicy.')}
              isInline
              actionClose={
                <AlertActionCloseButton
                  onClose={() => setPairValidationError('')}
                />
              }
            >
              {pairValidationError}
            </Alert>
          )}
          {hasNoClusters ? (
            <TopologyEmptyState />
          ) : (
            <HandleErrorAndLoading
              loading={
                !loaded ||
                !appsLoaded ||
                !policiesLoaded ||
                !operationsLoaded ||
                !controller
              }
              error={(() => {
                const err =
                  loadError ||
                  appsLoadError ||
                  policiesLoadError ||
                  operationsLoadError;
                return (err instanceof Error ? err.message : err) || '';
              })()}
            >
              <TopologyViewComponent />
            </HandleErrorAndLoading>
          )}
        </div>
        <CreateDRPolicyModal
          isOpen={isPairModalOpen}
          onClose={handleClosePairModal}
          preSelectedClusters={pairModalClusters}
        />
      </VisualizationProvider>
    </TopologyDataContext.Provider>
  );
};

export default Topology;
