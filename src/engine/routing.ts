import type {
  CampusEdge,
  CampusNode,
  LampPost,
  EdgeRatingSummary,
  IncidentReport,
  RouteMode,
  RouteResult,
  Coordinates,
} from '../types/campus';
import { UFSC_LANDMARKS, UFSC_EDGES } from '../data/ufscTrindade';

interface EdgeCalculation {
  edge: CampusEdge;
  effectiveIllumination: number;
  weight: number;
  hasBurnedPost: boolean;
}

/**
 * Calculates effective illumination percentage and Dijkstra weight for an edge.
 */
function evaluateEdge(
  edge: CampusEdge,
  mode: RouteMode,
  posts: LampPost[],
  edgeRatings: Record<string, EdgeRatingSummary>,
  activeReports: IncidentReport[]
): EdgeCalculation {
  let illumination = edge.baseIllumination;
  let penalty = 0;
  let hasBurnedPost = false;

  // 1. Lamp post status checks
  // Find posts connected to this edge either by edge.lampPostIds or post.connectedEdgeIds
  const relatedPosts = posts.filter(
    (p) => edge.lampPostIds.includes(p.id) || p.connectedEdgeIds.includes(edge.id)
  );

  for (const post of relatedPosts) {
    if (post.status === 'queimado') {
      hasBurnedPost = true;
      penalty += 100; // Spec: +100 penalty for queimado
      illumination -= 50;
    } else if (post.status === 'oscilando') {
      penalty += 25; // Spec: +25 penalty for oscilando
      illumination -= 20;
    }
  }

  // 2. Active reports (+35 penalty)
  const relatedReports = activeReports.filter((r) => {
    if (r.status === 'resolvido') return false;
    if (r.locationNodeId) {
      return edge.from === r.locationNodeId || edge.to === r.locationNodeId;
    }
    const loc = r.locationName.toLowerCase();
    return loc.includes(edge.from) || loc.includes(edge.to);
  });

  if (relatedReports.length > 0) {
    penalty += 35 * relatedReports.length;
    illumination -= 15 * relatedReports.length;
  }

  // 3. Community ratings (1..5)
  const ratingSummary = edgeRatings[edge.id];
  if (ratingSummary && ratingSummary.count > 0) {
    const avg = ratingSummary.averageRating;
    // Base reference is 4.0. Lower ratings reduce illumination and add penalty
    if (avg < 4.0) {
      const deficiency = 4.0 - avg;
      penalty += deficiency * 15;
      illumination -= deficiency * 12;
    } else {
      const bonus = avg - 4.0;
      illumination += bonus * 8;
    }
  }

  const effectiveIllumination = Math.max(5, Math.min(100, Math.round(illumination)));

  let weight = edge.distance;
  if (mode === 'brightest') {
    // Darkness factor: higher darkness heavily increases traversal cost
    const darknessRatio = (100 - effectiveIllumination) / 25;
    weight = edge.distance * (1 + darknessRatio) + penalty;
  }

  return {
    edge,
    effectiveIllumination,
    weight,
    hasBurnedPost,
  };
}

/**
 * Finds optimal route between two UFSC campus landmarks using weighted Dijkstra.
 */
export function findRoute(
  originId: string,
  destinationId: string,
  mode: RouteMode = 'brightest',
  posts: LampPost[] = [],
  edgeRatings: Record<string, EdgeRatingSummary> = {},
  activeReports: IncidentReport[] = []
): RouteResult {
  const nodeMap = new Map<string, CampusNode>();
  for (const node of UFSC_LANDMARKS) {
    nodeMap.set(node.id, node);
  }

  const originNode = nodeMap.get(originId);
  const destNode = nodeMap.get(destinationId);

  // Edge case: origin === destination
  if (originId === destinationId) {
    const coords: Coordinates[] = originNode ? [originNode.coordinates] : [];
    return {
      path: [originId],
      coordinates: coords,
      distanceMeters: 0,
      estimatedMinutes: 0,
      illuminationPercentage: 100,
      hasDarkWarning: false,
      edges: [],
      posts: [],
    };
  }

  if (!originNode || !destNode) {
    return {
      path: [originId],
      coordinates: [],
      distanceMeters: 0,
      estimatedMinutes: 0,
      illuminationPercentage: 50,
      hasDarkWarning: true,
      edges: [],
      posts: [],
    };
  }

  // Pre-calculate edge evaluations
  const edgeCalcs = new Map<string, EdgeCalculation>();
  for (const edge of UFSC_EDGES) {
    edgeCalcs.set(edge.id, evaluateEdge(edge, mode, posts, edgeRatings, activeReports));
  }

  // Build adjacency graph (bidirectional walkways)
  interface AdjNeighbor {
    nodeId: string;
    calc: EdgeCalculation;
  }
  const adj = new Map<string, AdjNeighbor[]>();
  for (const node of UFSC_LANDMARKS) {
    adj.set(node.id, []);
  }

  for (const edge of UFSC_EDGES) {
    const calc = edgeCalcs.get(edge.id);
    if (!calc) continue;

    adj.get(edge.from)?.push({ nodeId: edge.to, calc });
    adj.get(edge.to)?.push({ nodeId: edge.from, calc });
  }

  // Dijkstra's algorithm
  const dist = new Map<string, number>();
  const prev = new Map<string, { fromNodeId: string; calc: EdgeCalculation }>();
  const visited = new Set<string>();

  for (const node of UFSC_LANDMARKS) {
    dist.set(node.id, Infinity);
  }
  dist.set(originId, 0);

  while (visited.size < UFSC_LANDMARKS.length) {
    // Find unvisited node with smallest distance
    let current: string | null = null;
    let smallestDist = Infinity;

    for (const [nodeId, d] of dist.entries()) {
      if (!visited.has(nodeId) && d < smallestDist) {
        smallestDist = d;
        current = nodeId;
      }
    }

    if (!current || smallestDist === Infinity) {
      break; // All remaining nodes unreachable
    }

    if (current === destinationId) {
      break; // Reached destination
    }

    visited.add(current);

    const neighbors = adj.get(current) || [];
    for (const { nodeId: nextNodeId, calc } of neighbors) {
      if (visited.has(nextNodeId)) continue;

      const alt = smallestDist + calc.weight;
      if (alt < (dist.get(nextNodeId) ?? Infinity)) {
        dist.set(nextNodeId, alt);
        prev.set(nextNodeId, { fromNodeId: current, calc });
      }
    }
  }

  // Backtrack path
  if (!prev.has(destinationId) && originId !== destinationId) {
    // Disconnected fallback: return simple direct endpoints
    return {
      path: [originId, destinationId],
      coordinates: [originNode.coordinates, destNode.coordinates],
      distanceMeters: 500,
      estimatedMinutes: 7,
      illuminationPercentage: 20,
      hasDarkWarning: true,
      edges: [],
      posts: [],
    };
  }

  const path: string[] = [];
  const traversedCalcs: EdgeCalculation[] = [];
  let curr: string | undefined = destinationId;

  while (curr && curr !== originId) {
    path.unshift(curr);
    const step = prev.get(curr);
    if (!step) break;
    traversedCalcs.unshift(step.calc);
    curr = step.fromNodeId;
  }
  path.unshift(originId);

  // Summary statistics
  const pathCoordinates: Coordinates[] = path
    .map((id) => nodeMap.get(id)?.coordinates)
    .filter((c): c is Coordinates => Boolean(c));

  const totalDistance = traversedCalcs.reduce((acc, c) => acc + c.edge.distance, 0);
  const estimatedMinutes = Math.max(1, Math.round(totalDistance / 75)); // ~4.5 km/h walk

  // Weighted average illumination by edge distance
  let illuminationSum = 0;
  let hasBurnedPostOnPath = false;
  let hasSeverelyDarkSegment = false;

  for (const c of traversedCalcs) {
    illuminationSum += c.edge.distance * c.effectiveIllumination;
    if (c.hasBurnedPost) {
      hasBurnedPostOnPath = true;
    }
    if (c.effectiveIllumination < 50) {
      hasSeverelyDarkSegment = true;
    }
  }

  const overallIllumination =
    totalDistance > 0 ? Math.round(illuminationSum / totalDistance) : 100;

  // Collect associated posts
  const postIdsOnPath = new Set<string>();
  for (const c of traversedCalcs) {
    for (const pid of c.edge.lampPostIds) {
      postIdsOnPath.add(pid);
    }
    for (const p of posts) {
      if (p.connectedEdgeIds.includes(c.edge.id)) {
        postIdsOnPath.add(p.id);
      }
    }
  }
  const routePosts = posts.filter((p) => postIdsOnPath.has(p.id));

  const hasDarkWarning =
    hasBurnedPostOnPath || hasSeverelyDarkSegment || overallIllumination < 60;

  return {
    path,
    coordinates: pathCoordinates,
    distanceMeters: totalDistance,
    estimatedMinutes,
    illuminationPercentage: Math.max(5, Math.min(100, overallIllumination)),
    hasDarkWarning,
    edges: traversedCalcs.map((c) => c.edge),
    posts: routePosts,
  };
}
