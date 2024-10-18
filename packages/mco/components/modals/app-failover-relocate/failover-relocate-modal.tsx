import * as React from 'react';
import { DRPolicyKind } from '@odf/mco/types';
import { getReplicationHealth } from '@odf/mco/utils';
import { getName } from '@odf/shared';
import { StatusBox } from '@odf/shared/generic';
import { ModalBody, ModalFooter } from '@odf/shared/modals/Modal';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import { getErrorMessage } from '@odf/shared/utils';
import { k8sPatch } from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'i18next';
import {
  Modal,
  Button,
  ModalVariant,
  ButtonType,
  ButtonVariant,
  Alert,
  AlertVariant,
} from '@patternfly/react-core';
import { DRActionType } from '../../../constants';
import { VOLUME_REPLICATION_HEALTH } from '../../../constants';
import { DRPlacementControlModel } from '../../../models';
import {
  ApplicationProps,
  PlacementControlProps,
  FailoverRelocateModalBody,
} from './failover-relocate-modal-body';

export enum ModalFooterStatus {
  INITIAL = 'intial',
  INPROGRESS = 'inProgress',
}

const getModalText = (t: TFunction) => ({
  [DRActionType.FAILOVER]: {
    title: t('Failover application'),
    description: t(
      'Failing over force stops active replication and deploys your application on the selected target cluster. Recommended only when the primary cluster is down.'
    ),
  },
  [DRActionType.RELOCATE]: {
    title: t('Relocate application'),
    description: t(
      'Relocating terminates your application on its current cluster, syncs its most recent snapshot to the selected target cluster, and then brings up your application.'
    ),
  },
});

export const FailoverRelocateModal: React.FC<FailoverRelocateModalProps> = (
  props
) => {
  const {
    applicationNamespace,
    action,
    isOpen,
    loaded,
    loadError,
    close,
    drPolicies,
  } = props;

  const { t } = useCustomTranslation();
  const modalText = getModalText(t)[action];
  const [errorMessage, setErrorMessage] = React.useState('');
  const [footerStatus, setFooterStatus] = React.useState(
    ModalFooterStatus.INITIAL
  );
  const [placementControl, setPlacementControl] =
    React.useState<PlacementControlProps>({});
  const [canInitiate, setCanInitiate] = React.useState(false);

  const lastGroupSyncTime = placementControl?.snapshotTakenTime;
  const drPolicyName = placementControl.drPolicyName;
  const volumesSchedulingInterval = drPolicyName
    ? drPolicies?.find((policy) => getName(policy) === drPolicyName)?.spec
        ?.schedulingInterval
    : undefined;
  const replicationType = placementControl?.replicationType;

  // Determine if sync is delayed (critical state)
  const replicationHealth = getReplicationHealth(
    lastGroupSyncTime,
    volumesSchedulingInterval,
    replicationType
  );
  const isSyncDelayed =
    replicationHealth === VOLUME_REPLICATION_HEALTH.CRITICAL;

  const onClick = () => {
    setFooterStatus(ModalFooterStatus.INPROGRESS);
    // Preferred cluster and failover cluster should not be the same for failover and relocate.
    const patch = [
      {
        op: 'replace',
        path: '/spec/action',
        value: action,
      },
      {
        op: 'replace',
        path: '/spec/failoverCluster',
        value:
          action === DRActionType.FAILOVER
            ? placementControl?.targetClusterName
            : placementControl?.primaryClusterName,
      },
      {
        op: 'replace',
        path: '/spec/preferredCluster',
        value:
          action === DRActionType.FAILOVER
            ? placementControl?.primaryClusterName
            : placementControl?.targetClusterName,
      },
    ];
    k8sPatch({
      model: DRPlacementControlModel,
      resource: {
        metadata: {
          name: placementControl?.drPlacementControlName,
          namespace: applicationNamespace,
        },
      },
      data: patch,
    })
      .then(() => {
        close();
      })
      .catch((error) => {
        setFooterStatus(ModalFooterStatus.INITIAL);
        setErrorMessage(getErrorMessage(error));
      });
  };

  return (
    <Modal
      title={modalText.title}
      description={modalText.description}
      isOpen={isOpen}
      onClose={close}
      variant={ModalVariant.medium}
    >
      <ModalBody>
        {loaded && !loadError ? (
          <>
            <FailoverRelocateModalBody
              {...props}
              canInitiate={canInitiate}
              setCanInitiate={setCanInitiate}
              setPlacement={setPlacementControl}
            />

            {isSyncDelayed && (
              <Alert
                variant={AlertVariant.warning}
                title={t('Inconsistent data on target cluster')}
                isInline
              >
                {t(
                  "The target cluster's volumes contain data inconsistencies caused by synchronization delays. Performing the failover could lead to data loss. Refer to the corresponding VolumeSynchronizationDelay OpenShift alert(s) for more information."
                )}
              </Alert>
            )}

            {(!!errorMessage || !!loadError) && (
              <Alert
                title={errorMessage || getErrorMessage(loadError)}
                variant={AlertVariant.danger}
                isInline
              />
            )}
          </>
        ) : (
          <StatusBox loaded={loaded} loadError={loadError} />
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="modal-cancel-action"
          id={'modal-cancel-action'}
          data-test-id={'modal-cancel-action'}
          type={ButtonType.button}
          variant={ButtonVariant.link}
          onClick={close}
        >
          {t('Cancel')}
        </Button>
        <Button
          key="modal-intiate-action"
          id={'modal-intiate-action'}
          data-test-id={'modal-intiate-action'}
          type={ButtonType.button}
          variant={ButtonVariant.primary}
          isDisabled={
            !canInitiate ||
            !!loadError ||
            footerStatus === ModalFooterStatus.INPROGRESS
          }
          isLoading={footerStatus === ModalFooterStatus.INPROGRESS}
          onClick={onClick}
        >
          {footerStatus === ModalFooterStatus.INITIAL
            ? t('Initiate')
            : t('Initiating')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

type FailoverRelocateModalProps = ApplicationProps & {
  isOpen: boolean;
  close?: () => void;
  drPolicies: DRPolicyKind[];
};
