export const SUBMARINER_ADDON_NAME = 'submariner';
export const SUBMARINER_BROKER_NAME = 'submariner-broker';
export const SUBMARINER_BROKER_NAMESPACE = 'submariner-k8s-broker';
export const SUBMARINER_OPERATOR_NAMESPACE = 'submariner-operator';
// Spoke Submariner CR is always named 'submariner' regardless of install method.
export const SUBMARINER_RESOURCE_NAME = 'submariner';

// Watch resources use references; ManagedClusterView requires separate GVK fields.
export const SUBMARINER_ADDON_KIND =
  'addon.open-cluster-management.io~v1alpha1~ManagedClusterAddOn';
export const SUBMARINER_BROKER_KIND = 'submariner.io~v1alpha1~Broker';
export const SUBMARINER_CLUSTER_KIND = 'submariner.io~v1~Cluster';

export const SUBMARINER_GVK = {
  group: 'submariner.io',
  version: 'v1alpha1',
  kind: 'Submariner',
} as const;

export const SUBMARINER_CONDITION_TYPES = {
  AVAILABLE: 'Available',
  CONNECTION_DEGRADED: 'SubmarinerConnectionDegraded',
  ROUTE_AGENT_CONNECTION_DEGRADED: 'RouteAgentConnectionDegraded',
  AGENT_DEGRADED: 'SubmarinerAgentDegraded',
  GATEWAY_NODES_LABELED: 'SubmarinerGatewayNodesLabeled',
} as const;

export const NETWORK_CLUSTER_CLAIM_NAMES = [
  'network.openshift.io',
  'network.cluster.open-cluster-management.io',
] as const;

export enum SubmarinerClusterHealth {
  NotInstalled = 'notInstalled',
  UpstreamDetected = 'upstreamDetected',
  Checking = 'checking',
  Healthy = 'healthy',
  Progressing = 'progressing',
  Degraded = 'degraded',
}

export enum GlobalnetCheckStatus {
  Skipped = 'skipped',
  Checking = 'checking',
  Enabled = 'enabled',
  Disabled = 'disabled',
  NotFound = 'notFound',
}

export enum GlobalnetRequirement {
  Skipped = 'skipped',
  Checking = 'checking',
  Unknown = 'unknown',
  Required = 'required',
  NotRequired = 'notRequired',
}
