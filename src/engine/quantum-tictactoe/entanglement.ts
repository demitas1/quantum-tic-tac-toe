import Graph from 'graphology';
import type { CellIndex } from '../types';

export function addEntanglement(
  graph: Graph,
  cell1: CellIndex,
  cell2: CellIndex,
  moveIndex: number,
): void {
  const n1 = String(cell1);
  const n2 = String(cell2);
  if (!graph.hasNode(n1)) graph.addNode(n1);
  if (!graph.hasNode(n2)) graph.addNode(n2);
  graph.addEdge(n1, n2, { moveIndex });
}

function dfsFind(
  graph: Graph,
  node: string,
  parentEdge: string | null,
  visited: Set<string>,
  path: string[],
): string[] | null {
  visited.add(node);
  path.push(node);

  for (const edgeKey of graph.edges(node)) {
    if (edgeKey === parentEdge) continue;

    const src = graph.source(edgeKey);
    const tgt = graph.target(edgeKey);
    const neighbor = src === node ? tgt : src;

    if (visited.has(neighbor)) {
      return path.slice(path.indexOf(neighbor));
    }

    const result = dfsFind(graph, neighbor, edgeKey, visited, path);
    if (result) return result;
  }

  path.pop();
  return null;
}

export function detectCycle(graph: Graph): CellIndex[] | null {
  const visited = new Set<string>();

  for (const node of graph.nodes()) {
    if (visited.has(node)) continue;
    const result = dfsFind(graph, node, null, visited, []);
    if (result) return result.map(n => parseInt(n) as CellIndex);
  }

  return null;
}

export function getEntangledCells(graph: Graph, cell: CellIndex): CellIndex[] {
  const key = String(cell);
  if (!graph.hasNode(key)) return [];
  return graph.neighbors(key).map(n => parseInt(n) as CellIndex);
}
