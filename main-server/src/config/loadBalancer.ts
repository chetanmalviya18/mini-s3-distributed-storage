import { STORAGE_NODES } from "./storageNodes";

let nodeIndex = 0;

export const getNextNode = (replicationFactor = 2): string[] => {
  const selectedNodes: string[] = [];

  for (let i = 0; i < replicationFactor; i++) {
    selectedNodes.push(STORAGE_NODES[nodeIndex]);
    nodeIndex = (nodeIndex + 1) % STORAGE_NODES.length;
  }

  return selectedNodes;
};
