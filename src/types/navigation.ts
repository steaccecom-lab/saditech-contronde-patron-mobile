export type RootStackParamList = {
  SignIn: undefined;
  Main: undefined;
  RoundDetail: { id: string };
  AgentRounds: { agentId: string; agentName: string };
};

export type MainTabParamList = {
  Home: undefined;
  Rounds: undefined;
  History: undefined;
  Notifications: undefined;
  Agents: undefined;
  Settings: undefined;
};
