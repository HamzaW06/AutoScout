import { describe, it, expect } from 'vitest';
import { DealerHealthTracker } from '../../src/scrapers/health.js';

const tracker = new DealerHealthTracker();

// ---------------------------------------------------------------------------
// Helper: build a lastSuccessAt timestamp N hours ago
// ---------------------------------------------------------------------------
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// getState
// ---------------------------------------------------------------------------

describe('DealerHealthTracker.getState', () => {
  it('returns healthy when consecutiveFailures is 0', () => {
    expect(tracker.getState({ consecutiveFailures: 0, lastSuccessAt: null })).toBe('healthy');
    expect(tracker.getState({ consecutiveFailures: 0, lastSuccessAt: hoursAgo(1) })).toBe('healthy');
  });

  it('returns degraded with 1 consecutive failure', () => {
    expect(tracker.getState({ consecutiveFailures: 1, lastSuccessAt: hoursAgo(1) })).toBe('degraded');
  });

  it('returns degraded with 2 consecutive failures', () => {
    expect(tracker.getState({ consecutiveFailures: 2, lastSuccessAt: hoursAgo(2) })).toBe('degraded');
  });

  it('returns failing with 3+ consecutive failures when last success was recent', () => {
    // Last success only 24h ago — not yet dead
    expect(tracker.getState({ consecutiveFailures: 3, lastSuccessAt: hoursAgo(24) })).toBe('failing');
    expect(tracker.getState({ consecutiveFailures: 5, lastSuccessAt: hoursAgo(47) })).toBe('failing');
  });

  it('returns dead with 3+ consecutive failures AND lastSuccessAt is null', () => {
    expect(tracker.getState({ consecutiveFailures: 3, lastSuccessAt: null })).toBe('dead');
    expect(tracker.getState({ consecutiveFailures: 10, lastSuccessAt: null })).toBe('dead');
  });

  it('returns dead with 3+ consecutive failures AND lastSuccessAt >48h ago', () => {
    expect(tracker.getState({ consecutiveFailures: 3, lastSuccessAt: hoursAgo(49) })).toBe('dead');
    expect(tracker.getState({ consecutiveFailures: 3, lastSuccessAt: hoursAgo(100) })).toBe('dead');
  });

  it('boundary: just over 48h ago is dead', () => {
    // 48h + 1 minute ago: just past the boundary — should be dead
    const justOver48h = new Date(Date.now() - (48 * 60 * 60 * 1000 + 60 * 1000)).toISOString();
    expect(tracker.getState({ consecutiveFailures: 3, lastSuccessAt: justOver48h })).toBe('dead');
  });
});

// ---------------------------------------------------------------------------
// getScrapeStrategy
// ---------------------------------------------------------------------------

describe('DealerHealthTracker.getScrapeStrategy', () => {
  it('returns no-op strategy for healthy state', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'healthy',
      currentTier: 'platform',
      consecutiveFailures: 0,
    });
    expect(strategy).toEqual({
      skipToTier: null,
      reduceFrequency: false,
      pause: false,
      alert: false,
    });
  });

  it('escalates from platform to structured_data when degraded', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'degraded',
      currentTier: 'platform',
      consecutiveFailures: 1,
    });
    expect(strategy.skipToTier).toBe('structured_data');
    expect(strategy.pause).toBe(false);
    expect(strategy.alert).toBe(false);
  });

  it('escalates from structured_data to api_discovery when degraded', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'degraded',
      currentTier: 'structured_data',
      consecutiveFailures: 2,
    });
    expect(strategy.skipToTier).toBe('api_discovery');
  });

  it('escalates from api_discovery to ai_extraction when degraded', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'degraded',
      currentTier: 'api_discovery',
      consecutiveFailures: 2,
    });
    expect(strategy.skipToTier).toBe('ai_extraction');
  });

  it('stays at ai_extraction when already at last tier and degraded', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'degraded',
      currentTier: 'ai_extraction',
      consecutiveFailures: 2,
    });
    expect(strategy.skipToTier).toBe('ai_extraction');
  });

  it('uses ai_extraction and reduces frequency when failing', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'failing',
      currentTier: 'platform',
      consecutiveFailures: 3,
    });
    expect(strategy.skipToTier).toBe('ai_extraction');
    expect(strategy.reduceFrequency).toBe(true);
    expect(strategy.pause).toBe(false);
    expect(strategy.alert).toBe(false);
  });

  it('pauses and alerts when dead', () => {
    const strategy = tracker.getScrapeStrategy({
      healthState: 'dead',
      currentTier: 'platform',
      consecutiveFailures: 5,
    });
    expect(strategy.skipToTier).toBe(null);
    expect(strategy.pause).toBe(true);
    expect(strategy.alert).toBe(true);
    expect(strategy.reduceFrequency).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectSuddenDrop
// ---------------------------------------------------------------------------

describe('DealerHealthTracker.detectSuddenDrop', () => {
  it('returns true when currentCount is 0', () => {
    expect(tracker.detectSuddenDrop(100, 0)).toBe(true);
    expect(tracker.detectSuddenDrop(0, 0)).toBe(true);
  });

  it('returns true when drop is exactly 80%+ (>80% threshold)', () => {
    // 100 → 19: drop of 81% — should trigger
    expect(tracker.detectSuddenDrop(100, 19)).toBe(true);
  });

  it('returns true when drop is more than 80%', () => {
    expect(tracker.detectSuddenDrop(100, 10)).toBe(true);
    expect(tracker.detectSuddenDrop(200, 30)).toBe(true);
  });

  it('returns false when drop is exactly 80% (not strictly more than)', () => {
    // 100 → 20: drop of exactly 80% — should NOT trigger (rule is >80%)
    expect(tracker.detectSuddenDrop(100, 20)).toBe(false);
  });

  it('returns false when drop is less than 80%', () => {
    expect(tracker.detectSuddenDrop(100, 50)).toBe(false);
    expect(tracker.detectSuddenDrop(100, 90)).toBe(false);
  });

  it('returns false when currentCount is greater than previousCount (growth)', () => {
    expect(tracker.detectSuddenDrop(50, 100)).toBe(false);
  });

  it('returns false when previousCount is 0 and currentCount is positive', () => {
    expect(tracker.detectSuddenDrop(0, 5)).toBe(false);
  });
});
