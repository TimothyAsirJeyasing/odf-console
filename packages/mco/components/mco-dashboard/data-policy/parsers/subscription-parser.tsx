import * as React from 'react';
import { APPLICATION_TYPE, DRPC_STATUS } from '@odf/mco/constants';
import {
  DisasterRecoveryResourceKind,
  SubscriptionGroupType,
  useSubscriptionResourceWatch,
} from '@odf/mco/hooks';
import { ACMPlacementModel } from '@odf/mco/models';
import {
  ACMManagedClusterKind,
  ACMPlacementDecisionKind,
  DRClusterAppsMap,
  DRClusterKind,
  PlacementInfo,
  ProtectedAppsMap,
} from '@odf/mco/types';
import {
  findDRType,
  findDeploymentClusters,
  getProtectedPVCsFromDRPC,
} from '@odf/mco/utils';
import { ApplicationKind } from '@odf/shared';
import { getName, getNamespace } from '@odf/shared/selectors';
import * as _ from 'lodash-es';

const createPlacementInfoList = (
  subscriptionGroupsList: SubscriptionGroupType[],
  clusterName: string,
  applicationNamespace: string
): PlacementInfo[] => {
  const placementInfoList: PlacementInfo[] = [];

  subscriptionGroupsList.forEach((subscriptionGroup) => {
    const { drInfo } = subscriptionGroup;
    if (!_.isEmpty(drInfo)) {
      const {
        drPlacementControl,
        drPolicy,
        drClusters: currentDRClusters,
      } = drInfo;

      const placementInfo: PlacementInfo = {
        deploymentClusterName: clusterName,
        drpcName: getName(drPlacementControl),
        drpcNamespace: getNamespace(drPlacementControl),
        protectedPVCs: getProtectedPVCsFromDRPC(drPlacementControl),
        replicationType: findDRType(currentDRClusters),
        syncInterval: drPolicy?.spec?.schedulingInterval,
        workloadNamespace: applicationNamespace,
        failoverCluster: drPlacementControl?.spec?.failoverCluster,
        preferredCluster: drPlacementControl?.spec?.preferredCluster,
        lastGroupSyncTime: drPlacementControl?.status?.lastGroupSyncTime,
        status: drPlacementControl?.status?.phase as DRPC_STATUS,
        subscriptions: subscriptionGroup?.subscriptions?.map((subs) =>
          getName(subs)
        ),
      };

      placementInfoList.push(placementInfo);
    }
  });

  return placementInfoList;
};

const createProtectedAppMap = (
  application: ApplicationKind,
  clusterName: string,
  subscriptionGroupsList: SubscriptionGroupType[]
): ProtectedAppsMap => {
  const applicationNamespace = getNamespace(application);
  const protectedApp: ProtectedAppsMap = {
    appName: getName(application),
    appNamespace: applicationNamespace,
    appKind: application?.kind,
    appAPIVersion: application?.apiVersion,
    appType: APPLICATION_TYPE.SUBSCRIPTION,
    placementInfo: createPlacementInfoList(
      subscriptionGroupsList,
      clusterName,
      applicationNamespace
    ),
  };

  return protectedApp;
};

const createClusterWiseSubscriptionGroupsMap = (
  subscriptionGroupInfo: SubscriptionGroupType[]
): ClusterWiseSubscriptionGroupsMap => {
  const clusterWiseSubscriptionGroups: ClusterWiseSubscriptionGroupsMap = {};

  subscriptionGroupInfo?.forEach((subscriptionGroup) => {
    const appPlacement = (
      subscriptionGroup?.placement?.kind === ACMPlacementModel.kind
        ? subscriptionGroup?.placementDecision
        : subscriptionGroup?.placement
    ) as ACMPlacementDecisionKind;
    const deploymentClusters: string[] = findDeploymentClusters(
      appPlacement,
      subscriptionGroup?.drInfo?.drPlacementControl
    );
    deploymentClusters?.forEach((decisionCluster) => {
      clusterWiseSubscriptionGroups[decisionCluster] =
        clusterWiseSubscriptionGroups[decisionCluster] || [];
      clusterWiseSubscriptionGroups[decisionCluster].push(subscriptionGroup);
    });
  });

  return clusterWiseSubscriptionGroups;
};

export const useSubscriptionParser: UseSubscriptionParser = (
  drResources,
  drLoaded,
  drLoadError,
  managedClusters,
  managedClusterLoaded,
  managedClusterLoadError
) => {
  const [subscriptionResources, subsResourceLoaded, subsResourceLoadError] =
    useSubscriptionResourceWatch({
      drResources: {
        data: drResources,
        loaded: drLoaded,
        loadError: drLoadError,
      },
    });

  const loaded = subsResourceLoaded && managedClusterLoaded;
  const loadError = subsResourceLoadError || managedClusterLoadError;
  const drClusters: DRClusterKind[] = drResources?.drClusters;
  const drClusterAppsMap: DRClusterAppsMap = React.useMemo(() => {
    if (loaded && !loadError) {
      const drClusterAppsMap: DRClusterAppsMap = drClusters.reduce(
        (acc, drCluster) => {
          const clusterName = getName(drCluster);
          acc[clusterName] = {
            totalAppCount: 0,
            protectedApps: [],
            managedCluster: managedClusters.find(
              (managedCluster) => getName(managedCluster) === clusterName
            ),
          };
          return acc;
        },
        {} as DRClusterAppsMap
      );

      subscriptionResources.forEach((subscriptionResource) => {
        const { application, subscriptionGroupInfo } =
          subscriptionResource || {};

        const clusterWiseSubscriptionGroups =
          createClusterWiseSubscriptionGroupsMap(subscriptionGroupInfo);

        Object.entries(clusterWiseSubscriptionGroups).forEach(
          ([clusterName, subscriptionGroupsList]) => {
            if (clusterName in drClusterAppsMap) {
              drClusterAppsMap[clusterName].totalAppCount += 1;
              const protectedApp = createProtectedAppMap(
                application,
                clusterName,
                subscriptionGroupsList
              );

              if (!!protectedApp.placementInfo.length) {
                drClusterAppsMap[clusterName].protectedApps.push(protectedApp);
              }
            }
          }
        );
      });
      return drClusterAppsMap;
    }

    return {};
  }, [subscriptionResources, managedClusters, drClusters, loaded, loadError]);

  return [drClusterAppsMap, loaded, loadError];
};

type UseSubscriptionParserResult = [DRClusterAppsMap, boolean, any];

type UseSubscriptionParser = (
  drResources: DisasterRecoveryResourceKind,
  drLoaded: boolean,
  drLoadError: any,
  managedClusters: ACMManagedClusterKind[],
  managedClusterLoaded: boolean,
  managedClusterLoadError: any
) => UseSubscriptionParserResult;

type ClusterWiseSubscriptionGroupsMap = {
  [clusterName: string]: SubscriptionGroupType[];
};
