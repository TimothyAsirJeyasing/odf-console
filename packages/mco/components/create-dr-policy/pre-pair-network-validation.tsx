import * as React from 'react';
import {
  GlobalnetCheckStatus,
  GlobalnetRequirement,
  SubmarinerClusterHealth,
} from '@odf/mco/constants';
import { PrePairNetworkValidationState } from '@odf/mco/hooks';
import {
  isMixedSubmarinerInstall,
  isMixedSubmarinerInstallMethod,
} from '@odf/mco/utils/submariner-health';
import { StatusBox } from '@odf/shared/generic/status-box';
import {
  GreenCheckCircleIcon,
  RedExclamationCircleIcon,
  YellowExclamationTriangleIcon,
} from '@odf/shared/status';
import { useCustomTranslation } from '@odf/shared/useCustomTranslationHook';
import { ViewDocumentation } from '@odf/shared/utils';
import { StatusIconAndText } from '@openshift-console/dynamic-plugin-sdk';
import { TFunction } from 'react-i18next';
import {
  Content,
  ContentVariants,
  Spinner,
  Title,
} from '@patternfly/react-core';

type StatusLine = {
  icon: React.ReactElement;
  title: string;
  description?: string;
  showDocLink?: boolean;
};

const getSubmarinerStatusLine = (
  health: SubmarinerClusterHealth,
  upstreamMessage: string | undefined,
  failureMessage: string | undefined,
  t: TFunction
): StatusLine => {
  switch (health) {
    case SubmarinerClusterHealth.Checking:
      return {
        icon: <Spinner size="sm" />,
        title: t('Checking cluster network connectivity...'),
      };
    case SubmarinerClusterHealth.Progressing:
      return {
        icon: <Spinner size="sm" />,
        title: t('Cluster network configuration in progress'),
      };
    case SubmarinerClusterHealth.Healthy:
      return {
        icon: <GreenCheckCircleIcon />,
        title: t('Cluster network connected'),
      };
    case SubmarinerClusterHealth.UpstreamDetected:
      return {
        icon: <YellowExclamationTriangleIcon />,
        title: t('Cluster network - Skipped'),
        description: upstreamMessage,
      };
    case SubmarinerClusterHealth.Degraded:
      return {
        icon: <RedExclamationCircleIcon />,
        title: t('Degraded - Cluster unhealthy'),
        description: failureMessage,
        showDocLink: true,
      };
    case SubmarinerClusterHealth.NotInstalled:
    default:
      return {
        icon: <YellowExclamationTriangleIcon />,
        title: t('Cluster network - Skipped'),
        description: t(
          'Deployment is not using submariner. Selected cluster pairs lack submariner addon'
        ),
      };
  }
};

const getGlobalnetStatusLine = (
  status: GlobalnetCheckStatus,
  requirement: GlobalnetRequirement,
  t: TFunction
): StatusLine => {
  if (
    status === GlobalnetCheckStatus.Checking ||
    requirement === GlobalnetRequirement.Checking
  ) {
    return {
      icon: <Spinner size="sm" />,
      title: t('Enabling...'),
    };
  }

  if (
    status === GlobalnetCheckStatus.NotFound &&
    requirement === GlobalnetRequirement.Required
  ) {
    return {
      icon: <YellowExclamationTriangleIcon />,
      title: t('Not enabled'),
      description: t(
        'Globalnet is required as CIDRs overlap. Broker is missing'
      ),
      showDocLink: true,
    };
  }

  switch (status) {
    case GlobalnetCheckStatus.Enabled:
      return {
        icon: <GreenCheckCircleIcon />,
        title: t('Enabled'),
        description:
          requirement === GlobalnetRequirement.Required
            ? t(
                'Globalnet is on. Cluster networks have overlapping Pod or Service CIDR.'
              )
            : t('Globalnet is on. Cluster networks do not overlap'),
      };
    case GlobalnetCheckStatus.Disabled:
      return {
        icon: <YellowExclamationTriangleIcon />,
        title: t('Not enabled'),
        description: t('Globalnet is off'),
        showDocLink: true,
      };
    case GlobalnetCheckStatus.NotFound:
    default:
      return {
        icon: <YellowExclamationTriangleIcon />,
        title: t('Not enabled'),
        description: t('Submariner broker configuration not found'),
        showDocLink: true,
      };
  }
};

const StatusSection: React.FC<StatusSectionProps> = ({
  heading,
  line,
  docHref,
}) => (
  <>
    <Title headingLevel="h4" size="md" className="pf-v6-u-mb-sm">
      {heading}
    </Title>
    <StatusIconAndText icon={line.icon} title={line.title} />
    {(line.description || (line.showDocLink && docHref)) && (
      <Content component={ContentVariants.small} className="pf-v6-u-mt-xs">
        {line.description}
        {line.showDocLink && !!docHref && (
          <ViewDocumentation
            doclink={docHref}
            padding={line.description ? '0 10px' : '0'}
          />
        )}
      </Content>
    )}
  </>
);

export const PrePairNetworkValidation: React.FC<
  PrePairNetworkValidationProps
> = ({ clusterNames, validation, docHref }) => {
  const { t } = useCustomTranslation();

  const {
    submarinerOverallHealth,
    globalnetStatus,
    globalnetRequirement,
    clusterStatuses,
  } = validation;

  const mixedInstallMessage = isMixedSubmarinerInstall(clusterStatuses)
    ? t('Submariner is not installed on one or both selected cluster pairs')
    : undefined;
  let upstreamDetectedMessage: string | undefined;
  if (submarinerOverallHealth === SubmarinerClusterHealth.UpstreamDetected) {
    upstreamDetectedMessage = isMixedSubmarinerInstallMethod(clusterStatuses)
      ? t(
          'Upstream Submariner detected. Advanced validation is only available for ACM-managed Submariner. The selected clusters use different Submariner installation methods.'
        )
      : t(
          'Upstream Submariner detected. Advanced validation is only available for ACM-managed Submariner.'
        );
  }

  const submariner = getSubmarinerStatusLine(
    submarinerOverallHealth,
    upstreamDetectedMessage,
    mixedInstallMessage,
    t
  );
  const isSubmarinerDegraded =
    submarinerOverallHealth === SubmarinerClusterHealth.Degraded;
  const showGlobalnet = globalnetStatus !== GlobalnetCheckStatus.Skipped;
  const globalnet = getGlobalnetStatusLine(
    globalnetStatus,
    globalnetRequirement,
    t
  );

  return (
    <StatusBox
      data={clusterNames}
      loaded={validation.loaded}
      loadError={validation.loadError}
      skeleton={
        <StatusIconAndText
          icon={<Spinner size="sm" />}
          title={t('Checking cluster network connectivity...')}
        />
      }
    >
      <StatusSection
        heading={t('Submariner')}
        line={submariner}
        docHref={docHref}
      />
      {isSubmarinerDegraded &&
        clusterStatuses
          .filter(
            (status) => status.health === SubmarinerClusterHealth.Degraded
          )
          .map((status) => (
            <Content component={ContentVariants.small} key={status.clusterName}>
              {status.clusterName}
              {status.message ? `: ${status.message}` : ''}
            </Content>
          ))}
      {showGlobalnet && (
        <div className="pf-v6-u-mt-md">
          <StatusSection
            heading={t('Globalnet')}
            line={globalnet}
            docHref={docHref}
          />
        </div>
      )}
    </StatusBox>
  );
};

type StatusSectionProps = {
  heading: string;
  line: StatusLine;
  docHref?: string;
};

type PrePairNetworkValidationProps = {
  clusterNames: string[];
  validation: PrePairNetworkValidationState;
  docHref?: string;
};
