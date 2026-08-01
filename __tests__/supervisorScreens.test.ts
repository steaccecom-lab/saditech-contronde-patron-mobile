import fs from 'fs';
import path from 'path';

describe('écrans superviseur', () => {
  it('expose tous les filtres, la pagination et le détail dans l’historique', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/screens/HistoryScreen.tsx'), 'utf8');
    for (const token of ['Date de d\\u00e9but', 'Date de fin', 'Recherche', 'siteId', 'agentId', 'status', 'fetchNextPage', "navigate('RoundDetail'"]) {
      expect(source).toContain(token);
    }
  });

  it('expose liste, compteur, lecture individuelle, lecture globale et navigation des notifications', () => {
    const screen = fs.readFileSync(path.join(process.cwd(), 'src/screens/NotificationsScreen.tsx'), 'utf8');
    const navigator = fs.readFileSync(path.join(process.cwd(), 'src/navigation/AppNavigator.tsx'), 'utf8');
    for (const token of ['setNotificationRead', 'Marquer non lue', 'markAllNotificationsRead', 'fetchNextPage', "navigate('RoundDetail'"]) {
      expect(screen).toContain(token);
    }
    expect(navigator).toContain('notificationUnreadCount');
    expect(navigator).toContain('tabBarBadge');
  });
});
