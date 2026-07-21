import * as React from 'react';
import { PrePairNetworkValidationState } from '@odf/mco/hooks';
import { DOC_VERSION, tpsDoc } from '@odf/shared';
import { getName } from '@odf/shared/selectors';
import { GreenCheckCircleIcon } from '@odf/shared/status';
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
import { ClusterS3BucketDetailsForm } from './add-s3-bucket-details/s3-bucket-details-form';
import { PrePairNetworkValidation } from './pre-pair-network-validation';
import { SelectReplicationBackend } from './select-replication-backend/select-replication-backend';
import ThirdPartyStorageWarning from './third-party-storage-alert';
import { shouldShowReplicationBackendSelection } from './utils/backend-selection';
import { DRPolicyAction, DRPolicyState } from './utils/reducer';

type ConfigureClusterPairStepProps = {
  state: DRPolicyState;
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
  state,
  dispatch,
  clusterNames,
  selectedDRClusters,
  validation,
  docHref,
  errorMessage,
}) => {
  const { t } = useCustomTranslation();
  const isDataFoundation =
    state.replicationBackend === BackendType.DataFoundation;
  const isThirdParty = state.replicationBackend === BackendType.ThirdParty;
  const showBackendSelection = shouldShowReplicationBackendSelection(
    state.selectedClustersHaveODF,
    state.selectedClusters
  );

  return (
    <Form className="mco-create-data-policy__body">
      <Title headingLevel="h2" size="lg" className="pf-v6-u-mb-md">
        {t('Configure cluster pair')}
      </Title>
      <Content className="pf-v6-u-mb-lg">
        <Content component={ContentVariants.small}>
          {isThirdParty
            ? t('Select an existing pair of clusters or two unpaired clusters.')
            : t(
                'The first time a policy is created between two clusters, the clusters must be paired together.'
              )}
        </Content>
      </Content>

      {showBackendSelection && (
        <FormGroup fieldId="select-backend" label={t('Select replication')}>
          <FormHelperText>
            <HelperText className="mco-create-data-policy__text-input">
              <HelperTextItem>
                {t(
                  'All disaster recovery prerequisites are met for both clusters. Multiple storage backends are available on both of the selected clusters.'
                )}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
          <SelectReplicationBackend
            clusterNames={clusterNames}
            doClustersHaveODF={state.selectedClustersHaveODF}
            dispatch={dispatch}
            selectedKey={state.replicationBackend}
          />
        </FormGroup>
      )}

      {isDataFoundation && (
        <>
          {showBackendSelection && (
            <HelperText className="pf-v6-u-mb-md">
              <HelperTextItem icon={<GreenCheckCircleIcon />}>
                {t('All prerequisites met')}
              </HelperTextItem>
            </HelperText>
          )}
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
              selectedClusters={state.selectedClusters}
              cluster1Details={state.cluster1S3Details}
              cluster2Details={state.cluster2S3Details}
              useSameConnection={state.useSameS3Connection}
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
