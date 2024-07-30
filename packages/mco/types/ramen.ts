import { K8sResourceCondition, MatchLabels } from '@odf/shared/types';
import {
  K8sResourceCommon,
  ObjectReference,
} from '@openshift-console/dynamic-plugin-sdk';
import { Selector } from '@openshift-console/dynamic-plugin-sdk/lib/api/common-types';
import { DRActionType, DR_REPLICATION_STATE } from '../constants';

type ClusterStatus = {
  name: string;
  status: string;
};

export type DRPolicyKind = K8sResourceCommon & {
  spec?: {
    drClusters: string[];
    schedulingInterval: string;
    replicationClassSelector?: Selector;
  };
  status?: {
    conditions?: K8sResourceCondition[];
    drClusters?: {
      [key: string]: ClusterStatus;
    };
    phase: string;
  };
};

export type DRClusterKind = K8sResourceCommon & {
  spec?: {
    cidrs?: string[];
    clusterFence?: string;
    region?: string;
    S3ProfileName: string;
  };
  status?: {
    conditions?: K8sResourceCondition[];
    phase: string;
  };
};

export type DRPlacementControlKind = K8sResourceCommon & {
  spec: {
    // The reference to the DRPolicy participating in the DR replication for this DRPC.
    drPolicyRef: ObjectReference;
    // The reference to the PlacementRule/Placement used by DRPC.
    // N/A for the discovered apps.
    placementRef?: ObjectReference;
    // The cluster name that the user preferred to run the application on.
    preferredCluster?: string;
    //  The cluster name that the user wants to failover the application to.
    failoverCluster?: string;
    // To identify all the PVCs that need DR protection.
    pvcSelector: Selector;
    // Failover or Relocate
    action?: DRActionType;
    //  N/A for the managed applications.
    kubeObjectProtection?: {
      // Time interval to capture kube objects.
      captureInterval?: string;
      // Name of the Recipe to reference for capture and recovery workflows and volume selection.
      recipeRef?: {
        namespace?: string;
        name?: string;
      };
      // To identify all the kube objects that need DR protection.
      //  N/A for the managed  applications.
      kubeObjectSelector?: Selector;
    };
    //  A list of namespaces that are protected by the DRPC.
    //  N/A for the managed  applications.
    protectedNamespaces?: string[];
  };
  status?: {
    // The time of the most recent successful kube object protection
    lastKubeObjectProtectionTime?: string;
    conditions?: K8sResourceCondition[];
    resourceConditions?: {
      conditions?: K8sResourceCondition[];
      resourceMeta?: {
        protectedpvcs?: string[];
      };
    };
    phase: string;
    progression?: string;
    // The time of the most recent successful synchronization of all PVCs.
    lastGroupSyncTime?: string;
    preferredDecision?: {
      clusterName?: string;
      clusterNamespace?: string;
    };
  };
};

export type DRVolumeReplicationGroupKind = K8sResourceCommon & {
  spec: {
    action?: DRActionType;
    async?: {
      schedulingInterval?: string;
    };
  };
  status?: {
    state?: DR_REPLICATION_STATE;
    protectedPVCs?: {
      name?: string;
      protectedByVolSync?: boolean;
      storageClassName?: string;
      labels?: MatchLabels;
      accessModes?: string[];
      resources?: any;
      conditions?: K8sResourceCondition[];
      lastSyncTime?: string;
    }[];
    conditions?: K8sResourceCondition[];
    observedGeneration?: number;
    lastUpdateTime: string;
    kubeObjectProtection?: {
      captureToRecoverFrom?: {
        number: number;
        startTime: string;
      };
    };
    prepareForFinalSyncComplete?: boolean;
    finalSyncComplete?: boolean;
    lastGroupSyncTime?: string;
  };
};
