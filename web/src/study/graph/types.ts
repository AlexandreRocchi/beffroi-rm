import type { Node } from "@xyflow/svelte";
import type { GraphNode } from "@beffroi/shared";

export interface AeData extends Record<string, unknown> {
  node: GraphNode;
  color: string;
  critical: boolean;
  evalPr: number | null;
  evalDiff: number | null;
  method: string;
  assetName: string | null;
}

export type AeNodeType = Node<AeData>;

/** Type MIME du glisser-déposer depuis la palette. */
export const DND = "application/x-beffroi-node";
