import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
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
  return (
    <View style={headerStyles.container}>
      <View style={headerStyles.left}>
        <View style={headerStyles.logo}>
          <Text style={headerStyles.logoText}>♀♂</Text>
        </View>
        <Text style={headerStyles.title}>Relaxy</Text>
      </View>
      <TouchableOpacity>
        <Text style={headerStyles.searchIcon}>⌕</Text>
      </TouchableOpacity>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  searchIcon: {
    color: colors.textMuted,
    fontSize: 22,
  },
});

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        header: () => <RelaxyHeader />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
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

const tabStyles = StyleSheet.create({
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    borderWidth: 4,
    borderColor: colors.bg,
  },
});

function CenterButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <TouchableOpacity
      style={tabStyles.centerButton}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('CreatePost')}
    >
      <Ionicons name="add-circle" color={colors.white} size={28} />
    </TouchableOpacity>
  );
}

function EmptyScreen() {
  return null;
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.accent, fontSize: 18, fontWeight: 'bold' }}>♀♂</Text>
      </View>
    </View>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
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
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.bg },
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
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                headerTitleStyle: { color: colors.text },
              })}
            />
            <Stack.Screen
              name="NewChat"
              component={NewChatScreen}
              options={{
                title: 'Nova Conversa',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
              }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Configurações',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
              }}
            />
            <Stack.Screen
              name="CreatePost"
              component={CreatePostScreen}
              options={{
                title: 'Nova Publicação',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="CreateStory"
              component={CreateStoryScreen}
              options={{
                title: 'Meu Status',
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.text,
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
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
