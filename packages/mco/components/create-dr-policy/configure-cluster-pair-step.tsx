import * as React from 'react';
import { PrePairNetworkValidationState } from '@odf/mco/hooks';
import { DOC_VERSION, tpsDoc } from '@odf/shared';
import { getName } from '@odf/shared/selectors';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import {
  Alert,
  AlertVariant,
  Content,
  ContentVariants,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Title,
} from '@patternfly/react-core';
import { BackendType } from '../../constants';
import { DRClusterKind } from '../../types';
import {
  ClusterS3BucketDetailsForm,
  S3Details,
} from './add-s3-bucket-details/s3-bucket-details-form';
import { PrePairNetworkValidation } from './pre-pair-network-validation';
import ThirdPartyStorageWarning from './third-party-storage-alert';
import { DRPolicyAction, ManagedClusterInfoType } from './utils/reducer';

type ConfigureClusterPairStepProps = {
  replicationBackend: BackendType;
  selectedClusters: ManagedClusterInfoType[];
  cluster1S3Details: S3Details;
  cluster2S3Details: S3Details;
  useSameS3Connection: boolean;
  dispatch: React.Dispatch<DRPolicyAction>;
  clusterNames: string[];
  selectedDRClusters: DRClusterKind[];
  validation: PrePairNetworkValidationState;
  docHref?: string;
  errorMessage?: string;
};

export const ConfigureClusterPairStep: React.FC<
  ConfigureClusterPairStepProps
> = ({
  replicationBackend,
  selectedClusters,
  cluster1S3Details,
  cluster2S3Details,
  useSameS3Connection,
  dispatch,
  clusterNames,
  selectedDRClusters,
  validation,
  docHref,
  errorMessage,
}) => {
  const { t } = useCustomTranslation();
  const isDataFoundation = replicationBackend === BackendType.DataFoundation;
  const isThirdParty = replicationBackend === BackendType.ThirdParty;

  return (
    <Form className="mco-create-data-policy__body">
      <Title headingLevel="h2" size="lg" className="pf-v6-u-mb-md">
        {t('Configure cluster pair')}
      </Title>

      {isDataFoundation && (
        <>
          <Content className="pf-v6-u-mb-lg">
            <Content component={ContentVariants.small}>
              {t(
                'The first time a policy is created between two clusters, the clusters must be paired together.'
              )}
            </Content>
          </Content>
          <PrePairNetworkValidation
            clusterNames={clusterNames}
            validation={validation}
            docHref={docHref}
          />
        </>
      )}

      {isThirdParty && (
        <>
          <ThirdPartyStorageWarning docHref={tpsDoc(DOC_VERSION)} />
          <FormGroup
            fieldId="add-s3-bucket-details"
            label={t('Replication site')}
          >
            <FormHelperText>
              <HelperText className="mco-create-data-policy__text-input">
                <HelperTextItem>
                  {t(
                    'Provide S3 bucket connection details for each managed cluster. If a S3 bucket is not already configured for cluster, create one and then continue.'
                  )}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
            <ClusterS3BucketDetailsForm
              selectedClusters={selectedClusters}
              cluster1Details={cluster1S3Details}
              cluster2Details={cluster2S3Details}
              useSameConnection={useSameS3Connection}
              existingDRClusterNames={new Set(selectedDRClusters.map(getName))}
              dispatch={dispatch}
            />
          </FormGroup>
        </>
      )}

      {!!errorMessage && (
        <FormGroup fieldId="error-message">
          <Alert
            className="odf-alert mco-create-data-policy__alert"
            title={t('An error occurred')}
            variant={AlertVariant.danger}
            isInline
          >
            {errorMessage}
          </Alert>
        </FormGroup>
      )}
    </Form>
  );
};
