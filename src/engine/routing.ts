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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NODE_MAP: Map<string, CampusNode> = new Map(UFSC_LANDMARKS.map((n) => [n.id, n]));

const LANDMARK_MATCHERS = new Map(
  UFSC_LANDMARKS.map((node) => [
    node.id,
    {
      fullNameLower: node.name.toLowerCase(),
      shortRegex: new RegExp(`\\b${escapeRegExp(node.shortName)}\\b`, 'i'),
      idRegex: new RegExp(`\\b${escapeRegExp(node.id)}\\b`, 'i'),
    },
  ])
);

function matchesLandmark(locationName: string, nodeId: string): boolean {
  const matcher = LANDMARK_MATCHERS.get(nodeId);
  if (!matcher) {
    return new RegExp(`\\b${escapeRegExp(nodeId)}\\b`, 'i').test(locationName);
  }

  if (locationName.toLowerCase().includes(matcher.fullNameLower)) return true;
  if (matcher.shortRegex.test(locationName)) return true;
  return matcher.idRegex.test(locationName);
}

/**
 * Stitches traversed edge sidewalk waypoints in direction of travel,
 * deduplicating touching boundary coordinates.
 */
function stitchRouteCoordinates(
  path: string[],
  traversedCalcs: EdgeCalculation[]
): Coordinates[] {
  const stitched: Coordinates[] = [];

  for (let i = 0; i < traversedCalcs.length; i += 1) {
    const currFrom = path[i];
    const currTo = path[i + 1];
    const { edge } = traversedCalcs[i];

    let segment: Coordinates[];
    if (edge.waypoints && edge.waypoints.length > 0) {
      segment = edge.from === currFrom ? edge.waypoints : [...edge.waypoints].reverse();
    } else {
      const fromCoords = NODE_MAP.get(currFrom)?.coordinates;
      const toCoords = NODE_MAP.get(currTo)?.coordinates;
      segment = [fromCoords, toCoords].filter((c): c is Coordinates => Boolean(c));
    }

    for (const pt of segment) {
      const last = stitched[stitched.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
        stitched.push(pt);
      }
    }
  }

  if (stitched.length === 0) {
    return path
      .map((id) => NODE_MAP.get(id)?.coordinates)
      .filter((c): c is Coordinates => Boolean(c));
  }

  return stitched;
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
    return matchesLandmark(r.locationName, edge.from) || matchesLandmark(r.locationName, edge.to);
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
  const originNode = NODE_MAP.get(originId);
  const destNode = NODE_MAP.get(destinationId);

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
  const pathCoordinates = stitchRouteCoordinates(path, traversedCalcs);

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
