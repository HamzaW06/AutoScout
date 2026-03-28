import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from './logger.js';

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
    ws.on('close', () => logger.info('WebSocket client disconnected'));
  });
}

export function broadcast(event: string, data: unknown): void {
  if (!wss) return;
  const message = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function emitNewListing(listing: {
  id: string; year: number; make: string; model: string;
  price: number; value_rating: string; deal_score: number;
}): void {
  broadcast('new_listing', listing);
}

export function emitScrapeComplete(dealerId: number, dealerName: string, listingsFound: number): void {
  broadcast('scrape_complete', { dealerId, dealerName, listingsFound });
}

export function emitDealerHealthChange(dealerId: number, dealerName: string, oldState: string, newState: string): void {
  broadcast('dealer_health_change', { dealerId, dealerName, oldState, newState });
}

export function emitAlert(alertType: string, listing: {
  year: number; make: string; model: string; price: number; deal_score: number;
}): void {
  broadcast('deal_alert', { alertType, ...listing });
}
