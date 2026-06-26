import { ReplicationType } from '@odf/mco/constants';
import { DRPolicyKind, MirrorPeerKind } from '@odf/mco/types';
import { getReplicationType } from '@odf/mco/utils';
import { getName } from '@odf/shared';
import { ManagedClusterInfoType } from './reducer';

/**
 * Returns true when a selected cluster is already in a MirrorPeer with a different
 * cluster than the one being paired. Reuse of the same pair (A+B again) is allowed.
 */
export const verifyMirrorPeerExistence = (
  clusterNames: string[],
  mirrorPeers: MirrorPeerKind[]
): boolean => {
  const peerNames = clusterNames;
  const mirrorPeer = mirrorPeers.find((mp) =>
    mp.spec?.items?.some((item) => peerNames.includes(item.clusterName))
  );
  const existingPeerNames =
    mirrorPeer?.spec?.items?.map((item) => item.clusterName) ?? [];
  return existingPeerNames.length > 0
    ? existingPeerNames.sort().join(',') !== peerNames.sort().join(',')
    : false;
};

export const verifyMirrorPeerExistenceForClusters = (
  clusters: ManagedClusterInfoType[],
  mirrorPeers: MirrorPeerKind[]
): boolean => verifyMirrorPeerExistence(clusters.map(getName), mirrorPeers);

export const checkSyncPolicyExists = (
  clusters: string[],
  drPolicies: DRPolicyKind[]
): boolean =>
  drPolicies.some((drPolicy) => {
    const { drClusters } = drPolicy.spec;
    const isSyncPolicy = getReplicationType(drPolicy) === ReplicationType.SYNC;
    return (
      isSyncPolicy && drClusters.every((cluster) => clusters.includes(cluster))
    );
  });

/**
 * Block conflicting pairs (e.g. A+C exists, user selects A+B).
 * Allow reuse when the same pair already has a MirrorPeer or sync DRPolicy.
 */
export const hasConflictingPeering = (
  clusterNames: string[],
  mirrorPeers: MirrorPeerKind[],
  drPolicies: DRPolicyKind[]
): boolean =>
  checkSyncPolicyExists(clusterNames, drPolicies) ||
  verifyMirrorPeerExistence(clusterNames, mirrorPeers);
