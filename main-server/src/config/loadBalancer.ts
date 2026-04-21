import { STORAGE_NODES } from "./storageNodes";

let nodeIndex = 0;

export const getNextNode = (replicationFactor = 2): string[] => {
  if (replicationFactor > STORAGE_NODES.length) {
    console.warn(
      `Warning: Replication factor (${replicationFactor}) is greater than the number of available nodes (${STORAGE_NODES.length}). A chunk will only be replicated on each unique node once.`,
    );
    replicationFactor = STORAGE_NODES.length;
  }

  const selectedNodes: string[] = [];

  for (let i = 0; i < replicationFactor; i++) {
    selectedNodes.push(STORAGE_NODES[nodeIndex]);
    nodeIndex = (nodeIndex + 1) % STORAGE_NODES.length;
  }

  return selectedNodes;
};
