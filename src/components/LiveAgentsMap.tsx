import React, {useEffect, useRef, useState} from 'react';
import {
  FlatList,
  AppState,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useIsFocused} from '@react-navigation/native';
import {WebView} from 'react-native-webview';
import {useAuthStore} from '../stores/authStore';
import {
  getLiveAgents,
  liveLabel,
  liveStatus,
  visibleLiveAgents,
  type LiveAgent,
} from '../services/liveGpsApi';
import {colors} from '../theme/colors';
import moment from 'moment-timezone';
import {gpsElapsedTime, gpsServerNow} from '../services/gpsClock';

const time = (value: string) =>
  moment(value).tz('Africa/Casablanca').format('HH:mm:ss');
export function LiveAgentsMap() {
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
        clock,
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
        status: liveStatus(agent, now, query.isError),
      })),
  );
  useEffect(() => {
    if (ready) {
      web.current?.injectJavaScript(`window.setAgents(${payload}); true;`);
    }
  }, [payload, ready]);
  const detail = shown.find(agent => agent.agentId === selected);
  return (
    <View style={styles.container}>
      <View style={styles.filters}>
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
      </View>
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
        source={{uri: 'file:///android_asset/agent-map/index.html'}}
        originWhitelist={['file://*']}
        allowFileAccess
        cacheEnabled
        javaScriptEnabled
        domStorageEnabled={false}
        geolocationEnabled={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        userAgent="CONTRONDE-Patron/1.0 (+https://saditech.ma)"
        onLoadEnd={() => setReady(true)}
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
            const id: unknown = JSON.parse(event.nativeEvent.data).id;
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
        <View style={styles.detail}>
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
          <TouchableOpacity onPress={() => setSelected(undefined)}>
            <Text>Fermer le détail</Text>
          </TouchableOpacity>
        </View>
      )}
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
            <AgentDetails agent={item} now={now} disconnected={query.isError} />
          </TouchableOpacity>
        )}
      />
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
      <Text>
        {liveLabel[status]}
        {agent.position
          ? ` · Mise à jour il y a ${Math.max(
              0,
              Math.floor((now - Date.parse(agent.position.capturedAt)) / 1000),
            )} s · Précision ± ${Math.round(agent.position.accuracy)} m`
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
  filters: {padding: 12, gap: 10, flexDirection: 'row', flexWrap: 'wrap'},
  selected: {fontWeight: '800', color: colors.text},
  detail: {padding: 12, backgroundColor: colors.surface},
  card: {padding: 12, borderBottomWidth: 1, borderColor: colors.border},
});
