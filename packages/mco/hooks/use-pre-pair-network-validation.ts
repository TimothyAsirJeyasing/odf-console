import * as React from 'react';
import {
  GlobalnetCheckStatus,
  GlobalnetRequirement,
  MAX_ALLOWED_CLUSTERS,
  SUBMARINER_ADDON_NAME,
  SUBMARINER_GVK,
  SUBMARINER_OPERATOR_NAMESPACE,
  SUBMARINER_RESOURCE_NAME,
  SubmarinerClusterHealth,
} from '@odf/mco/constants';
import {
  ACMManagedClusterKind,
  ClusterSubmarinerStatus,
  SubmarinerAddOnKind,
  SubmarinerBrokerKind,
  SubmarinerClusterKind,
} from '@odf/mco/types';
import { fireManagedClusterView } from '@odf/mco/utils/managed-cluster-view';
import {
  evaluateGlobalnetPrePair,
  evaluateSubmarinerPrePair,
} from '@odf/mco/utils/submariner-health';
import { getName } from '@odf/shared/selectors';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import {
  getValidWatchK8sResourceObj,
  isNotFoundError,
} from '@odf/shared/utils';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'react-i18next';
import {
  getManagedClusterResourceObj,
  getSubmarinerAddonListResourceObj,
  getSubmarinerBrokerListResourceObj,
  getSubmarinerClusterListResourceObj,
} from './mco-resources';

export type PrePairNetworkValidationState = {
  loaded: boolean;
  loadError: unknown;
  canProceed: boolean;
  submarinerOverallHealth: SubmarinerClusterHealth;
  globalnetStatus: GlobalnetCheckStatus;
  globalnetRequirement: GlobalnetRequirement;
  clusterStatuses: ClusterSubmarinerStatus[];
};

const idleState: PrePairNetworkValidationState = {
  loaded: true,
  loadError: null,
  canProceed: true,
  submarinerOverallHealth: SubmarinerClusterHealth.NotInstalled,
  globalnetStatus: GlobalnetCheckStatus.Skipped,
  globalnetRequirement: GlobalnetRequirement.Skipped,
  clusterStatuses: [],
};

const isAddonAbsent = (
  loaded: boolean,
  addon: SubmarinerAddOnKind | undefined,
  loadError: unknown
): boolean => loaded && !addon && (!loadError || isNotFoundError(loadError));

type UpstreamDetectionResult = {
  detected: boolean;
  pending: boolean;
};

const useUpstreamSubmarinerDetection = (
  clusterName: string | undefined,
  enabled: boolean,
  t: TFunction
): UpstreamDetectionResult => {
  const [result, setResult] = React.useState<UpstreamDetectionResult>({
    detected: false,
    pending: false,
  });

  React.useEffect(() => {
    if (!enabled || !clusterName) {
      setResult({ detected: false, pending: false });
      return;
    }

    let cancelled = false;
    setResult({ detected: false, pending: true });

    fireManagedClusterView(
      SUBMARINER_RESOURCE_NAME,
      SUBMARINER_OPERATOR_NAMESPACE,
      SUBMARINER_GVK.kind,
      SUBMARINER_GVK.version,
      SUBMARINER_GVK.group,
      clusterName,
      t
    )
      .then((response) => {
        if (!cancelled) {
          setResult({ detected: !!response.result, pending: false });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ detected: false, pending: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clusterName, enabled, t]);

  return result;
};

export const usePrePairNetworkValidation = (
  clusterNames: string[],
  enabled: boolean
): PrePairNetworkValidationState => {
  const { t } = useCustomTranslation();
  const clusterA = clusterNames[0];
  const clusterB = clusterNames[1];
  const shouldWatch = enabled && clusterNames.length === MAX_ALLOWED_CLUSTERS;

  const [addonsA, loadedA, errorA] = useK8sWatchResource<SubmarinerAddOnKind[]>(
    getValidWatchK8sResourceObj(
      getSubmarinerAddonListResourceObj(clusterA || ''),
      shouldWatch && !!clusterA
    )
  );
  const [addonsB, loadedB, errorB] = useK8sWatchResource<SubmarinerAddOnKind[]>(
    getValidWatchK8sResourceObj(
      getSubmarinerAddonListResourceObj(clusterB || ''),
      shouldWatch && !!clusterB
    )
  );
  const addonA = addonsA?.find(
    (addon) => getName(addon) === SUBMARINER_ADDON_NAME
  );
  const addonB = addonsB?.find(
    (addon) => getName(addon) === SUBMARINER_ADDON_NAME
  );

  const watchAcmGlobalnet =
    shouldWatch && ((loadedA && !!addonA) || (loadedB && !!addonB));

  const [brokers, brokersLoaded, brokersError] = useK8sWatchResource<
    SubmarinerBrokerKind[]
  >(
    getValidWatchK8sResourceObj(
      getSubmarinerBrokerListResourceObj(),
      watchAcmGlobalnet
    )
  );
  const [managedClusterA, managedClusterALoaded, managedClusterAError] =
    useK8sWatchResource<ACMManagedClusterKind>(
      getValidWatchK8sResourceObj(
        getManagedClusterResourceObj({ name: clusterA }),
        watchAcmGlobalnet && !!clusterA
      )
    );
  const [managedClusterB, managedClusterBLoaded, managedClusterBError] =
    useK8sWatchResource<ACMManagedClusterKind>(
      getValidWatchK8sResourceObj(
        getManagedClusterResourceObj({ name: clusterB }),
        watchAcmGlobalnet && !!clusterB
      )
    );
  const [
    submarinerClusters,
    submarinerClustersLoaded,
    submarinerClustersError,
  ] = useK8sWatchResource<SubmarinerClusterKind[]>(
    getValidWatchK8sResourceObj(
      getSubmarinerClusterListResourceObj(),
      watchAcmGlobalnet
    )
  );

  const shouldDetectUpstreamA =
    shouldWatch && !!clusterA && isAddonAbsent(loadedA, addonA, errorA);
  const shouldDetectUpstreamB =
    shouldWatch && !!clusterB && isAddonAbsent(loadedB, addonB, errorB);
  const upstreamA = useUpstreamSubmarinerDetection(
    clusterA,
    shouldDetectUpstreamA,
    t
  );
  const upstreamB = useUpstreamSubmarinerDetection(
    clusterB,
    shouldDetectUpstreamB,
    t
  );

  if (!shouldWatch) {
    return idleState;
  }

  // While the upstream lookup is in flight, keep the cluster in the
  // "checking" state instead of briefly reporting "not installed".
  const submarinerResult = evaluateSubmarinerPrePair([
    {
      clusterName: clusterA,
      addon: addonA,
      loaded: loadedA && !upstreamA.pending,
      loadError: errorA,
      upstreamDetected: upstreamA.detected,
    },
    {
      clusterName: clusterB,
      addon: addonB,
      loaded: loadedB && !upstreamB.pending,
      loadError: errorB,
      upstreamDetected: upstreamB.detected,
    },
  ]);

  const skipGlobalnetCheck =
    submarinerResult.overallHealth === SubmarinerClusterHealth.NotInstalled ||
    submarinerResult.overallHealth === SubmarinerClusterHealth.UpstreamDetected;

  const globalnet = evaluateGlobalnetPrePair(
    brokers,
    watchAcmGlobalnet ? brokersLoaded : true,
    watchAcmGlobalnet ? brokersError : null,
    [
      {
        clusterName: clusterA,
        clusterClaims: managedClusterA?.status?.clusterClaims,
        loaded: watchAcmGlobalnet ? managedClusterALoaded : true,
        loadError: watchAcmGlobalnet ? managedClusterAError : null,
      },
      {
        clusterName: clusterB,
        clusterClaims: managedClusterB?.status?.clusterClaims,
        loaded: watchAcmGlobalnet ? managedClusterBLoaded : true,
        loadError: watchAcmGlobalnet ? managedClusterBError : null,
      },
    ],
    submarinerClusters,
    watchAcmGlobalnet ? submarinerClustersLoaded : true,
    skipGlobalnetCheck
  );

  const loaded =
    loadedA &&
    loadedB &&
    !upstreamA.pending &&
    !upstreamB.pending &&
    (!watchAcmGlobalnet ||
      (brokersLoaded &&
        managedClusterALoaded &&
        managedClusterBLoaded &&
        submarinerClustersLoaded));

  const loadError = [
    errorA,
    errorB,
    ...(watchAcmGlobalnet
      ? [
          brokersError,
          managedClusterAError,
          managedClusterBError,
          submarinerClustersError,
        ]
      : []),
  ].find((error) => error && !isNotFoundError(error));

  return {
    loaded,
    loadError,
    canProceed: !loadError && submarinerResult.canProceed,
    submarinerOverallHealth: submarinerResult.overallHealth,
    globalnetStatus: globalnet.status,
    globalnetRequirement: globalnet.requirement,
    clusterStatuses: submarinerResult.clusterStatuses,
  };
};
