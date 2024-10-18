import * as React from 'react';
import { ActionDropdownItems } from '@odf/shared/dropdown/action-dropdown';
import { getName, getNamespace } from '@odf/shared/selectors';
import {
  GrayUnknownIcon,
  GreenCheckCircleIcon,
  RedExclamationCircleIcon,
  YellowExclamationTriangleIcon,
} from '@odf/shared/status/icons';
import { sortRows, referenceForModel } from '@odf/shared/utils';
import { LaunchModal } from '@openshift-console/dynamic-plugin-sdk/lib/app/modal-support/ModalProvider';
import * as _ from 'lodash-es';
import { TFunction } from 'react-i18next';
import { NavigateFunction } from 'react-router-dom-v5-compat';
import {
  AlertProps,
  AlertVariant,
  AlertActionCloseButton,
} from '@patternfly/react-core';
import { IAction } from '@patternfly/react-table';
import {
  VOLUME_REPLICATION_HEALTH,
  DRPC_STATUS,
  DR_BASE_ROUTE,
  DRActionType,
  REPLICATION_TYPE,
} from '../../constants';
import { DRPlacementControlModel } from '../../models';
import { DRPlacementControlKind, Progression } from '../../types';
import { DiscoveredApplicationParser as DiscoveredApplicationModal } from '../modals/app-failover-relocate/parser/discovered-application-parser';
import RemoveDisasterRecoveryModal from '../modals/remove-disaster-recovery/remove-disaster-recovery';

export const drpcDetailsPageRoute = (drpc: DRPlacementControlKind) =>
  `/k8s/ns/${getNamespace(drpc)}/${referenceForModel(
    DRPlacementControlModel
  )}/${getName(drpc)}`;

export const getAlertMessages = (
  t: TFunction<string>,
  application: string,
  navigate: NavigateFunction
): AlertProps[] => [
  ...(!!application
    ? [
        {
          variant: AlertVariant.success,
          title: t(
            '{{appName}} is now successfully enrolled for disaster recovery protection.',
            { appName: application }
          ),
          actionClose: (
            <AlertActionCloseButton
              onClose={() =>
                navigate(`${DR_BASE_ROUTE}/protected-applications`)
              }
            />
          ),
          isInline: true,
          key: 'enrolled_success',
        },
      ]
    : []),
  {
    variant: AlertVariant.info,
    title: t(
      'For disaster recovery or replication details about ACM managed applications navigate to Applications overview page.'
    ),
    isInline: true,
    key: 'navigation_info',
  },
];

export const isFailingOrRelocating = (
  application: DRPlacementControlKind
): boolean =>
  [DRPC_STATUS.FailingOver, DRPC_STATUS.Relocating].includes(
    application?.status?.phase as DRPC_STATUS
  );

export const isCleanupPending = (drpc: DRPlacementControlKind): boolean =>
  [DRPC_STATUS.FailedOver, DRPC_STATUS.Relocating].includes(
    drpc?.status?.phase as DRPC_STATUS
  ) && drpc?.status?.progression === Progression.WaitOnUserToCleanUp;

export type ReplicationHealthMap = {
  title: string;
  icon: JSX.Element;
  priority: number;
};

export const replicationHealthMap = (
  health: VOLUME_REPLICATION_HEALTH,
  t: TFunction<string>
): ReplicationHealthMap => {
  switch (health) {
    case VOLUME_REPLICATION_HEALTH.CRITICAL:
      return {
        title: t('Critical'),
        icon: <RedExclamationCircleIcon />,
        priority: 3,
      };
    case VOLUME_REPLICATION_HEALTH.WARNING:
      return {
        title: t('Warning'),
        icon: <YellowExclamationTriangleIcon />,
        priority: 2,
      };
    case VOLUME_REPLICATION_HEALTH.HEALTHY:
      return {
        title: t('Healthy'),
        icon: <GreenCheckCircleIcon />,
        priority: 0,
      };
    default:
      return {
        title: t('Unknown'),
        icon: <GrayUnknownIcon />,
        priority: 1,
      };
  }
};

export type SyncStatusInfo = {
  volumeReplicationStatus: VOLUME_REPLICATION_HEALTH;
  volumeReplicationType: REPLICATION_TYPE;
  volumeLastGroupSyncTime: string;
  kubeObjectReplicationStatus: VOLUME_REPLICATION_HEALTH;
  kubeObjectLastProtectionTime: string;
  replicationType: REPLICATION_TYPE;
};

export const getAppWorstSyncStatus = (
  syncStatusInfo: SyncStatusInfo,
  t: TFunction<string>
): ReplicationHealthMap => {
  const volumeStatus = syncStatusInfo.volumeReplicationStatus;
  const kubeObjectStatus = syncStatusInfo.kubeObjectReplicationStatus;
  const volumeStatusObj = replicationHealthMap(volumeStatus, t);
  const kubeObjectStatusObj = replicationHealthMap(kubeObjectStatus, t);
  return volumeStatusObj.priority > kubeObjectStatusObj.priority
    ? volumeStatusObj
    : kubeObjectStatusObj;
};

export const getColumnNames = (t: TFunction<string>) => [
  '', // expandable icon
  t('Name'),
  t('Details'),
  t('Overall sync status'),
  t('Policy'),
  t('Cluster'),
  '', // action kebab
];

export const getHeaderColumns = (t: TFunction<string>) => {
  const columnNames = getColumnNames(t);
  return [
    {
      columnName: columnNames[0],
    },
    {
      columnName: columnNames[1],
      sortFunction: (a, b, c) => sortRows(a, b, c, 'metadata.name'),
    },
    {
      columnName: columnNames[2],
    },
    {
      columnName: columnNames[3],
    },
    {
      columnName: columnNames[4],
      sortFunction: (a, b, c) => sortRows(a, b, c, 'spec.drPolicyRef.name'),
    },
    {
      columnName: columnNames[5],
    },
    {
      columnName: columnNames[6],
    },
  ];
};

export const getRowActions = (
  t: TFunction<string>,
  launcher: LaunchModal,
  navigate: NavigateFunction,
  rowItem: DRPlacementControlKind
): IAction[] => [
  {
    title: (
      <>
        {t('Edit configuration')}
        <p className="text-muted pf-v5-u-font-size-xs">
          {t('Update existing configuration in YAML view')}
        </p>
      </>
    ),
    onClick: () => navigate(`${drpcDetailsPageRoute(rowItem)}/yaml`),
  },
  {
    title: (
      <>
        {t('Failover')}
        <p className="text-muted pf-v5-u-font-size-xs">
          {t('Move workloads to target cluster')}
        </p>
      </>
    ),
    onClick: () =>
      launcher(DiscoveredApplicationModal, {
        isOpen: true,
        extraProps: { application: rowItem, action: DRActionType.FAILOVER },
      }),
  },
  {
    title: (
      <>
        {t('Relocate')}
        <p className="text-muted pf-v5-u-font-size-xs">
          {t('Failback workloads to primary cluster')}
        </p>
      </>
    ),
    onClick: () =>
      launcher(DiscoveredApplicationModal, {
        isOpen: true,
        extraProps: { application: rowItem, action: DRActionType.RELOCATE },
      }),
  },
  {
    title: t('Remove disaster recovery'),
    ...(_.has(rowItem.metadata, 'deletionTimestamp')
      ? {
          isAriaDisabled: true,
          tooltipProps: {
            content: t('Resource is being deleted.'),
            trigger: 'mouseenter',
          },
        }
      : {}),
    onClick: () =>
      launcher(RemoveDisasterRecoveryModal, {
        isOpen: true,
        extraProps: { application: rowItem },
      }),
  },
];

export const enum EnrollApplicationTypes {
  CHOOSE_TYPE = 'CHOOSE_TYPE',
  DISCOVERED = 'DISCOVERED',
  MANAGED = 'MANAGED',
}

export const getEnrollDropdownItems = (
  t: TFunction<string>
): ActionDropdownItems[] => [
  {
    id: EnrollApplicationTypes.CHOOSE_TYPE,
    isDisabled: true,
    text: t('Choose a type:'),
  },
  {
    id: EnrollApplicationTypes.DISCOVERED,
    isDisabled: false,
    text: t('ACM discovered applications'),
  },
  {
    id: EnrollApplicationTypes.MANAGED,
    isDisabled: false,
    text: t('ACM managed applications'),
  },
];
