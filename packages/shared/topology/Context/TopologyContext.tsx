import * as React from 'react';
import {
  DeploymentKind,
  NodeKind,
  StorageClusterKind,
} from '@odf/shared/types';
import { TopologyViewLevel } from '../types';

export type NodeDeploymentMap = {
  [nodeName: string]: DeploymentKind[];
};

type DefaultContext = {
  zones: string[];
  nodes: NodeKind[];
  storageCluster: StorageClusterKind;
  deployments: DeploymentKind[];
  nodeDeploymentMap: NodeDeploymentMap;
  visualizationLevel: TopologyViewLevel;
  activeNode?: string;
  setActiveNode?: (node: string) => void;
};

const defaultContext: DefaultContext = {
  nodes: [],
  zones: [],
  storageCluster: null,
  deployments: null,
  visualizationLevel: TopologyViewLevel.NODES,
  activeNode: null,
  setActiveNode: null,
  nodeDeploymentMap: {},
};

export const TopologyDataContext =
  React.createContext<DefaultContext>(defaultContext);
