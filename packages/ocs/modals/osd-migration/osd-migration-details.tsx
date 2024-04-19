import * as React from 'react';
import { OSDMigrationStatus } from '@odf/core/constants';
import { getOSDMigrationStatus } from '@odf/ocs/utils';
import { CephClusterKind, StorageClusterKind } from '@odf/shared/types';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import {
  GreenCheckCircleIcon,
  RedExclamationCircleIcon,
  StatusIconAndText,
  useModal,
} from '@openshift-console/dynamic-plugin-sdk';
import { Button, Flex, FlexItem } from '@patternfly/react-core';
import OSDMigrationModal from './osd-migration-modal';

type OSDMigrationDetailsProps = {
  cephData: CephClusterKind;
  ocsData: StorageClusterKind;
  loaded: boolean;
  loadError: any;
  onMigrationStart?: () => void;
  onCancel: () => void;
};

export const OSDMigrationDetails: React.FC<OSDMigrationDetailsProps> = ({
  cephData,
  ocsData,
  loaded,
  loadError,
  onMigrationStart,
  onCancel,
}) => {
  const { t } = useCustomTranslation();
  const osdMigrationStatus: string =
    !loadError && loaded ? getOSDMigrationStatus(cephData) : null;
  const launcher = useModal();

  if (!loaded || loadError) return <></>;

  const handleMigrationClick = () => {
    launcher(OSDMigrationModal, {
      isOpen: true,
      extraProps: { ocsData },
      onMigrationStart,
      closeModal: onCancel,
    });
  };

  return (
    <>
      <Flex className="pf-v5-u-ml-xs">
        <FlexItem>
          <StatusIconAndText
            title={osdMigrationStatus}
            icon={
              (osdMigrationStatus === OSDMigrationStatus.FAILED && (
                <RedExclamationCircleIcon />
              )) ||
              (osdMigrationStatus === OSDMigrationStatus.COMPLETED && (
                <GreenCheckCircleIcon />
              ))
            }
          />
        </FlexItem>
        <FlexItem>
          {osdMigrationStatus === OSDMigrationStatus.PENDING && (
            <Button variant="link" onClick={handleMigrationClick}>
              {t('(Prepare cluster for DR setup)')}
            </Button>
          )}
        </FlexItem>
      </Flex>
    </>
  );
};
