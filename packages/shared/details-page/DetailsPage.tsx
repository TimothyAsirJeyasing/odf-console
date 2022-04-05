import * as React from 'react';
import {
  HorizontalNav,
  K8sResourceCommon,
  NavPage,
  ResourceLink,
  useAccessReview,
} from '@openshift-console/dynamic-plugin-sdk';
import { K8sKind } from '@openshift-console/dynamic-plugin-sdk-internal/lib/api/common-types';
import classnames from 'classnames';
import * as _ from 'lodash';
import { useTranslation } from 'react-i18next';
import Linkify from 'react-linkify';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Popover,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { PencilAltIcon } from '@patternfly/react-icons';
import PageHeading from '../heading/page-heading';
import { LaunchModal, ModalKeys } from '../modals/modalLauncher';
import { ResourceIcon } from '../resource-link/resource-link';
import { getName } from '../selectors';
import { K8sResourceKind } from '../types';
import { referenceForModel } from '../utils';
import { getPropertyDescription } from '../utils/swagger';
import { LabelList } from './label-list';
import { OwnerReferences } from './owner-references';
import { Timestamp } from './timestamp';

type DetailsPageProps = {
  pages: NavPage[];
  actions?: any;
  resource: K8sResourceCommon;
  resourceModel: K8sKind;
  breadcrumbs?: { name: string; path: string }[];
};

type DetailsPageTitleProps = {
  resource: K8sResourceCommon;
  resourceModel: K8sKind;
};

const DetailsPageTitle: React.FC<DetailsPageTitleProps> = ({
  resource,
  resourceModel,
}) => (
  <span>
    <ResourceIcon resourceModel={resourceModel} />
    {getName(resource)}
  </span>
);

const DetailsPage: React.FC<DetailsPageProps> = ({
  pages,
  resource,
  actions,
  breadcrumbs,
  resourceModel,
}) => (
  <>
    <PageHeading
      breadcrumbs={breadcrumbs}
      title={
        <DetailsPageTitle resource={resource} resourceModel={resourceModel} />
      }
      actions={actions}
      resource={resource}
    />
    <HorizontalNav pages={pages} resource={resource} />
  </>
);

export default DetailsPage;

export type ResourceSummaryProps = {
  resource: K8sResourceKind;
  showPodSelector?: boolean;
  showNodeSelector?: boolean;
  showAnnotations?: boolean;
  showTolerations?: boolean;
  showLabelEditor?: boolean;
  canUpdateResource?: boolean;
  podSelector?: string;
  nodeSelector?: string;
  children?: React.ReactNode;
  customPathName?: string;
  launchModal: LaunchModal;
  resourceModel: K8sKind;
};

export const LinkifyExternal: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Linkify properties={{ target: '_blank', rel: 'noopener noreferrer' }}>
    {children}
  </Linkify>
);

export type DetailsItemProps = {
  canEdit?: boolean;
  defaultValue?: React.ReactNode;
  description?: string;
  editAsGroup?: boolean;
  hideEmpty?: boolean;
  label: string;
  labelClassName?: string;
  obj: K8sResourceKind;
  onEdit?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  path?: string | string[];
  valueClassName?: string;
  model?: K8sKind;
};

export const PropertyPath: React.FC<{ kind: string; path: string | string[] }> =
  ({ kind, path }) => {
    const pathArray: string[] = _.toPath(path);
    return (
      <Breadcrumb className="pf-c-breadcrumb--no-padding-top">
        <BreadcrumbItem>{kind}</BreadcrumbItem>
        {pathArray.map((property, i) => {
          const isLast = i === pathArray.length - 1;
          return (
            <BreadcrumbItem key={i} isActive={isLast}>
              {property}
            </BreadcrumbItem>
          );
        })}
      </Breadcrumb>
    );
  };

type EditButtonProps = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  testId?: string;
};

const EditButton: React.FC<EditButtonProps> = (props) => {
  return (
    <Button
      type="button"
      variant="link"
      isInline
      onClick={props.onClick}
      data-test={
        props.testId
          ? `${props.testId}-details-item__edit-button`
          : 'details-item__edit-button'
      }
    >
      {props.children}
      <PencilAltIcon className="co-icon-space-l pf-c-button-icon--plain" />
    </Button>
  );
};

export type SwaggerDefinitions = {
  [name: string]: SwaggerDefinition;
};

export type SwaggerDefinition = {
  definitions?: SwaggerDefinitions;
  description?: string;
  type?: string;
  enum?: string[];
  $ref?: string;
  items?: SwaggerDefinition;
  required?: string[];
  properties?: {
    [prop: string]: SwaggerDefinition;
  };
};
export const DetailsItem: React.FC<DetailsItemProps> = ({
  children,
  defaultValue = '-',
  description,
  editAsGroup,
  hideEmpty,
  label,
  labelClassName,
  obj,
  onEdit,
  canEdit = true,
  path,
  valueClassName,
  model,
}) => {
  const { t } = useTranslation();
  const hide = hideEmpty && _.isEmpty(_.get(obj, path));
  const popoverContent: string =
    description ?? getPropertyDescription(model, path);
  const value: React.ReactNode = children || _.get(obj, path, defaultValue);
  const editable = onEdit && canEdit;
  return hide ? null : (
    <>
      <dt
        className={classnames('details-item__label', labelClassName)}
        data-test-selector={`details-item-label__${label}`}
      >
        <Split>
          <SplitItem className="details-item__label">
            {popoverContent || path ? (
              <Popover
                headerContent={<div>{label}</div>}
                {...(popoverContent && {
                  bodyContent: (
                    <LinkifyExternal>
                      <div className="co-pre-line">{popoverContent}</div>
                    </LinkifyExternal>
                  ),
                })}
                {...(path && {
                  footerContent: (
                    <PropertyPath kind={model?.kind} path={path} />
                  ),
                })}
                maxWidth="30rem"
              >
                <Button
                  data-test={label}
                  variant="plain"
                  className="details-item__popover-button"
                >
                  {label}
                </Button>
              </Popover>
            ) : (
              label
            )}
          </SplitItem>
          {editable && editAsGroup && (
            <>
              <SplitItem isFilled />
              <SplitItem>
                <EditButton testId={label} onClick={onEdit}>
                  {t('public~Edit')}
                </EditButton>
              </SplitItem>
            </>
          )}
        </Split>
      </dt>
      <dd
        className={classnames('details-item__value', valueClassName, {
          'details-item__value--group': editable && editAsGroup,
        })}
        data-test-selector={`details-item-value__${label}`}
      >
        {editable && !editAsGroup ? (
          <EditButton testId={label} onClick={onEdit}>
            {value}
          </EditButton>
        ) : (
          value
        )}
      </dd>
    </>
  );
};

export const ResourceSummary: React.FC<ResourceSummaryProps> = ({
  children,
  resource,
  customPathName,
  showPodSelector = false,
  showNodeSelector = false,
  showAnnotations = true,
  showTolerations = false,
  showLabelEditor = true,
  canUpdateResource = true,
  podSelector = 'spec.selector',
  nodeSelector = 'spec.template.spec.nodeSelector',
  launchModal,
  resourceModel,
}) => {
  const { t } = useTranslation();
  const { metadata } = resource;
  const reference = referenceForModel(resourceModel);
  const [canUpdateAccess] = useAccessReview({
    group: resourceModel.apiGroup,
    resource: resourceModel.plural,
    verb: 'patch',
    name: metadata.name,
    namespace: metadata.namespace,
  });
  const canUpdate = canUpdateAccess && canUpdateResource;

  return (
    <dl data-test-id="resource-summary" className="co-m-pane__details">
      <DetailsItem
        label={t('public~Name')}
        obj={resource}
        path={customPathName || 'metadata.name'}
      />
      {metadata.namespace && (
        <DetailsItem
          label={t('public~Namespace')}
          obj={resource}
          path="metadata.namespace"
        >
          <ResourceLink
            kind="Namespace"
            name={metadata.namespace}
            title={metadata.uid}
            namespace={null}
          />
        </DetailsItem>
      )}
      <DetailsItem
        label={t('public~Labels')}
        obj={resource}
        path="metadata.labels"
        valueClassName="details-item__value--labels"
        onEdit={() =>
          launchModal(ModalKeys.EDIT_LABELS, { resource, resourceModel })
        }
        canEdit={showLabelEditor && canUpdate}
        editAsGroup
      >
        <LabelList kind={reference} labels={metadata.labels} />
      </DetailsItem>
      {showAnnotations && (
        <DetailsItem
          label={t('public~Annotations')}
          obj={resource}
          path="metadata.annotations"
        >
          {canUpdate ? (
            <Button
              data-test="edit-annotations"
              type="button"
              isInline
              onClick={() =>
                launchModal(ModalKeys.EDIT_ANN, {
                  resource,
                  resourceModel,
                })
              }
              variant="link"
            >
              {t('public~{{count}} annotation', {
                count: _.size(metadata.annotations),
              })}
              <PencilAltIcon className="co-icon-space-l pf-c-button-icon--plain" />
            </Button>
          ) : (
            t('public~{{count}} annotation', {
              count: _.size(metadata.annotations),
            })
          )}
        </DetailsItem>
      )}
      {children}
      <DetailsItem
        label={t('public~Created at')}
        obj={resource}
        path="metadata.creationTimestamp"
      >
        <Timestamp timestamp={metadata.creationTimestamp} />
      </DetailsItem>
      <DetailsItem
        label={t('public~Owner')}
        obj={resource}
        path="metadata.ownerReferences"
      >
        <OwnerReferences resource={resource} />
      </DetailsItem>
    </dl>
  );
};
