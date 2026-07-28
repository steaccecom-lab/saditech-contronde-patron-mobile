export const fr = {
  fallback: {
    value: 'Valeur inconnue',
    status: 'Statut inconnu',
    notificationMode: 'Mode de notification inconnu',
  },
  roundStatuses: {
    PLANNED: 'Planifiée',
    LATE: 'En retard',
    STARTED: 'En cours',
    FINISHED: 'Terminée',
    MISSED: 'Manquée',
    CANCELLED: 'Annulée',
  },
  checkpointStatuses: {
    VALIDATED: 'Validé',
    MISSED: 'Manqué',
    PENDING: 'En attente',
    VALID: 'Valide',
    OUT_OF_ORDER: 'Hors ordre',
  },
  notificationModes: {
    ALL_SCANS: 'Tous les scans',
    OUT_OF_ORDER_ONLY: 'Seulement les scans hors ordre',
    DISABLED: 'Notifications désactivées',
  },
} as const;
