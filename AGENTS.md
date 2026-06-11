# Relaxy — Project Context

## Stack
- **Framework**: React Native (Expo SDK 54, Expo Go)
- **Auth**: Firebase Auth (v9.23.0 compat SDK, `firebase/compat/*`)
- **Database**: Firestore (v9.23.0 compat)
- **Storage**: Supabase (`rilaxy-media` bucket, public)
- **Navigation**: `@react-navigation/native` v7 (bottom tabs + stack)
- **State**: Zustand (settings store)
- **Icons**: `@expo/vector-icons` (Ionicons)
- **WebRTC**: `react-native-webrtc` (dynamic import, P2P via Firestore signaling)
- **Encryption**: `expo-crypto` (AES-256-GCM)

## Project
- **Firebase project**: `rilaxy-cd8c5`
- **Supabase project**: `kojmnryyhzxuyxarlvse.supabase.co`
- **Theme**: Relaxy purple (#020617 bg, #a78bfa accent, #7c3aed darker)
- **`.env`**: Firebase + Supabase credentials (excluded from git)
- **`service-account.json`**: Firebase Admin SDK (private, excluded from git)

## Firebase SDK Constraint
**ALWAYS use `firebase/compat/*` (v9.23.0).** The modular SDK (v10+) is missing `react-native` entry in `exports` map → Metro loads ESM → crash in Expo Go.

```ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
```

## Supabase Constraint
Bucket `rilaxy-media` is public. Upload via `File(uri).arrayBuffer()`. Supabase anon key used from `.env`.

## Key Commands
```bash
npx expo start          # dev (LAN)
node scripts/deploy_rules.js <service-account.json>  # deploy Firestore rules
```

## Architecture

### Services (`src/services/`)

| File | Purpose |
|------|---------|
| `firebase.ts` | Firebase init (compat) |
| `auth.ts` | Register/login via Firebase Auth; `onIdTokenChanged` writes `users/{uid}` |
| `supabase.ts` | Lazy `getSupabase()` init |
| `storage.ts` | `uploadChatMedia`, `uploadStoryMedia` via Supabase |
| `chat.ts` | `findOrCreateChat(participants)` — deterministic ID via sorted join |
| `user.ts` | `searchUsers(query)` — queries `displayNameLower` |
| `stories.ts` | `postStory`, `observeStories`, `observeMyStory`, `markViewed`, `deleteStory` |
| `mediaCache.ts` | `getMediaUri`, `downloadAndCache`, `clearCache`, `getCacheSize` |
| `webrtc.ts` | P2P video call via Firestore signaling (dynamic import) |
| `presence.ts` | Online/offline via Firestore |
| `settingsStore.ts` | Zustand store — `autoDownload` (always / wifi / never) |

### Screens (`src/screens/`)

| Screen | Purpose |
|--------|---------|
| `LoginScreen` | Email/password login |
| `RegisterScreen` | Email/password + displayName |
| `ChatsScreen` | Chat list + StoriesRow at top + FAB |
| `ChatScreen` | Real-time messages, media send, emoji picker, delete, view-once |
| `NewChatScreen` | Search users → findOrCreateChat |
| `FeedScreen` | Posts with optional media |
| `GroupsScreen` | Group list + create |
| `ProfileScreen` | User stats + logout |
| `SettingsScreen` | Auto-download preference + clear cache |
| `CreateStoryScreen` | Create story (colored bg + emoji/text or media) |

### Components (`src/components/`)

| Component | Purpose |
|-----------|---------|
| `StoriesRow` | Horizontal scroll of story circles (my status + contacts) |
| `StoryViewer` | Fullscreen story viewer with progress bars, tap L/R nav, fade+scale+pulse animations |
| `MediaViewer` | Fullscreen image modal (tap to close) |

### Navigation (`src/navigation/AppNavigator.tsx`)
- **Bottom tabs** (5): Feed, Chats, + (center floating), Groups, Profile
- **Stack screens**: Chat, NewChat, CreateStory (modal), Settings
- **Custom header**: ♀♂ logo + "Relaxy" + search icon

## Features Implemented

### Chat (1x1)
- Real-time Firestore messages (ordered by `timestamp`)
- Media send (image from gallery/camera + caption)
- Emoji picker (😊 button in input bar → grid of 27 emojis)
- Auto-download media cache (`expo-file-system`)
- "Enviando..." overlay while upload completes
- Media viewer (fullscreen tap-to-close)
- **Delete message** — long-press → "Apagar para mim" / "Apagar para todos"
- **View-once media (👁️)** — toggle only when media selected; recipient sees blurred "Toque para ver" then single view
- **Big emoji messages** — messages with only emoji render at fontSize 42 with gentle pulse animation

### Stories (Status)
- Create story (colored background + emoji/text or photo/video)
- 8 preset background colors + 30 emoji picker
- Horizontal row on ChatsScreen (always visible — "Meu Status" + contacts)
- Fullscreen viewer with progress bars, 5s auto-advance, tap L/R navigation
- Fade-in + scale-up + continuous pulse on text/emoji
- 24h expiration, auto-cleanup via Cloud Function pubsub

### Groups
- List + create group
- Real-time messages with media

### Feed
- Posts with optional media
- Comments + likes

### WebRTC (P2P Video Calls)
- Dynamic import with `NativeModules.WebRTCModule` check before loading
- Firestore signaling (offer/answer/ICE candidates)
- Requires `expo-dev-client` build (NOT Expo Go)
- Setup guide: `ANDROID_DEV_SETUP.md`

### E2E Encryption (Utility)
- `expo-crypto` AES-256-GCM
- Ready for message payload encryption

### Presence
- Online/offline via Firestore `presence/{userId}`

## Firestore Rules (`firestore.rules`)

**ALWAYS deploy rules after changing this file.** Use Firebase Console (Rules tab) or:
```bash
node scripts/deploy_rules.js rilaxy-cd8c5-firebase-adminsdk-fbsvc-7ebf59683b.json
```

Current rule pattern:
- `users/{userId}` — write only own doc; read if authenticated
- `chats/{chatId}` — read/write only if participant
- `chats/{chatId}/messages/{messageId}` — read if auth; create/update/delete if participant
- `stories/{storyId}` — read if auth; create if own userId; update/delete if own
- `posts/{postId}` — read/create if auth; comments/likes open
- Fallback: `deny all`

## Firestore Indexes

| Collection | Fields | Status |
|------------|--------|--------|
| `chats` | `participants` (array-contains) + `lastMessageTime` (desc) | Created |
| `stories` | `expiresAt` (asc) | Single-field |
| `stories` | `userId` (asc) + `createdAt` (desc) | Created |

## Cloud Functions (`functions/`)
- **Signaling**: WebRTC offer/answer/ICE
- **Presence**: Online/offline tracking
- **Last-message update**: Auto-update `chats/{chatId}.lastMessageTime`
- **Delete expired stories**: PubSub every 60 min (`functions/index.js`)
- **Deploy**: `npx firebase-tools deploy --only functions --project rilaxy-cd8c5` (blocked by slow network)

## Common Issues & Fixes

### "Unknown property: EmojiModifier" (Metro bundling)
The Unicode property escape `\p{EmojiModifier}` in regex fails in the Hermes engine used by Expo. **Fix**: Use a simple `codePointAt()` loop instead:
```ts
function isEmojiOnly(text: string): boolean {
  for (const ch of text.trim()) {
    if (ch.codePointAt(0)! < 0x800) return false;
  }
  return true;
}
```

### "Encountered two children with the same key"
Duplicate emojis in the EMOJIS array. **Fix**: Remove duplicates and use index as React key.

### Firestore rules "permission-denied" for stories
Rule used `stories/{userId}/{storyId}` (subcollection pattern) but stories are stored flat at `stories/{storyId}`. **Fix**: Use `match /stories/{storyId}`.

### Firebase SDK crash in Expo Go
Using modular SDK v10+ causes Metro to load ESM and crash. **Fix**: Use `firebase/compat/*` v9.23.0.

### Supabase Storage RLS
Auto-created bucket policies may reject anon inserts. **Fix**: Run the SQL in `supabase_fix.sql` in Supabase SQL Editor to set public RLS on `rilaxy-media` bucket.

## Deployment Tips
- **Expo Go**: Use LAN (not tunnel, requires ngrok)
- **Firestore rules**: Paste manually in Firebase Console if API deploy fails
- **`.env` needed**: Firebase API key, Supabase URL + anon key
