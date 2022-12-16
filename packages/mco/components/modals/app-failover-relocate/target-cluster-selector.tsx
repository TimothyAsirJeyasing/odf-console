import * as React from 'react';
import { utcDateTimeFormatterWithTimeZone } from '@odf/shared/details-page/datetime';
import { useDeepCompareMemoize } from '@odf/shared/hooks/deep-compare-memoize';
import { getName, getNamespace } from '@odf/shared/selectors';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import { referenceForModel } from '@odf/shared/utils';
import {
  GreenCheckCircleIcon,
  RedExclamationCircleIcon,
  useK8sWatchResources,
} from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'i18next';
import {
  Dropdown,
  DropdownToggle,
  DropdownItem,
  Flex,
  FlexItem,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { UnknownIcon } from '@patternfly/react-icons';
import { REPLICATION_TYPE } from '../../../constants';
import { ACMManagedClusterModel, DRClusterModel } from '../../../models';
import { ACMManagedClusterKind, DRClusterKind } from '../../../types';
import {
  FailoverAndRelocateState,
  FailoverAndRelocateAction,
  FailoverAndRelocateType,
  ACTION_TYPE,
  TargetClusterType,
  ModalFooterStatus,
} from './reducer';

const getAvailableCondition = (managedCluster: ACMManagedClusterKind) =>
  managedCluster?.status?.conditions?.find(
    (condition) =>
      condition?.type === 'ManagedClusterConditionAvailable' &&
      condition.status === 'True'
  );

export const getRelicationTypeUsingDRClusters = (
  targetClusters: DRClusterKind[]
) => {
  const cephFSIDs = targetClusters?.reduce((acc, cluster) => {
    if (!!cluster?.spec?.region) {
      acc.add(cluster?.spec?.region);
    }
    return acc;
  }, new Set());
  return cephFSIDs?.size === 1 ? REPLICATION_TYPE.SYNC : REPLICATION_TYPE.ASYNC;
};

const getLastUpdatedTime = (lastAvailableTime: string, t: TFunction) => {
  return lastAvailableTime ? (
    <span>
      {utcDateTimeFormatterWithTimeZone.format(new Date(lastAvailableTime))}
    </span>
  ) : (
    <span>
      <UnknownIcon /> {t('Unknown')}
    </span>
  );
};

const validClusterStatus = (t: TFunction, originClusterName: string) => ({
  [ACTION_TYPE.FAILOVER]: {
    status: ['Fenced'],
    errorMessage: t('Primary cluster {{cluster}} is not fenced.', {
      cluster: originClusterName,
    }),
  },
  [ACTION_TYPE.RELOCATE]: {
    status: ['Unfenced', 'Available'],
    errorMessage: t(
      'Primary cluster {{cluster}} is unavailable or not unfenced.',
      { cluster: originClusterName }
    ),
  },
});

const TargetClusterStatus: React.FC<TargetClusterStatusProps> = ({
  isClusterAvailable,
}) => {
  return isClusterAvailable ? (
    <GreenCheckCircleIcon />
  ) : (
    <RedExclamationCircleIcon />
  );
};

const resources = {
  drClusters: {
    kind: referenceForModel(DRClusterModel),
    namespaced: false,
    isList: true,
  },
  managedClusters: {
    kind: referenceForModel(ACMManagedClusterModel),
    namespaced: false,
    isList: true,
  },
};

export const TargetClusterSelector: React.FC<TargetClusterSelectorProps> = ({
  state,
  dispatch,
}) => {
  const { t } = useCustomTranslation();
  const response =
    useK8sWatchResources<TargetClusterWatchResourceType>(resources);

  const memoizedDRClusters = useDeepCompareMemoize(response.drClusters, true);
  const memoizedManagedClusters = useDeepCompareMemoize(
    response.managedClusters,
    true
  );
  const selectdDRPolicy = state.selectedDRPolicy;

  const {
    data: drClusters,
    loaded: drClustersLoaded,
    loadError: drClustersLoadError,
  } = memoizedDRClusters;

  const {
    data: managedClusters,
    loaded: managedClustersLoaded,
    loadError: managedClustersLoadError,
  } = memoizedManagedClusters;

  const [isOpen, setOpen] = React.useState(false);

  const drClusterList = React.useMemo(
    () =>
      drClustersLoaded && !drClustersLoadError
        ? drClusters?.filter((drCluster) =>
            selectdDRPolicy?.drClusters?.includes(getName(drCluster))
          )
        : [],
    [drClusters, drClustersLoaded, drClustersLoadError, selectdDRPolicy]
  );

  const managedClusterList = React.useMemo(
    () =>
      managedClustersLoaded && !managedClustersLoadError
        ? managedClusters?.filter((managedCluster) =>
            selectdDRPolicy?.drClusters?.includes(getName(managedCluster))
          )
        : [],
    [
      managedClusters,
      managedClustersLoaded,
      managedClustersLoadError,
      selectdDRPolicy,
    ]
  );

  React.useLayoutEffect(() => {
    if (
      state.actionType === ACTION_TYPE.RELOCATE &&
      !!managedClusterList.length
    ) {
      const areBothClustersUp = managedClusterList.every(
        (managedCluster) => !!getAvailableCondition(managedCluster)
      );
      !areBothClustersUp &&
        dispatch({
          type: FailoverAndRelocateType.SET_ERROR_MESSAGE,
          payload: {
            managedClustersErrorMessage: t(
              'Attempting to relocate is not possible, one or more managed clusters are down.'
            ),
          },
        });
    }
  }, [managedClusterList, state.actionType, dispatch, t]);

  const setErrorMessage = (errorMessage: string) => {
    dispatch({
      type: FailoverAndRelocateType.SET_ERROR_MESSAGE,
      payload: {
        targetClusterErrorMessage: errorMessage,
      },
    });
  };

  const setSelected = (selection: TargetClusterType) => {
    dispatch({
      type: FailoverAndRelocateType.SET_SELECTED_TARGET_CLUSTER,
      payload: selection,
    });
  };

  const onToggle = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const dropdownItems = React.useMemo(
    () =>
      managedClusterList.map((managedCluster, index) => (
        <DropdownItem
          id={index.toString()}
          data-test={`target-cluster-dropdown-item-${index}`}
          key={`selected-target-cluster-${getName(managedCluster)}`}
          value={getName(managedCluster)}
          component="button"
        >
          {getName(managedCluster)}
        </DropdownItem>
      )),
    [managedClusterList]
  );

  const onSelect = (e) => {
    // Select a target cluster to intiate failover or relocate
    const managedCluster = managedClusterList?.[e.currentTarget.id];
    // Check ACM managed cluster is available or not
    const condition = getAvailableCondition(managedCluster);
    let isClusterAvailable = !!condition;
    let isClusterFenced = true;
    let errorMessage = '';

    // Check the target gluster status
    if (isClusterAvailable) {
      // Check DR fencing status for origin cluster
      const drClusters = drClusterList.map((drCluster) => drCluster);
      // Get the origin/primary cluster from the fence list
      const originCluster = drClusters.find(
        (drCluster) => getName(drCluster) !== getName(managedCluster)
      );
      const replicationType = getRelicationTypeUsingDRClusters(drClusters);
      if (replicationType === REPLICATION_TYPE.SYNC) {
        // Validate origin cluster and its availablity
        const requiredClusterStatus = validClusterStatus(
          t,
          getName(originCluster)
        )[state.actionType];
        isClusterAvailable = requiredClusterStatus.status.includes(
          originCluster?.status?.phase
        );
        errorMessage = !isClusterAvailable
          ? requiredClusterStatus.errorMessage
          : '';
      }
    } else {
      errorMessage = t('Target cluster {{cluster}} is not available.', {
        cluster: getName(managedCluster),
      });
    }
    setSelected({
      clusterInfo: {
        clusterName: getName(managedCluster),
        clusterNamespace: getNamespace(managedCluster),
      },
      isClusterAvailable: isClusterAvailable && isClusterFenced,
      lastAvailableTime: condition?.lastTransitionTime,
    });
    setErrorMessage(errorMessage);
    setOpen(false);
  };

  return (
    <>
      <Dropdown
        className="mco-dr-action-body__dropdown--width"
        onSelect={onSelect}
        toggle={
          <DropdownToggle
            className="mco-dr-action-body__dropdown--width"
            data-test="target-cluster-dropdown-toggle"
            isDisabled={
              !drClusterList.length ||
              !managedClusterList.length ||
              state.modalFooterStatus === ModalFooterStatus.FINISHED ||
              !!state.errorMessage.managedClustersErrorMessage
            }
            onToggle={onToggle}
          >
            {!!Object.keys(state.selectedTargetCluster).length ? (
              <Flex>
                <FlexItem className="mco-dr-action__target-cluster--width">
                  {state.selectedTargetCluster?.clusterInfo?.clusterName}
                </FlexItem>
                <FlexItem>
                  <TargetClusterStatus
                    isClusterAvailable={
                      state.selectedTargetCluster?.isClusterAvailable
                    }
                  />
                </FlexItem>
              </Flex>
            ) : (
              t('Select')
            )}
          </DropdownToggle>
        }
        isOpen={isOpen}
        dropdownItems={dropdownItems}
      />
      <HelperText>
        <HelperTextItem variant="indeterminate">
          {t('Last available: ')}
          {getLastUpdatedTime(
            state.selectedTargetCluster?.lastAvailableTime,
            t
          )}
        </HelperTextItem>
      </HelperText>
    </>
  );
};

type TargetClusterSelectorProps = {
  state: FailoverAndRelocateState;
  dispatch: React.Dispatch<FailoverAndRelocateAction>;
};

type TargetClusterWatchResourceType = {
  drClusters: DRClusterKind[];
  managedClusters: ACMManagedClusterKind[];
};

type TargetClusterStatusProps = {
  isClusterAvailable: boolean;
};
