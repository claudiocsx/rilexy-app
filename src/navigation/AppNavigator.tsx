import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Vibration, AppState, Alert, Modal, StyleSheet, BackHandler } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth } from '../contexts/AuthContext';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { db } from '../services/firebase';
import CallService from '../services/callService';
import { addNotificationResponseListener } from '../services/notifications';
import InviteScreen from '../screens/InviteScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatScreen from '../screens/ChatScreen';
import NewChatScreen from '../screens/NewChatScreen';
import FeedScreen from '../screens/FeedScreen';
import GroupsScreen from '../screens/GroupsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateStoryScreen from '../screens/CreateStoryScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import CallScreen from '../screens/CallScreen';
import EditImageScreen from '../screens/EditImageScreen';
import CreateVideoStickerScreen from '../screens/CreateVideoStickerScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import LockScreen from '../screens/LockScreen';
import AguardandoAprovacaoScreen from '../screens/AguardandoAprovacaoScreen';
import CameraFilterScreen from '../screens/CameraFilterScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import MutedUsersScreen from '../screens/MutedUsersScreen';
import ReportsScreen from '../screens/ReportsScreen';
import CallHistoryScreen from '../screens/CallHistoryScreen';
import GlobalSearchScreen from '../screens/GlobalSearchScreen';
import GroupMediaScreen from '../screens/GroupMediaScreen';
import { isLocked, isPinSetup, lockApp } from '../services/lockService';
import { useToast } from '../components/Toast';

export type RootStackParamList = {
  Invite: undefined;
  Login: { inviteCode?: string } | undefined;
  Register: { inviteCode?: string } | undefined;
  Main: undefined;
  Chat: { chatId: string; name: string; photoURL?: string; initialText?: string; isGroup?: boolean };
  NewChat: undefined;
  Settings: undefined;
  CreatePost: undefined;
  CreateStory: undefined;
  Call: { peerId: string; peerName: string; audioOnly: boolean; isIncoming?: boolean };
  EditImage: { imageUri: string; chatId: string; name: string; isGroup?: boolean };
  CreateVideoSticker: undefined;
  BlockedUsers: undefined;
  MutedUsers: undefined;
  Reports: undefined;
  GroupMedia: { chatId: string };
  UserProfile: { userId: string };
  CameraFilter: undefined;
  CallHistory: undefined;
  GlobalSearch: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Chats: undefined;
  Plus: undefined;
  Groups: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

export const navigationRef = React.createRef<any>();

function navigateToCall(peerId: string, peerName: string, audioOnly: boolean) {
  navigationRef.current?.navigate('Call', { peerId, peerName, audioOnly, isIncoming: true });
}

function RelaxyHeader({ onLock }: { onLock?: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const insets = useSafeAreaInsets();
  const [showMenu, setShowMenu] = useState(false);
  const { showToast } = useToast();
  return (
    <View style={{ backgroundColor: c.surface, paddingTop: insets.top, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.borderLight }}>
      <TouchableOpacity
        onPress={() => navigation.navigate('UserProfile', { userId: '' })}
        onLongPress={onLock}
        delayLongPress={2000}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentDark, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0 }}>♀♂</Text>
          </View>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: 1 }}>Rilaxy</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <TouchableOpacity accessibilityLabel="Nova conversa" onPress={() => navigation.navigate('NewChat')}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={c.accent} />
        </TouchableOpacity>
        {onLock && (
          <TouchableOpacity accessibilityLabel="Bloquear app" onPress={onLock}>
            <Ionicons name="lock-closed-outline" size={22} color={c.accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity accessibilityLabel="Menu" onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color={c.accent} />
        </TouchableOpacity>
      </View>
      <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity style={menuStyles.overlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={[menuStyles.sheet, { backgroundColor: c.surface }]}>
            <TouchableOpacity style={menuStyles.item} onPress={() => { setShowMenu(false); showToast('Em breve', 'info'); }}>
              <Ionicons name="archive-outline" size={22} color={c.text} />
              <Text style={[menuStyles.itemText, { color: c.text }]}>Conversas arquivadas</Text>
            </TouchableOpacity>
            <View style={[menuStyles.divider, { backgroundColor: c.borderLight }]} />
            <TouchableOpacity style={menuStyles.item} onPress={() => { setShowMenu(false); navigation.navigate('Settings'); }}>
              <Ionicons name="settings-outline" size={22} color={c.text} />
              <Text style={[menuStyles.itemText, { color: c.text }]}>Ajustes</Text>
            </TouchableOpacity>
            <View style={[menuStyles.divider, { backgroundColor: c.borderLight }]} />
            <TouchableOpacity style={menuStyles.item} onPress={() => setShowMenu(false)}>
              <Text style={[menuStyles.itemText, { color: c.textMuted, textAlign: 'center', flex: 1 }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const insets = useSafeAreaInsets();
  return (
    <BlurView intensity={50} tint={theme === 'dark' ? 'dark' : 'light'} style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: insets.bottom + 4,
      paddingTop: 8,
      paddingHorizontal: 8,
      borderTopWidth: 1,
      borderTopColor: c.glassBorder,
    }}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        if (route.name === 'Plus') {
          return (
            <View key={route.key} style={{ flex: 1, alignItems: 'center' }}>
              <CenterButton />
  </View>
  );
        }

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const label = options.tabBarAccessibilityLabel || route.name;
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            accessibilityLabel={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 2 }}
          >
            {isFocused && <View style={{ width: 20, height: 2, backgroundColor: c.accent, borderRadius: 1, marginBottom: 2 }} />}
            {options.tabBarIcon?.({
              focused: isFocused,
              color: isFocused ? c.accent : c.textMuted,
              size: 22,
            })}
            <Text style={{ color: isFocused ? c.accent : c.textMuted, fontSize: 10, fontWeight: isFocused ? '600' : '400' }}>
              {route.name === 'Feed' ? 'Início' : route.name === 'Chats' ? 'Chats' : route.name === 'Groups' ? 'Grupos' : route.name === 'Profile' ? 'Perfil' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
}

function HomeTabs({ onLock }: { onLock?: () => void }) {
  const theme = useSettingsStore((s) => s.theme);
  const cHome = getColors(theme);
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        header: () => <RelaxyHeader onLock={onLock} />,
        tabBarStyle: {
          backgroundColor: cHome.surface,
          borderTopColor: cHome.borderLight,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: cHome.accent,
        tabBarInactiveTintColor: cHome.textMuted,
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Plus"
        component={EmptyScreen}
        options={{}}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function CenterButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  return (
    <TouchableOpacity
      style={{
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: c.accentDark,
        justifyContent: 'center', alignItems: 'center',
        marginTop: -28,
        borderWidth: 3,
        borderColor: c.glassBorder,
        elevation: 8,
        shadowColor: c.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      }}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('CreatePost')}
    >
      <Ionicons name="create-outline" color={c.white} size={26} />
    </TouchableOpacity>
  );
}

function EmptyScreen() {
  return null;
}

function LoadingScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.accent, fontSize: 30, fontWeight: 'bold' }}>♀♂</Text>
      </View>
    </View>
  );
}

const menuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  itemText: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
});

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const loadVideoStickers = useSettingsStore((s) => s.loadVideoStickers);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [pinSetup, setPinSetup] = useState(false);

  useEffect(() => {
    loadVideoStickers();
  }, []);

  useEffect(() => {
    if (user) {
      isLocked().then(setLocked);
      isPinSetup().then(setPinSetup);
    } else {
      setLocked(false);
      setPinSetup(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        isLocked().then(setLocked);
      }
    });
    return () => sub.remove();
  }, [user]);

  const handleLock = useCallback(async () => {
    const setup = await isPinSetup();
    if (!setup) {
      showToast('Configure um PIN em Ajustes > Segurança antes de bloquear o app.', 'error');
      return;
    }
    await lockApp();
    setLocked(true);
    BackHandler.exitApp();
  }, []);

  const handleUnlocked = useCallback(() => {
    setLocked(false);
  }, []);

  useEffect(() => {
    const flag = new File(Paths.cache, '.onboarding_done');
    setOnboardingDone(flag.exists);
  }, []);

  const handleOnboardingComplete = async () => {
    const flag = new File(Paths.cache, '.onboarding_done');
    flag.write('1');
    setOnboardingDone(true);
  };

  useEffect(() => {
    if (!user) {
      CallService.stopListening();
      return;
    }
    Notifications.setNotificationCategoryAsync('incomingCall', [
      {
        identifier: 'ANSWER',
        buttonTitle: 'Atender',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'DECLINE',
        buttonTitle: 'Recusar',
        options: { opensAppToForeground: false },
      },
    ]).catch(() => {});
    Notifications.setNotificationCategoryAsync('message', [
      {
        identifier: 'REPLY',
        buttonTitle: 'Responder',
        options: { opensAppToForeground: true },
      },
    ]).catch(() => {});
    Notifications.setNotificationCategoryAsync('post', [
      {
        identifier: 'VIEW',
        buttonTitle: 'Ver',
        options: { opensAppToForeground: true },
      },
    ]).catch(() => {});
    CallService.startListening(user.uid, ({ callerId, audioOnly, callerName }) => {
      Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500]);
      if (AppState.currentState === 'active') {
        navigateToCall(callerId, callerName || callerId, audioOnly);
      } else {
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${callerName || 'Alguém'} está ligando...`,
            body: 'Chamada recebida',
            data: { type: 'call', callerId, callerName: callerName || '', audioOnly, currentUserId: user.uid },
            sound: 'default',
            channelId: 'calls',
            categoryIdentifier: 'incomingCall',
            priority: Notifications.AndroidNotificationPriority.MAX,
          } as any,
          trigger: null,
        }).catch(() => {});
      }
    });
    const unsubNotif = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type?.startsWith('call') || data?.callerId) {
        if (response.actionIdentifier === 'ANSWER' || response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          navigateToCall(data.callerId, data.callerName || data.callerId, data.audioOnly);
        } else if (response.actionIdentifier === 'DECLINE') {
          CallService.rejectCall(data.recipientId || data.currentUserId, data.callerId);
        }
      }
    });
    return () => {
      CallService.stopListening();
      unsubNotif();
    };
  }, [user]);

  if (loading || onboardingDone === null) {
    return <LoadingScreen />;
  }

  if (!user && !onboardingDone) {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
  }

  if (user?.status === 'pending') {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617' }}>
        <AguardandoAprovacaoScreen />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerBlurEffect: 'dark',
            headerStyle: { backgroundColor: c.surface },
            headerTintColor: c.text,
            headerTitleStyle: { color: c.text },
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          {user ? (
            <>
              <Stack.Screen
                name="Main"
                options={{ headerShown: false }}
              >
                {() => <HomeTabs onLock={handleLock} />}
              </Stack.Screen>
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                title: route.params.name,
                headerBlurEffect: undefined,
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
                headerTitleStyle: { color: c.text, fontSize: 17, fontWeight: '600' },
              })}
            />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{
                title: 'Nova Conversa',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Configurações',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="BlockedUsers"
              component={BlockedUsersScreen}
              options={{
                title: 'Bloqueados',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="MutedUsers"
              component={MutedUsersScreen}
              options={{
                title: 'Silenciados',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="Reports"
              component={ReportsScreen}
              options={{
                title: 'Reports',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="GroupMedia"
              component={GroupMediaScreen}
              options={{
                title: 'Mídia do Grupo',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="CreatePost"
              component={CreatePostScreen}
              options={{
                title: 'Nova Publicação',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="CreateStory"
              component={CreateStoryScreen}
              options={{
                title: 'Momento',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="CameraFilter"
              component={CameraFilterScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_right',
                presentation: 'fullScreenModal',
              }}
            />
            <Stack.Screen
              name="Call"
              component={CallScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="GlobalSearch"
              component={GlobalSearchScreen}
              options={{
                title: 'Pesquisar',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="CallHistory"
              component={CallHistoryScreen}
              options={{
                title: 'Histórico de chamadas',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
            <Stack.Screen
              name="CreateVideoSticker"
              component={CreateVideoStickerScreen}
              options={{
                title: 'Nova Figurinha Animada',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="EditImage"
              component={EditImageScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{
                title: 'Perfil',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Invite"
              component={InviteScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                title: 'Criar Conta',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    {locked && <LockScreen onUnlocked={handleUnlocked} />}
  </View>
  );
}
