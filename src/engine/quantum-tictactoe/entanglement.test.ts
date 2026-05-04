import Graph from 'graphology';
import { addEntanglement, detectCycle, getEntangledCells } from './entanglement';

function makeGraph(): Graph {
  return new Graph({ type: 'undirected', multi: true });
}

describe('addEntanglement', () => {
  it('adds nodes and an edge', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    expect(g.hasNode('0')).toBe(true);
    expect(g.hasNode('1')).toBe(true);
    expect(g.edges().length).toBe(1);
  });

  it('allows a second edge between the same pair (multi-edge)', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 0, 1, 2);
    expect(g.edges().length).toBe(2);
  });
});

describe('detectCycle', () => {
  it('returns null for an empty graph', () => {
    const g = makeGraph();
    expect(detectCycle(g)).toBeNull();
  });

  it('returns null when nodes exist but no edges', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    g.dropEdge(g.edges()[0]);
    expect(detectCycle(g)).toBeNull();
  });

  it('returns null for a simple path (no cycle)', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 1, 2, 1);
    expect(detectCycle(g)).toBeNull();
  });

  it('detects a 3-node cycle', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 1, 2, 1);
    addEntanglement(g, 0, 2, 2);
    const cycle = detectCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain(0);
    expect(cycle).toContain(1);
    expect(cycle).toContain(2);
  });

  it('detects a cycle in a disconnected graph', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 2, 3, 1);
    addEntanglement(g, 3, 4, 2);
    addEntanglement(g, 2, 4, 3);
    const cycle = detectCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain(2);
    expect(cycle).toContain(3);
    expect(cycle).toContain(4);
  });

  it('detects a cycle formed by a multi-edge (same pair placed twice)', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 0, 1, 2);
    const cycle = detectCycle(g);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain(0);
    expect(cycle).toContain(1);
  });
});

describe('getEntangledCells', () => {
  it('returns empty array when node does not exist', () => {
    const g = makeGraph();
    expect(getEntangledCells(g, 0)).toEqual([]);
  });

  it('returns the neighbor for a single edge', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    expect(getEntangledCells(g, 0)).toEqual([1]);
  });

  it('returns all neighbors without duplicates for two edges', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 0, 2, 1);
    const neighbors = getEntangledCells(g, 0);
    expect(neighbors).toHaveLength(2);
    expect(neighbors).toContain(1);
    expect(neighbors).toContain(2);
  });

  it('returns a single neighbor even with a multi-edge', () => {
    const g = makeGraph();
    addEntanglement(g, 0, 1, 0);
    addEntanglement(g, 0, 1, 2);
    expect(getEntangledCells(g, 0)).toEqual([1]);
  });
});
