import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('navigation superviseur', () => {
  const navigator = readSource('src/navigation/AppNavigator.tsx');
  const navigationTypes = readSource('src/types/navigation.ts');
  const rounds = readSource('src/screens/RoundsScreen.tsx');
  const firebase = readSource('src/services/firebaseMessagingService.ts');
  const socket = readSource('src/services/socketService.ts');
  const mobileDevices = readSource('src/services/mobileDevicesApi.ts');
  const notificationsApi = readSource('src/services/notificationsApi.ts');

  it('retire Historique et Alertes tout en conservant l’ordre des autres onglets', () => {
    expect(navigator).not.toContain('name="History"');
    expect(navigator).not.toContain('name="Notifications"');
    expect(navigator).not.toContain("title: 'Historique'");
    expect(navigator).not.toContain("title: 'Alertes'");
    expect(navigationTypes).not.toMatch(/^\s+(History|Notifications):/m);

    const remainingTabs = ['Home', 'Rounds', 'Agents', 'Settings'];
    const positions = remainingTabs.map((name) =>
      navigator.indexOf(`<Tab.Screen name="${name}"`),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it('conserve les périodes intégrées aux rondes et l’ouverture du détail', () => {
    for (const token of ["Aujourd'hui", '7 jours', '30 jours']) {
      expect(rounds).toContain(token);
    }
    expect(rounds).toContain("navigate('RoundDetail'");
    expect(navigator).toContain('RoundDetail: \'rounds/:id\'');
  });

  it('conserve FCM, le token appareil et l’ouverture directe d’une ronde', () => {
    for (const token of [
      'onTokenRefresh',
      'onMessage',
      'setBackgroundMessageHandler',
      'getInitialNotification',
      'onNotificationOpenedApp',
      'setPendingRoundId',
      'registerDevice',
    ]) {
      expect(firebase).toContain(token);
    }
    expect(mobileDevices).toContain("http.post('/mobile-devices/register'");
    expect(mobileDevices).toContain("http.delete('/mobile-devices/current'");
    expect(navigator).toContain("navigationRef.navigate('RoundDetail'");
  });

  it('conserve Socket.IO et le contrat backend des notifications', () => {
    expect(navigator).toContain('connectSocket(queryClient)');
    expect(socket).toContain("socket.on('patron.scan.created'");
    expect(socket).toContain("socket.on('patron.round.finished'");
    expect(socket).toContain("socket.on('patron.round.late'");
    expect(socket).toContain("socket.on('patron.round.missed'");
    expect(notificationsApi).toContain("http.get<NotificationsResponse>('/notifications'");
  });
});
