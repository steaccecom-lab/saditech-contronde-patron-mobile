import {
  checkpointStatusLabel,
  notificationModeLabel,
  roundStatusLabel,
  technicalValueFallback,
} from '../src/presentation/labels';
import { statusLabel } from '../src/utils/format';

describe('French presentation labels', () => {
  it.each([
    ['PLANNED', 'Planifiée'],
    ['LATE', 'En retard'],
    ['STARTED', 'En cours'],
    ['FINISHED', 'Terminée'],
    ['MISSED', 'Manquée'],
    ['CANCELLED', 'Annulée'],
  ])('maps round status %s', (technicalValue, expected) => {
    expect(roundStatusLabel(technicalValue)).toBe(expected);
    expect(statusLabel(technicalValue)).toBe(expected);
  });

  it.each([
    ['VALIDATED', 'Validé'],
    ['MISSED', 'Manqué'],
    ['PENDING', 'En attente'],
  ])('maps checkpoint status %s independently', (technicalValue, expected) => {
    expect(checkpointStatusLabel(technicalValue)).toBe(expected);
  });

  it.each([
    ['ALL_SCANS', 'Tous les scans'],
    ['OUT_OF_ORDER_ONLY', 'Seulement les scans hors ordre'],
    ['DISABLED', 'Notifications désactivées'],
  ])('maps notification mode %s', (technicalValue, expected) => {
    expect(notificationModeLabel(technicalValue)).toBe(expected);
  });

  it('uses French fallbacks without exposing unknown technical values', () => {
    const unknown = 'NEW_BACKEND_VALUE';

    expect(roundStatusLabel(unknown)).toBe('Statut inconnu');
    expect(checkpointStatusLabel(unknown)).toBe('Statut inconnu');
    expect(notificationModeLabel(unknown)).toBe('Mode de notification inconnu');
    expect(technicalValueFallback(unknown)).toBe('Valeur inconnue');
    expect(roundStatusLabel(unknown)).not.toContain(unknown);
  });

  it('keeps technical values unchanged for existing comparisons and calls', () => {
    const roundStatus = 'MISSED';
    const checkpointStatus = 'MISSED';
    const notificationMode = 'OUT_OF_ORDER_ONLY';

    expect(roundStatus).toBe('MISSED');
    expect(checkpointStatus).toBe('MISSED');
    expect(notificationMode).toBe('OUT_OF_ORDER_ONLY');
  });
});
