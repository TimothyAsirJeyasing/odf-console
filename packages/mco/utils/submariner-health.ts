import {
  MAX_ALLOWED_CLUSTERS,
  SUBMARINER_CONDITION_TYPES,
  SubmarinerStatus,
} from '@odf/mco/constants';
import { SubmarinerAddOnKind } from '@odf/mco/types';
import {
  K8sResourceCondition,
  K8sResourceConditionStatus,
} from '@odf/shared/types';
import { isNotFoundError } from '@odf/shared/utils';

const findSubmarinerCondition = (
  conditions: K8sResourceCondition[] | undefined,
  type: string
): K8sResourceCondition | undefined => {
  if (!conditions?.length) {
    return undefined;
  }
  const normalizedType = type.toLowerCase();
  return conditions.find(
    (current) => current.type?.toLowerCase() === normalizedType
  );
};

const isConditionStatus = (
  condition: Pick<K8sResourceCondition, 'status'> | undefined,
  status: string
): boolean => condition?.status?.toLowerCase() === status.toLowerCase();

// Watch 404 = resource/API absent on the hub, not a degraded install.
const isSubmarinerResourceAbsent = (loadError: unknown): boolean =>
  !!loadError && isNotFoundError(loadError);

const getClusterSubmarinerStatus = (
  addon: SubmarinerAddOnKind | undefined,
  loaded: boolean,
  loadError: unknown
): SubmarinerStatus => {
  if (!loaded) {
    return SubmarinerStatus.Checking;
  }

  if (isSubmarinerResourceAbsent(loadError)) {
    return SubmarinerStatus.NotInstalled;
  }

  if (loadError) {
    return SubmarinerStatus.Degraded;
  }

  if (!addon) {
    return SubmarinerStatus.NotInstalled;
  }

  const conditions = addon.status?.conditions ?? [];
  const available = findSubmarinerCondition(
    conditions,
    SUBMARINER_CONDITION_TYPES.AVAILABLE
  );
  const connectionDegraded = findSubmarinerCondition(
    conditions,
    SUBMARINER_CONDITION_TYPES.CONNECTION_DEGRADED
  );
  const routeAgentConnectionDegraded = findSubmarinerCondition(
    conditions,
    SUBMARINER_CONDITION_TYPES.ROUTE_AGENT_CONNECTION_DEGRADED
  );
  const agentDegraded = findSubmarinerCondition(
    conditions,
    SUBMARINER_CONDITION_TYPES.AGENT_DEGRADED
  );
  const gatewayNodesLabeled = findSubmarinerCondition(
    conditions,
    SUBMARINER_CONDITION_TYPES.GATEWAY_NODES_LABELED
  );

  if (!isConditionStatus(available, K8sResourceConditionStatus.True)) {
    return SubmarinerStatus.Progressing;
  }

  if (
    isConditionStatus(connectionDegraded, K8sResourceConditionStatus.True) ||
    isConditionStatus(
      routeAgentConnectionDegraded,
      K8sResourceConditionStatus.True
    ) ||
    isConditionStatus(agentDegraded, K8sResourceConditionStatus.True) ||
    (gatewayNodesLabeled &&
      !isConditionStatus(gatewayNodesLabeled, K8sResourceConditionStatus.True))
  ) {
    return SubmarinerStatus.Degraded;
  }

  if (isConditionStatus(connectionDegraded, K8sResourceConditionStatus.False)) {
    return SubmarinerStatus.Healthy;
  }

  return SubmarinerStatus.Progressing;
};

export const evaluateSubmarinerPrePair = (
  clusters: Array<{
    addon: SubmarinerAddOnKind | undefined;
    loaded: boolean;
    loadError: unknown;
  }>
): { canProceed: boolean; status: SubmarinerStatus } => {
  if (!clusters.every(({ loaded }) => loaded)) {
    return { canProceed: false, status: SubmarinerStatus.Checking };
  }

  const statuses = clusters.map(({ addon, loaded, loadError }) =>
    getClusterSubmarinerStatus(addon, loaded, loadError)
  );

  const allNotInstalled = statuses.every(
    (status) => status === SubmarinerStatus.NotInstalled
  );
  if (allNotInstalled) {
    return { canProceed: true, status: SubmarinerStatus.NotInstalled };
  }

  const bothInstalled = statuses.every(
    (status) => status !== SubmarinerStatus.NotInstalled
  );
  if (!bothInstalled) {
    return { canProceed: false, status: SubmarinerStatus.Inconsistent };
  }

  if (statuses.some((status) => status === SubmarinerStatus.Degraded)) {
    return { canProceed: false, status: SubmarinerStatus.Degraded };
  }

  if (statuses.some((status) => status === SubmarinerStatus.Progressing)) {
    return { canProceed: false, status: SubmarinerStatus.Progressing };
  }

  if (statuses.every((status) => status === SubmarinerStatus.Healthy)) {
    return { canProceed: true, status: SubmarinerStatus.Healthy };
  }

  return { canProceed: false, status: SubmarinerStatus.Progressing };
};

export const shouldRunPrePairValidation = (
  selectedClusterCount: number,
  isClusterSelectionValid: boolean,
  isDataFoundation: boolean
): boolean =>
  isDataFoundation &&
  isClusterSelectionValid &&
  selectedClusterCount === MAX_ALLOWED_CLUSTERS;
