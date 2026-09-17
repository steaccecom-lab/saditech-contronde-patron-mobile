import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  ScrollView,
  AppState,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {WebView} from 'react-native-webview';
import {useAuthStore} from '../stores/authStore';
import {
  getLiveAgents,
  liveLabel,
  liveStatus,
  positionAge,
  visibleLiveAgents,
  type LiveAgent,
} from '../services/liveGpsApi';
import {colors} from '../theme/colors';
import moment from 'moment-timezone';
import {gpsElapsedTime, gpsServerNow} from '../services/gpsClock';

const time = (value: string) =>
  moment(value).tz('Africa/Casablanca').format('HH:mm:ss');
export function LiveAgentsMap() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const client = useQueryClient();
  const user = useAuthStore(s => s.user);
  const owner = `${user?.companyId}:${user?.id}`;
  const focused = useIsFocused();
  const [site, setSite] = useState('');
  const [selected, setSelected] = useState<string>();
  const [clock, setClock] = useState(gpsElapsedTime);
  const initialReceipt = useRef(gpsElapsedTime());
  const web = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [mapType, setMapType] = useState<'satellite' | 'plan'>('satellite');
  const [showAgents, setShowAgents] = useState(false);
  const query = useQuery({
    queryKey: ['liveGps', owner],
    enabled: Boolean(user) && focused,
    queryFn: async ({signal}) => {
      try {
        return await getLiveAgents(undefined, signal);
      } catch (error) {
        const status = (error as {response?: {status?: number}})?.response
          ?.status;
        if (status === 401 || status === 403) {
          // A later network failure must never revive a forbidden snapshot.
          client.setQueryData(['liveGps', owner], {
            items: [],
            serverTime: new Date().toISOString(),
            receivedAt: gpsElapsedTime(),
          });
        }
        throw error;
      }
    },
    refetchInterval: focused ? 30000 : false,
    retry: false,
    gcTime: 300000,
  });
  useEffect(() => {
    const update = () => setClock(gpsElapsedTime());
    const timer = setInterval(update, 5000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        update();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    setSite('');
    setSelected(undefined);
  }, [owner]);
  // Advance from the latest server instant rather than trusting the handset timezone/clock.
  const now = query.data
    ? gpsServerNow(
        query.data.serverTime,
        query.data.receivedAt ?? initialReceipt.current,
        Math.max(clock, gpsElapsedTime()),
      )
    : Date.now();
  const errorStatus = (query.error as {response?: {status?: number}} | null)
    ?.response?.status;
  const agents = visibleLiveAgents(
    errorStatus === 401 || errorStatus === 403 ? [] : query.data?.items ?? [],
    now,
  );
  const sites = [
    ...new Map(agents.map(agent => [agent.siteId, agent.siteName])).entries(),
  ];
  const shown = agents.filter(agent => !site || agent.siteId === site);
  const payload = JSON.stringify(
    shown
      .filter(agent => agent.position)
      .map(agent => ({
        id: agent.agentId,
        name: agent.agentName,
        latitude: agent.position!.latitude,
        longitude: agent.position!.longitude,
        capturedAt: agent.position!.capturedAt,
        status: liveStatus(agent, now, query.isError),
      })),
  );
  useEffect(() => {
    if (ready) {
      web.current?.injectJavaScript(`window.setAgents(${payload}); true;`);
    }
  }, [payload, ready]);
  useEffect(() => {
    if (ready)
      {web.current?.injectJavaScript(
        `window.setMapType(${JSON.stringify(mapType)}); true;`,
      );}
  }, [mapType, ready]);
  const detail = shown.find(agent => agent.agentId === selected);
  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        {(['satellite', 'plan'] as const).map(type => (
          <TouchableOpacity
            key={type}
            accessibilityRole="button"
            accessibilityState={{selected: mapType === type}}
            style={[styles.chip, mapType === type && styles.chipActive]}
            onPress={() => setMapType(type)}>
            <Text
              style={mapType === type ? styles.activeText : styles.selected}>
              {type === 'satellite' ? 'Satellite' : 'Plan'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.chip}
          onPress={() => setShowAgents(value => !value)}>
          <Text>
            {shown.length} agents {showAgents ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        style={styles.siteScroll}
        contentContainerStyle={styles.filters}>
        <TouchableOpacity onPress={() => setSite('')}>
          <Text>Tous les sites</Text>
        </TouchableOpacity>
        {sites.map(([id, name]) => (
          <TouchableOpacity key={id} onPress={() => setSite(id)}>
            <Text style={site === id ? styles.selected : undefined}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {query.isPending && <Text>Chargement des positions…</Text>}
      {query.isError && (
        <TouchableOpacity onPress={() => query.refetch()}>
          <Text>
            Connexion indisponible — dernières positions connues. Réessayer
          </Text>
        </TouchableOpacity>
      )}
      <WebView
        ref={web}
        key={owner}
        style={styles.map}
        source={MAP_SOURCE}
        originWhitelist={['file://*']}
        allowFileAccess
        cacheEnabled
        javaScriptEnabled
        domStorageEnabled={false}
        geolocationEnabled={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        userAgent="CONTRONDE-Patron/1.0 (+https://saditech.ma)"
        onLoadStart={() => setReady(false)}
        onShouldStartLoadWithRequest={request => {
          if (request.url === 'file:///android_asset/agent-map/index.html') {
            return true;
          }
          if (request.url === 'https://www.openstreetmap.org/copyright') {
            Linking.openURL(request.url).catch(() => undefined);
          }
          return false;
        }}
        onMessage={event => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'ready') {
              setReady(true);
              return;
            }
            const id: unknown = message.id;
            if (
              typeof id === 'string' &&
              shown.some(agent => agent.agentId === id)
            ) {
              setSelected(id);
            }
          } catch {
            /* Ignore unrelated web messages. */
          }
        }}
      />
      {detail && (
        <ScrollView
          style={styles.detail}
          contentContainerStyle={styles.detailContent}>
          <AgentDetails agent={detail} now={now} disconnected={query.isError} />
          <Text>
            Début : {time(detail.startedAt)} · Durée :{' '}
            {Math.max(
              0,
              Math.floor(
                ((detail.finishedAt ? Date.parse(detail.finishedAt) : now) -
                  Date.parse(detail.startedAt)) /
                  60000,
              ),
            )}{' '}
            min
          </Text>
          {detail.nextCheckpoint && detail.mode === 'ROUND' && (
            <Text>Prochain point : {detail.nextCheckpoint}</Text>
          )}
          <View style={styles.toolbar}>
            {detail.position && (
              <TouchableOpacity
                style={styles.chip}
                onPress={() =>
                  web.current?.injectJavaScript(
                    `window.centerAgent(${JSON.stringify(
                      detail.agentId,
                    )}); true;`,
                  )
                }>
                <Text>Recentrer sur l’agent</Text>
              </TouchableOpacity>
            )}
            {detail.scheduledRoundId && (
              <TouchableOpacity
                style={styles.chip}
                onPress={() =>
                  navigation.navigate('RoundDetail', {
                    id: detail.scheduledRoundId!,
                  })
                }>
                <Text>Détail de la ronde</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setSelected(undefined)}>
              <Text>Fermer le détail</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
      {showAgents && (
        <FlatList
          data={shown}
          keyExtractor={agent => agent.agentId}
          style={styles.list}
          ListEmptyComponent={
            <Text>Aucun agent en ronde ou en suivi post-ronde.</Text>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item.agentId)}>
              <Text style={styles.selected}>
                {item.agentName} · {item.siteName}
              </Text>
              <Text>
                {liveLabel[liveStatus(item, now, query.isError)]} ·{' '}
                {item.progress.validated}/{item.progress.total} checkpoints
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
      {!query.isPending && shown.length === 0 && (
        <Text style={styles.empty}>
          Aucun agent en ronde ou en suivi post-ronde.
        </Text>
      )}
    </View>
  );
}
function AgentDetails({
  agent,
  now,
  disconnected,
}: {
  agent: LiveAgent;
  now: number;
  disconnected: boolean;
}) {
  const status = liveStatus(agent, now, disconnected);
  return (
    <>
      <Text style={styles.selected}>
        {agent.agentName} · {agent.siteName}
      </Text>
      <Text>
        {agent.roundName} · {agent.progress.validated}/{agent.progress.total}{' '}
        checkpoints
      </Text>
      {agent.lastCheckpoint && (
        <Text>
          Dernier point : {agent.lastCheckpoint.name} ·{' '}
          {time(agent.lastCheckpoint.scannedAt)}
        </Text>
      )}
      <Text
        style={[
          styles.badge,
          {
            color:
              status === 'LIVE'
                ? colors.success
                : status === 'STALE'
                ? colors.warning
                : colors.danger,
          },
        ]}>
        {liveLabel[status]}
        {agent.position
          ? ` · ${positionAge(
              agent.position.capturedAt,
              now,
            )} · Précision ± ${Math.round(agent.position.accuracy)} m`
          : ' · Position indisponible'}
      </Text>
      {agent.position && (
        <Text>
          Dernière position : {agent.position.latitude.toFixed(5)},{' '}
          {agent.position.longitude.toFixed(5)} ·{' '}
          {time(agent.position.capturedAt)}
        </Text>
      )}
      {agent.mode === 'POST_ROUND' && (
        <>
          <Text>Suivi post-ronde</Text>
          <Text>
            Ronde terminée : {agent.finishedAt ? time(agent.finishedAt) : '—'} ·
            Suivi actif jusqu’à : {agent.endsAt ? time(agent.endsAt) : '—'}
          </Text>
        </>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  container: {flex: 1},
  map: {flex: 1, minHeight: 200},
  list: {maxHeight: 230},
  siteScroll: {flexGrow: 0, maxHeight: 42},
  filters: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 16,
    alignItems: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  chipActive: {backgroundColor: colors.primary},
  activeText: {color: colors.surface, fontWeight: '700'},
  badge: {fontWeight: '800', marginVertical: 4},
  empty: {padding: 12, color: colors.muted},
  selected: {fontWeight: '800', color: colors.text},
  detail: {maxHeight: 250, flexGrow: 0, backgroundColor: colors.surface},
  detailContent: {padding: 10, gap: 3},
  card: {padding: 12, borderBottomWidth: 1, borderColor: colors.border},
});
const MAP_SOURCE = {uri: 'file:///android_asset/agent-map/index.html'};
