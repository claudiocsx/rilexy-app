import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import CallService from '../services/callService';
import LoginScreen from '../screens/LoginScreen';
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

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Chat: { chatId: string; name: string };
  NewChat: undefined;
  Settings: undefined;
  CreatePost: undefined;
  CreateStory: undefined;
  Call: { peerId: string; peerName: string; audioOnly: boolean };
  EditImage: { imageUri: string; chatId: string; name: string };
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

function RelaxyHeader() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: 'bold' }}>♀♂</Text>
        </View>
        <Text style={{ color: c.accent, fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>Relaxy</Text>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('NewChat')}>
        <Text style={{ color: c.textMuted, fontSize: 22 }}>⌕</Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeTabs() {
  const theme = useSettingsStore((s) => s.theme);
  const cHome = getColors(theme);
  return (
    <Tab.Navigator
      screenOptions={{
        header: () => <RelaxyHeader />,
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
        tabBarShowLabel: false,
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
        options={{
          tabBarButton: () => <CenterButton />,
        }}
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
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: c.accentDark,
        justifyContent: 'center', alignItems: 'center',
        marginTop: -20, borderWidth: 4, borderColor: c.bg,
      }}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('CreatePost')}
    >
      <Ionicons name="add-circle" color={c.white} size={28} />
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
      <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.accent, fontSize: 18, fontWeight: 'bold' }}>♀♂</Text>
      </View>
    </View>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      CallService.stopListening();
      return;
    }
    CallService.startListening(user.uid, ({ callerId, audioOnly }) => {
      Alert.alert(
        'Chamada recebida',
        'Alguém está ligando...',
        [
          { text: 'Recusar', style: 'cancel' },
          {
            text: 'Atender',
            onPress: () => {
              navigationRef.current?.navigate('Call', {
                peerId: callerId,
                peerName: '...',
                audioOnly,
              });
            },
          },
        ]
      );
    });
    return () => CallService.stopListening();
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
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
              component={HomeTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({
                title: route.params.name,
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
                headerTitleStyle: { color: c.text },
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
                title: 'Meu Status',
                headerStyle: { backgroundColor: c.surface },
                headerTintColor: c.text,
                presentation: 'modal',
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
              name="EditImage"
              component={EditImageScreen}
              options={{
                headerShown: false,
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
          </>
        ) : (
          <>
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
                headerStyle: { backgroundColor: c.bg },
                headerTintColor: c.text,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
