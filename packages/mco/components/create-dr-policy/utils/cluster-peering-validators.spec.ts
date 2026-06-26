import { DRPolicyModel } from '@odf/shared';
import { DRPolicyKind, MirrorPeerKind } from '../../../types';
import {
  checkSyncPolicyExists,
  hasConflictingPeering,
  verifyMirrorPeerExistence,
} from './cluster-peering-validators';

const mirrorPeer = (
  cluster1: string,
  cluster2: string
): MirrorPeerKind => ({
  apiVersion: 'multicluster.odf.openshift.io/v1alpha1',
  kind: 'MirrorPeer',
  metadata: { name: `mirrorpeer-${cluster1}-${cluster2}` },
  spec: {
    items: [
      {
        clusterName: cluster1,
        storageClusterRef: { name: 'ocs-storagecluster' },
      },
      {
        clusterName: cluster2,
        storageClusterRef: { name: 'ocs-storagecluster' },
      },
    ],
  },
});

const syncDRPolicy = (clusters: string[]): DRPolicyKind => ({
  apiVersion: `${DRPolicyModel.apiGroup}/${DRPolicyModel.apiVersion}`,
  kind: DRPolicyModel.kind,
  metadata: { name: 'sync-policy' },
  spec: {
    drClusters: clusters,
    schedulingInterval: '0m',
  },
});

describe('cluster-peering-validators', () => {
  describe('verifyMirrorPeerExistence', () => {
    it('returns false when no MirrorPeer references the selected clusters', () => {
      expect(
        verifyMirrorPeerExistence(['A', 'B'], [mirrorPeer('C', 'D')])
      ).toBe(false);
    });

    it('returns false when the same pair already exists (reuse allowed)', () => {
      expect(
        verifyMirrorPeerExistence(['A', 'B'], [mirrorPeer('A', 'B')])
      ).toBe(false);
    });

    it('returns true when a selected cluster is paired with a different cluster', () => {
      expect(
        verifyMirrorPeerExistence(['A', 'B'], [mirrorPeer('A', 'C')])
      ).toBe(true);
    });
  });

  describe('checkSyncPolicyExists', () => {
    it('returns true when a sync DRPolicy already covers the selected clusters', () => {
      expect(
        checkSyncPolicyExists(['east-1', 'east-2'], [
          syncDRPolicy(['east-1', 'east-2']),
        ])
      ).toBe(true);
    });

    it('returns false for async policies', () => {
      expect(
        checkSyncPolicyExists(['east-1', 'west-1'], [
          {
            ...syncDRPolicy(['east-1', 'west-1']),
            spec: { drClusters: ['east-1', 'west-1'], schedulingInterval: '5m' },
          },
        ])
      ).toBe(false);
    });
  });

  describe('hasConflictingPeering', () => {
    it('blocks conflicting mirror peer pairs', () => {
      expect(
        hasConflictingPeering(['A', 'B'], [mirrorPeer('A', 'C')], [])
      ).toBe(true);
    });

    it('allows reuse of the same mirror peer pair', () => {
      expect(
        hasConflictingPeering(['A', 'B'], [mirrorPeer('A', 'B')], [])
      ).toBe(false);
    });

    it('allows creating a new pair when no mirror peer exists', () => {
      expect(hasConflictingPeering(['A', 'B'], [], [])).toBe(false);
    });
  });
});
