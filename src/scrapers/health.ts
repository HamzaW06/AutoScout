import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HealthState = 'healthy' | 'degraded' | 'failing' | 'dead';

export interface ScrapeStrategy {
  skipToTier: string | null;
  reduceFrequency: boolean;
  pause: boolean;
  alert: boolean;
}

// Tier escalation order
const TIER_ORDER = ['platform', 'structured_data', 'api_discovery', 'ai_extraction'] as const;

// ---------------------------------------------------------------------------
// DealerHealthTracker
// ---------------------------------------------------------------------------

export class DealerHealthTracker {
  /**
   * Determine the health state of a dealer based on consecutive failures
   * and when the last successful scrape occurred.
   */
  getState(input: {
    consecutiveFailures: number;
    lastSuccessAt: string | null;
  }): HealthState {
    const { consecutiveFailures, lastSuccessAt } = input;

    if (consecutiveFailures >= 3) {
      // Check if last success was more than 48 hours ago (or never)
      if (lastSuccessAt === null) {
        return 'dead';
      }
      const lastSuccess = new Date(lastSuccessAt).getTime();
      const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
      if (lastSuccess < fortyEightHoursAgo) {
        return 'dead';
      }
      return 'failing';
    }

    if (consecutiveFailures === 0) {
      return 'healthy';
    }

    // consecutiveFailures 1-2
    return 'degraded';
  }

  /**
   * Determine the scrape strategy to use given the current health state,
   * current scrape tier, and number of consecutive failures.
   */
  getScrapeStrategy(input: {
    healthState: HealthState;
    currentTier: string;
    consecutiveFailures: number;
  }): ScrapeStrategy {
    const { healthState, currentTier } = input;

    switch (healthState) {
      case 'healthy':
        return {
          skipToTier: null,
          reduceFrequency: false,
          pause: false,
          alert: false,
        };

      case 'degraded': {
        // Escalate to next tier in order
        const currentIndex = TIER_ORDER.indexOf(currentTier as typeof TIER_ORDER[number]);
        let nextTier: string | null = null;
        if (currentIndex >= 0 && currentIndex < TIER_ORDER.length - 1) {
          nextTier = TIER_ORDER[currentIndex + 1];
        } else if (currentIndex === -1) {
          // Unknown tier — escalate to first known tier
          nextTier = TIER_ORDER[0];
        }
        // If already at last tier, stay there
        if (currentIndex === TIER_ORDER.length - 1) {
          nextTier = TIER_ORDER[TIER_ORDER.length - 1];
        }
        return {
          skipToTier: nextTier,
          reduceFrequency: false,
          pause: false,
          alert: false,
        };
      }

      case 'failing':
        return {
          skipToTier: 'ai_extraction',
          reduceFrequency: true,
          pause: false,
          alert: false,
        };

      case 'dead':
        return {
          skipToTier: null,
          reduceFrequency: false,
          pause: true,
          alert: true,
        };

      default:
        return {
          skipToTier: null,
          reduceFrequency: false,
          pause: false,
          alert: false,
        };
    }
  }

  /**
   * Returns true if there has been a sudden, significant drop in listing count.
   * Triggers when currentCount is 0 or when the drop exceeds 80% of previousCount.
   */
  detectSuddenDrop(previousCount: number, currentCount: number): boolean {
    if (currentCount === 0) {
      return true;
    }
    if (previousCount > 0) {
      const dropRatio = (previousCount - currentCount) / previousCount;
      if (dropRatio > 0.8) {
        return true;
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helper: emit state change event
// ---------------------------------------------------------------------------

/**
 * Placeholder for WebSocket integration.
 * Logs at info level when a dealer's health state changes.
 * WebSocket emission will be wired up in a later task.
 */
export function emitIfStateChanged(
  dealerId: number,
  dealerName: string,
  oldState: string,
  newState: string,
): void {
  if (oldState !== newState) {
    logger.info(
      { dealerId, dealerName, oldState, newState },
      `Dealer health state changed: ${dealerName} (${dealerId}) ${oldState} → ${newState}`,
    );
  }
}
