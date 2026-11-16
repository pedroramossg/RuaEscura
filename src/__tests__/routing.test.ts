import { describe, it, expect } from 'vitest';
import { findRoute } from '../engine/routing';
import {
  UFSC_LANDMARKS,
  UFSC_EDGES,
  INITIAL_LAMP_POSTS,
  INITIAL_EDGE_RATINGS,
  INITIAL_REPORTS,
} from '../data/ufscTrindade';
import type { LampPost, IncidentReport, EdgeRatingSummary } from '../types/campus';

describe('UFSC Trindade Routing Engine (Dijkstra Lighting Router)', () => {
  it('chooses illuminated corridor over darker shortcut in "brightest" mode', () => {
    // bu -> ru has a direct dark shortcut and a well-lit corridor via reitoria
    const brightestRoute = findRoute(
      'bu',
      'ru',
      'brightest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );

    const fastestRoute = findRoute(
      'bu',
      'ru',
      'fastest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );

    // Fastest should take the shorter path
    expect(fastestRoute.distanceMeters).toBeLessThan(brightestRoute.distanceMeters);

    // Brightest should choose the lit corridor (e.g. via reitoria or cultura)
    expect(brightestRoute.illuminationPercentage).toBeGreaterThan(fastestRoute.illuminationPercentage);
    expect(brightestRoute.path).toContain('reitoria');
    expect(brightestRoute.hasDarkWarning).toBe(false);
  });

  it('automatically detours to an alternate lit path when primary pole is marked "queimado" (+100 penalty)', () => {
    // Baseline route without burned pole
    const baselineRoute = findRoute(
      'bu',
      'ru',
      'brightest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );

    // Find the pole on reitoria -> ru (POSTE-RU-03) and mark it as queimado
    const updatedPosts: LampPost[] = INITIAL_LAMP_POSTS.map((post) =>
      post.id === 'POSTE-RU-03' ? { ...post, status: 'queimado' as const } : post
    );

    const detouredRoute = findRoute(
      'bu',
      'ru',
      'brightest',
      updatedPosts,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );

    // The detoured route should avoid the burned edge or detour via cultura/bosque
    expect(detouredRoute.path).not.toEqual(baselineRoute.path);
    // Path should detour via cultura or cce
    expect(detouredRoute.path.some((nodeId) => nodeId === 'cultura' || nodeId === 'cce')).toBe(true);
    expect(detouredRoute.hasDarkWarning).toBe(false);
  });

  it('updates illumination score and weights when pole is "oscilando" (+25) or has active report (+35)', () => {
    // Introduce an oscilando pole
    const oscilandoPosts: LampPost[] = INITIAL_LAMP_POSTS.map((p) =>
      p.id === 'POSTE-BU-01' ? { ...p, status: 'oscilando' as const } : p
    );

    // Active report on reitoria
    const customReports: IncidentReport[] = [
      ...INITIAL_REPORTS,
      {
        id: 'rep-test-1',
        category: 'iluminacao',
        locationName: 'Gabinete da Reitoria',
        locationNodeId: 'reitoria',
        description: 'Lâmpadas apagadas no trecho da Reitoria',
        isConfidential: false,
        createdAt: new Date().toISOString(),
        status: 'pendente',
      },
    ];

    // Poor community rating for the bu-reitoria edge
    const lowRatings: Record<string, EdgeRatingSummary> = {
      ...INITIAL_EDGE_RATINGS,
      'edge-bu-reitoria': {
        averageRating: 1.5,
        count: 12,
      },
    };

    const route = findRoute(
      'bu',
      'ru',
      'brightest',
      oscilandoPosts,
      lowRatings,
      customReports
    );

    expect(route).toBeDefined();
    expect(route.path.length).toBeGreaterThanOrEqual(2);
    // Due to penalties and low ratings, illumination should be lower than pristine
    const pristineRoute = findRoute(
      'bu',
      'ru',
      'brightest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );
    expect(route.illuminationPercentage).toBeLessThan(pristineRoute.illuminationPercentage);
  });

  it('falls back to least-dark route with hasDarkWarning=true when ALL paths contain burned poles', () => {
    // Mark ALL lamp posts as queimado
    const allBurnedPosts: LampPost[] = INITIAL_LAMP_POSTS.map((p) => ({
      ...p,
      status: 'queimado' as const,
    }));

    const route = findRoute(
      'bu',
      'ru',
      'brightest',
      allBurnedPosts,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );

    // Must never return null or empty path
    expect(route).toBeDefined();
    expect(route.path.length).toBeGreaterThanOrEqual(2);
    expect(route.path[0]).toBe('bu');
    expect(route.path[route.path.length - 1]).toBe('ru');
    // Must flag warning
    expect(route.hasDarkWarning).toBe(true);
    expect(route.illuminationPercentage).toBeLessThan(50);
  });

  it('handles origin === destination cleanly', () => {
    const route = findRoute(
      'bu',
      'bu',
      'brightest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      INITIAL_REPORTS
    );

    expect(route.path).toEqual(['bu']);
    expect(route.distanceMeters).toBe(0);
    expect(route.estimatedMinutes).toBe(0);
    expect(route.illuminationPercentage).toBe(100);
    expect(route.hasDarkWarning).toBe(false);
    expect(route.edges).toEqual([]);
    expect(route.posts).toEqual([]);
  });

  it('includes all 14 UFSC landmarks and realistic coordinates in data layer', () => {
    expect(UFSC_LANDMARKS.length).toBe(14);
    const landmarkIds = UFSC_LANDMARKS.map((l) => l.id);
    expect(landmarkIds).toEqual(
      expect.arrayContaining([
        'bu',
        'ru',
        'cce',
        'cse',
        'ccj',
        'cfh',
        'reitoria',
        'cultura',
        'aplicacao',
        'eps',
        'certi',
        'hu',
        'bosque',
        'santos_dumont',
      ])
    );

    // Verify all coordinates are in realistic UFSC Trindade bounds
    for (const landmark of UFSC_LANDMARKS) {
      expect(landmark.coordinates[0]).toBeLessThan(-27.59);
      expect(landmark.coordinates[0]).toBeGreaterThan(-27.61);
      expect(landmark.coordinates[1]).toBeLessThan(-48.51);
      expect(landmark.coordinates[1]).toBeGreaterThan(-48.53);
    }

    // Verify 8 QR lamp posts
    expect(INITIAL_LAMP_POSTS.length).toBe(8);
    expect(UFSC_EDGES.length).toBeGreaterThan(10);

    // Verify all edge IDs are unique
    const edgeIds = UFSC_EDGES.map((e) => e.id);
    const uniqueEdgeIds = new Set(edgeIds);
    expect(uniqueEdgeIds.size).toBe(edgeIds.length);

    // Verify all keys in INITIAL_EDGE_RATINGS exist in UFSC_EDGES
    for (const ratedEdgeId of Object.keys(INITIAL_EDGE_RATINGS)) {
      expect(uniqueEdgeIds.has(ratedEdgeId)).toBe(true);
    }

    const postIds = INITIAL_LAMP_POSTS.map((p) => p.id);
    expect(postIds).toEqual(
      expect.arrayContaining([
        'POSTE-BU-01',
        'POSTE-RU-03',
        'POSTE-CCE-02',
        'POSTE-BOSQUE-04',
        'POSTE-CCJ-01',
        'POSTE-VITOR-02',
        'POSTE-CSE-01',
        'POSTE-CFH-02',
      ])
    );
  });

  it('does not penalize edge-reitoria-ru when an active report has locationName "Rua Des. Vítor Lima" without locationNodeId', () => {
    const vitorLimaReport: IncidentReport = {
      id: 'rep-vitor-lima',
      category: 'iluminacao',
      locationName: 'Rua Des. Vítor Lima perto da rótula',
      description: 'Poste apagado no entorno da Trindade',
      isConfidential: true,
      createdAt: new Date().toISOString(),
      status: 'pendente',
    };

    const routeWithoutReport = findRoute(
      'reitoria',
      'ru',
      'brightest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      []
    );

    const routeWithVitorLimaReport = findRoute(
      'reitoria',
      'ru',
      'brightest',
      INITIAL_LAMP_POSTS,
      INITIAL_EDGE_RATINGS,
      [vitorLimaReport]
    );

    // The report at "Rua Des. Vítor Lima" must not match RU or penalize edge-reitoria-ru
    expect(routeWithVitorLimaReport.illuminationPercentage).toEqual(
      routeWithoutReport.illuminationPercentage
    );
    expect(routeWithVitorLimaReport.distanceMeters).toEqual(routeWithoutReport.distanceMeters);
    expect(routeWithVitorLimaReport.path).toEqual(routeWithoutReport.path);
  });
});
