import '@testing-library/react-native/matchers';

jest.mock('test-renderer', () => {
  const RTR = jest.requireActual('react-test-renderer');
  return {
    createRoot: (_rendererOptions: any) => {
      let currentInstance: any = null;
      return {
        render(element: any) {
          currentInstance = RTR.create(element);
        },
        unmount() {
          if (currentInstance) { currentInstance.unmount(); currentInstance = null; }
        },
        get container() {
          if (!currentInstance) return { toJSON: () => null, queryAll: () => [] };
          const root = currentInstance.root;
          (root as any).queryAll = (predicate: Function, _options?: any) => root.findAll(predicate);
          (root as any).toJSON = () => currentInstance.toJSON();
          return root;
        },
      };
    },
  };
}, { virtual: true });

jest.mock('expo-crypto', () => {
  let localCryptoCounter = 0;
  return {
    getRandomBytes: jest.fn((length: number) => {
      localCryptoCounter++;
      const arr = new Uint8Array(length);
      for (let i = 0; i < length; i++) arr[i] = (localCryptoCounter * 17 + i) & 0xFF;
      return arr;
    }),
    getRandomBytesAsync: jest.fn(async (length: number) => {
      localCryptoCounter++;
      const arr = new Uint8Array(length);
      for (let i = 0; i < length; i++) arr[i] = (localCryptoCounter * 17 + i) & 0xFF;
      return arr;
    }),
  digestStringAsync: jest.fn(async (_algo: string, data: string) => {
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }),
  createHash: jest.fn(() => {
    let data = '';
    return {
      update: jest.fn((input: string) => { data += input; }),
      digest: jest.fn((_encoding: string) => {
        let hash = 5381;
        for (let i = 0; i < data.length; i++) {
          hash = ((hash << 5) + hash) + data.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(64, '0');
      }),
    };
  }),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  };
});

jest.mock('tweetnacl', () => ({
  secretbox: Object.assign(
    jest.fn((data: Uint8Array, nonce: Uint8Array, key: Uint8Array) => {
      const result = new Uint8Array(data.length + 16);
      result.set(data);
      return result;
    }),
    {
      open: jest.fn((encrypted: Uint8Array, nonce: Uint8Array, key: Uint8Array) => {
        if (key.length === 0) return null;
        return encrypted.slice(0, encrypted.length - 16);
      }),
    }
  ),
}));

jest.mock('expo-file-system', () => {
  let localFileExists = false;
  const sharedFileInstance = {
    uri: 'file://mock/path/file.jpg',
    info: jest.fn(() => ({ size: 1024, exists: localFileExists, modificationTime: Date.now(), uri: 'file://mock/path/file.jpg' })),
    write: jest.fn(),
    text: jest.fn(async () => '[]'),
    delete: jest.fn(),
    get exists() { return localFileExists; },
    set exists(v) { localFileExists = v; },
    bytes: jest.fn(async () => new Uint8Array(64)),
    arrayBuffer: jest.fn(async () => new ArrayBuffer(64)),
    create: jest.fn(),
  };
  const localDirInstance = {
    uri: 'file://mock/cache/rilaxy-media',
    exists: true,
    create: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(() => [sharedFileInstance]),
    info: jest.fn(() => ({ size: 1024, exists: true, modificationTime: Date.now(), uri: 'file://mock/cache' })),
  };
  const localFileConstructor = jest.fn(() => Object.create(sharedFileInstance));
  localFileConstructor.downloadFileAsync = jest.fn(async (_url: string, _dest: any, _opts?: any) => sharedFileInstance);
  return {
    File: localFileConstructor,
    Directory: jest.fn(() => localDirInstance),
    Paths: {
      cache: 'file://mock/cache',
      document: 'file://mock/documents',
    },
    downloadFileAsync: jest.fn(async (_url: string, _dest: any, _opts?: any) => sharedFileInstance),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIonicons = jest.fn().mockImplementation(function(props: any) {
    return React.createElement(View, { testID: 'icon-' + props.name }, props.name);
  });
  return { Ionicons: MockIonicons };
});

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Image = jest.fn().mockImplementation(function(props: any) {
    return React.createElement(View, { ...props, testID: 'expo-image' });
  });
  return { Image, default: Image };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BlurView = jest.fn().mockImplementation(function(props: any) {
    return React.createElement(View, { ...props, testID: 'blur-view' });
  });
  return { BlurView };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LinearGradient = jest.fn().mockImplementation(function(props: any) {
    return React.createElement(View, { ...props, testID: 'linear-gradient' });
  });
  return { LinearGradient };
});

jest.mock('lottie-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const LottieView = jest.fn().mockImplementation(function(props: any) {
    return React.createElement(View, { ...props, testID: 'lottie-view' });
  });
  return LottieView;
});

jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const VideoView = jest.fn().mockImplementation(function(props: any) {
    return React.createElement(View, { ...props, testID: 'video-view' });
  });
  const useVideoPlayer = jest.fn(function(_source: any, cb?: (p: any) => void) {
    const player = {
      loop: false,
      muted: false,
      currentTime: 0,
      play: jest.fn(),
      pause: jest.fn(),
    };
    if (cb) cb(player);
    return player;
  });
  return { VideoView, useVideoPlayer };
});

jest.mock('expo-audio', () => {
  const RN = require('react-native');
  const AudioPlayer = jest.fn().mockImplementation(function(this: any) { this.play = jest.fn(); this.pause = jest.fn(); this.stop = jest.fn(); });
  return {
    createAudioPlayer: jest.fn(() => new AudioPlayer()),
    AudioPlayer,
    AudioStatus: { Playing: 'playing', Paused: 'paused', Stopped: 'stopped' },
    useAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), stop: jest.fn() })),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
}));

jest.mock('firebase/compat/app', () => {
  const createQuerySnapshot = (docs: any[] = []) => ({
    docs, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn), size: docs.length,
  });

  const query = {
    onSnapshot: jest.fn(() => jest.fn()),
    get: jest.fn(async () => createQuerySnapshot()),
    orderBy: jest.fn(() => query),
    where: jest.fn(() => query),
  };

  const mockDocRef = {
    get: jest.fn(async () => ({ exists: false, data: () => ({}), id: 'mock-id' })),
    set: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    collection: jest.fn(() => query),
  };

  const mockCollectionRef = {
    doc: jest.fn(() => mockDocRef),
    add: jest.fn(async () => ({ id: 'mock-doc-id' })),
    orderBy: jest.fn(() => query),
    where: jest.fn(() => query),
    get: jest.fn(async () => createQuerySnapshot()),
    onSnapshot: jest.fn(() => jest.fn()),
  };

  const mockFirestore = {
    collection: jest.fn(() => mockCollectionRef),
    FieldValue: { arrayUnion: jest.fn((...args: any[]) => args), arrayRemove: jest.fn((...args: any[]) => args), serverTimestamp: jest.fn(() => new Date()) },
    Timestamp: { now: jest.fn(() => ({ toDate: () => new Date(), seconds: 0, nanoseconds: 0 })), fromDate: jest.fn((d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime()/1000), nanoseconds: 0 })) },
  };

  const firebase = {
    apps: [],
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({
      createUserWithEmailAndPassword: jest.fn(async (_email: string, _password: string) => ({
        user: { uid: 'new-uid', email: _email, displayName: 'New User', photoURL: null, updateProfile: jest.fn(async () => {}), getIdToken: jest.fn(async () => 'token') },
      })),
      signInWithEmailAndPassword: jest.fn(async (_email: string, _password: string) => ({
        user: { uid: 'test-uid', email: _email, displayName: 'Test User', photoURL: null },
      })),
      signOut: jest.fn(async () => {}),
      sendPasswordResetEmail: jest.fn(async () => {}),
      onIdTokenChanged: jest.fn((cb: (user: any) => void) => {
        cb(null);
        return jest.fn();
      }),
      currentUser: null,
      setPersistence: jest.fn(async () => {}),
    })),
    firestore: jest.fn(() => mockFirestore),
    database: jest.fn(() => ({ ref: jest.fn(() => ({ set: jest.fn(async () => {}), onDisconnect: jest.fn(() => ({ set: jest.fn(async () => {}) })) })) })),
  };

  firebase.firestore.FieldValue = mockFirestore.FieldValue;
  firebase.firestore.Timestamp = mockFirestore.Timestamp;

  return firebase;
});

jest.mock('firebase/compat/auth', () => {});
jest.mock('firebase/compat/firestore', () => {});

jest.mock('../src/services/firebase', () => {
  const firebase = require('firebase/compat/app');
  return {
    auth: firebase.auth(),
    db: firebase.firestore(),
    default: firebase,
  };
}, { virtual: true });

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() })),
  useRoute: jest.fn(() => ({ params: {} })),
  NavigationContainer: ({ children }: any) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
    Group: ({ children }: any) => children,
  })),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(() => ({
    Navigator: ({ children }: any) => children,
    Screen: ({ children }: any) => children,
  })),
}));

jest.mock('./src/services/supabase', () => {
  const mockSupabase = {
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(async (_path: string, _data: any, _opts?: any) => ({ error: null })),
        getPublicUrl: jest.fn((path: string) => ({
          data: { publicUrl: `https://supabase.co/storage/v1/object/public/rilaxy-media/${path}` },
        })),
        remove: jest.fn(async (_paths: string[]) => ({ error: null })),
      })),
    },
  };
  return {
    getSupabase: jest.fn(() => mockSupabase),
  };
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://mock/picked-image.jpg', width: 1920, height: 1080 }],
  })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://mock/captured-image.jpg', width: 1920, height: 1080 }],
  })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'mock-expo-token' })),
  scheduleNotificationAsync: jest.fn(async () => 'mock-notif-id'),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => {}),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => {}),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(async () => ({ success: true })),
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file://mock/doc.pdf', name: 'doc.pdf', mimeType: 'application/pdf', size: 1024 }],
  })),
}));

jest.mock('expo-screen-capture', () => ({
  preventScreenCapture: jest.fn(),
  allowScreenCapture: jest.fn(),
  addScreenshotListener: jest.fn(() => jest.fn()),
}));
