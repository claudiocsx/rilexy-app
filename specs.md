# Relaxy — Especificação Técnica Completa

---

## 1. Visão Geral do Projeto

**Relaxy** é um aplicativo de mensageria e rede social construído com React Native (Expo SDK 54). Combina chat 1x1, grupos, stories/status, feed de posts, chamadas de vídeo/áudio P2P (WebRTC), figurinhas animadas em vídeo e criptografia ponta-a-ponta (utilitário).

### Stack Principal

| Camada | Tecnologia | Versão/Nota |
|--------|------------|-------------|
| Framework | React Native + Expo | SDK 54, Expo Go (dev) |
| Autenticação | Firebase Auth | v9.23.0 **compat** (`firebase/compat/*`) |
| Banco de Dados | Cloud Firestore | v9.23.0 compat |
| Armazenamento | Supabase Storage | Bucket `rilaxy-media` (público) |
| Navegação | @react-navigation/native | v7 (Bottom Tabs + Stack) |
| Estado Global | Zustand | `settingsStore.ts` |
| Ícones | @expo/vector-icons | Ionicons |
| WebRTC | react-native-webrtc | **Dynamic import** — requer `expo-dev-client` (não Expo Go) |
| Criptografia | expo-crypto | XSalsa20-Poly1305 (tweetnacl secretbox) |
| Áudio | expo-audio | Gravação de mensagens de voz |
| Vídeo | expo-video | Preview de figurinhas em vídeo |
| Notificações | expo-notifications + FCM | Push via endpoint customizado |

### Projetos Externos

| Serviço | Projeto / ID |
|---------|--------------|
| Firebase | `rilaxy-cd8c5` |
| Supabase | `kojmnryyhzxuyxarlvse.supabase.co` |

### Tema Visual

| Token | Valor (Dark) | Valor (Light) |
|-------|--------------|---------------|
| Background | `#020617` | `#f8fafc` |
| Surface | `#0f172a` | `#ffffff` |
| Accent | `#a78bfa` | `#7c3aed` |
| Accent Dark | `#7c3aed` | `#5b21b6` |
| Text | `#f1f5f9` | `#0f172a` |
| Text Muted | `#94a3b8` | `#64748b` |
| Border Light | `#1e293b` | `#e2e8f0` |
| Glass Border | `rgba(167,139,250,0.2)` | `rgba(124,58,237,0.15)` |

---

## 2. Arquitetura de Pastas

```
src/
├── navigation/
│   └── AppNavigator.tsx       # Root navigator (Auth + Main + Stacks)
├── contexts/
│   └── AuthContext.tsx        # Firebase Auth state + onIdTokenChanged
├── services/                  # Camada de dados (Firebase, Supabase, Crypto, etc.)
│   ├── firebase.ts            # Firebase init (compat)
│   ├── auth.ts                # registerUser, loginUser, logoutUser, onAuthChange
│   ├── chat.ts                # findOrCreateChat (deterministic ID)
│   ├── groups.ts              # CRUD grupos, admins, convites, aprovações
│   ├── stories.ts             # postStory, observeStories, markViewed, deleteStory
│   ├── storage.ts             # Upload mídia (chat, story, post, avatar, sticker)
│   ├── crypto.ts              # XSalsa20-Poly1305 (base64 manual p/ Hermes)
│   ├── mediaCache.ts          # Cache local de mídia descriptografada
│   ├── webrtc.ts              # WebRTCService (signal via Firestore)
│   ├── presence.ts            # Online/offline via Firestore
│   ├── notifications.ts       # Expo push + FCM
│   ├── callService.ts         # Listener chamadas entrantes
│   ├── callHistory.ts         # Histórico de chamadas
│   ├── user.ts                # searchUsers
│   ├── postNotifications.ts   # Notificações de posts
│   ├── convites.ts            # Sistema de convites
│   ├── block.ts               # Bloqueio de usuários
│   ├── mute.ts                # Silenciar usuários (mute/unmute)
│   ├── report.ts              # Reportar posts (moderação)
│   ├── lockService.ts         # PIN lock app
│   ├── linkPreview.ts         # Preview de links
│   ├── ringtone.ts            # Toques de chamada
│   ├── videoCompressor.ts     # Compressão de vídeo
│   ├── chatNotifications.ts   # Dedup notificações in-chat + vibração
│   └── supabase.ts            # Lazy init client Supabase
├── screens/                   # Telas (24)
│   ├── Auth: LoginScreen, RegisterScreen, OnboardingScreen, InviteScreen
│   ├── Main: ChatsScreen, FeedScreen, GroupsScreen, ProfileScreen
│   ├── Chat: ChatScreen, NewChatScreen, CreateVideoStickerScreen
│   ├── Stories: CreateStoryScreen
│   ├── Feed: CreatePostScreen
│   ├── Calls: CallScreen, CallHistoryScreen
│   ├── Settings: SettingsScreen, BlockedUsersScreen, MutedUsersScreen, ReportsScreen
│   ├── Media: EditImageScreen, CameraFilterScreen, GroupMediaScreen
│   ├── Profile: UserProfileScreen, LockScreen
│   ├── Search: GlobalSearchScreen
│   └── Misc: AguardandoAprovacaoScreen
├── components/                # Componentes reutilizáveis
│   ├── StoriesRow.tsx         # Carrossel horizontal de stories
│   ├── StoryViewer.tsx        # Visualizador fullscreen c/ progress bars
│   ├── MediaViewer.tsx        # Modal imagem fullscreen
│   ├── VideoPlayer.tsx        # Player de vídeo
│   ├── MessageBubble.tsx      # Bolha de mensagem (chat)
│   ├── AudioMessage.tsx       # Player de áudio
│   ├── StickerPicker.tsx      # Seletor de figurinhas (tabs: Favoritos, Suas, Packs)
│   ├── ReactionBar.tsx        # Barra de reações (long-press)
│   ├── MentionOverlay.tsx     # Popup @menções em grupos
│   ├── IntentionBadge.tsx     # Badge de intenção (perfil)
│   ├── AvatarImage.tsx        # Avatar com inicial
│   ├── Toast.tsx              # Toast global
│   ├── SkeletonList.tsx       # Loading skeleton
│   ├── PollMessage.tsx        # Enquetes (estrutura)
│   ├── EmptyState.tsx         # Estados vazios
│   ├── ErrorBoundary.tsx      # Error boundary
│   ├── CommentsModal.tsx      # Modal de comentários (post)
│   ├── CameraFilter.tsx       # Filtro de câmera overlay
│   └── call/                  # Componentes de chamada
│       ├── VoiceView.tsx
│       ├── VideoView.tsx
│       ├── IncomingCallView.tsx
│       ├── EndedCallView.tsx
│       ├── CallStatusBar.tsx
│       └── CallControls.tsx
├── hooks/
│   ├── useMediaPicker.ts      # Galeria/Câmera
│   └── useDecryptedMedia.ts   # Hook descriptografia + cache
├── store/
│   └── settingsStore.ts       # Zustand: theme, autoDownload, videoStickers, favorites
├── theme/
│   └── colors.ts              # getColors(theme), tokens
├── types/
│   ├── react-native-webrtc.d.ts
│   ├── lottie-react-native.d.ts
│   └── expo-audio.d.ts
├── utils/
│   ├── generateId.ts
│   └── encryption.ts          # Utilitários legados (substituído por crypto.ts)
├── data/
│   ├── stickers.ts            # Packs de figurinhas estáticas (Lottie URLs)
│   ├── emojis.ts              # Array EMOJIS (27 emojis)
│   └── cameraFilters.ts       # Filtros de câmera
├── constants/
│   ├── spacing.ts
│   └── intentions.ts          # INTENTIONS (tipos de "badge" no perfil)
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── notification-icon.png
```

---

## 3. Navegação (`AppNavigator.tsx`)

### Estrutura

```
Stack (Root)
├── Auth Stack (sem header) — fluxo controlado por convite
│   ├── Invite      → InviteScreen          # [entry] código de convite obrigatório
│   ├── Login       → LoginScreen           # email/senha p/ usuários já cadastrados (param: inviteCode?)
│   └── Register    → RegisterScreen         # cadastro (só acessível via InviteScreen, recebe inviteCode)
│
│   Fluxo:
│     App abre → Onboarding? → [não] InviteScreen → código válido? → RegisterScreen → LoginScreen
│                             → [sim] LoginScreen
│     LoginScreen → "Esqueci senha" → resetPassword
│     LoginScreen → (sem link para Register — bloqueado propositalmente)
│     InviteScreen → "Já tem conta?" → LoginScreen
│
└── Main Stack (usuário autenticado)
    ├── Main (Bottom Tabs) → header customizado (RelaxyHeader)
    │   ├── Feed        → FeedScreen
    │   ├── Chats       → ChatsScreen
    │   ├── Plus        → EmptyScreen (botão central flutuante)
    │   ├── Groups      → GroupsScreen
    │   └── Profile     → ProfileScreen
    │
    └── Stack Screens (push/modal)
        ├── Chat              → ChatScreen
        ├── NewChat           → NewChatScreen
        ├── Settings          → SettingsScreen
        ├── BlockedUsers      → BlockedUsersScreen
        ├── GroupMedia        → GroupMediaScreen
        ├── CreatePost        → CreatePostScreen (modal)
        ├── CreateStory       → CreateStoryScreen (modal)
        ├── CameraFilter      → CameraFilterScreen (fullScreenModal)
        ├── Call              → CallScreen (slide_from_bottom)
        ├── GlobalSearch      → GlobalSearchScreen
        ├── CallHistory       → CallHistoryScreen
        ├── CreateVideoSticker→ CreateVideoStickerScreen (modal)
        ├── EditImage         → EditImageScreen (modal)
        ├── UserProfile       → UserProfileScreen
        └── (sem tela)       → AguardandoAprovacaoScreen (renderizado fora do NavigationContainer quando approvalStatus === 'pending')
```

> **Nota**: `AguardandoAprovacaoScreen` não é uma rota de stack. É renderizada diretamente no `AppNavigator` quando `user?.approvalStatus === 'pending'`, bloqueando acesso ao restante do app.

### Header Personalizado (`RelaxyHeader`)
- Logo ♀♂ + "Relaxy"
- Botões: Nova conversa (ícone chatbubble), Lock (long-press no logo), Menu (⋮)
- Menu modal: Conversas arquivadas (em breve), Ajustes, Cancelar
- **Não há botão de busca** no header

### Tab Bar (`GlassTabBar`)
- `BlurView` (expo-blur) com tint dark/light
- Botão central flutuante (`CenterButton`) → navega para `CreatePost`
- Labels localizados: Início, Chats, Grupos, Perfil

---

## 4. Autenticação & Perfil (`AuthContext`, `auth.ts`, `AuthContext.tsx`)

### Arquitetura do Fluxo de Auth

```
                    ┌──────────────┐
                    │  App Inicia  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  Onboarding  │ ← primeira vez apenas
                    │  (carrossel) │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
          ┌─────────│ InviteScreen │◄──────────┐
          │         │ código 8chr  │           │
          │         └──────┬───────┘           │
          │                │                   │
          │         ┌──────▼───────┐           │
          │         │  validação   │           │
          │         │ Firestore    │           │
          │         │ convites/{id}│           │
          │         └──────┬───────┘           │
          │                │                   │
          │         ┌──────▼───────┐           │
          │         │ RegisterScreen│          │
          │         │ email+senha   │          │
          │         │ + nome        │          │
          │         └──────┬───────┘           │
          │                │                   │
          │         ┌──────▼───────┐           │
          │         │  LoginScreen │───────────┘
          │         │ email+senha  │  "Já tem conta?"
          │         └──────┬───────┘
          │                │
          │         ┌──────▼───────┐
          │         │  Main App   │
          │         │  (Tabs)     │
          │         └──────────────┘
```

**Regras do fluxo**:
- `InviteScreen` é a **única porta de entrada** para novos usuários
- `RegisterScreen` **só é acessível** via `InviteScreen` com código validado (parâmetro `inviteCode`)
- `LoginScreen` **não tem link** para Register — impede cadastro sem convite
- Usuários com `approvalStatus === 'pending'` (pendente de aprovação manual) são redirecionados para `AguardandoAprovacaoScreen`
- Usuários com `approvalStatus === 'banned'` são deslogados e bloqueados (signOut + erro)
- `onAuthChange` escuta `onIdTokenChanged` e sincroniza dados do Firestore
- **Persistência**: `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` em `firebase.ts` antes de `firebase.auth()` — necessário porque a build RN do `@firebase/auth` usa `require('react-native').AsyncStorage` que foi removido no RN 0.72+

### Serviços

`onAuthChange(callback)` — `auth.onIdTokenChanged`:
- Busca `users/{uid}` no Firestore e popula `RilaxyUser`
- Retorna `RilaxyUser` tipado: `{ uid, email, displayName, photoURL, status, intention, intentionUpdatedAt, approvalStatus, codigoConvite, createdAt }`

`registerUser(email, password, displayName, codigoConvite?)`:
1. `createUserWithEmailAndPassword`
2. `updateProfile({ displayName })`
3. Grava `users/{uid}` com `displayNameLower`, `photoURL`, `status: 'offline'`
4. Se `codigoConvite` → `approvalStatus: 'pending'`, senão `'approved'`
5. Retorna `{ uid, email, displayName, photoURL }`

`loginUser(email, password)`:
- `signInWithEmailAndPassword`
- Retorna `{ uid, email, displayName, photoURL }`

`logoutUser()` → `auth.signOut()`

`resetPassword(email)` → `auth.sendPasswordResetEmail(email)`

---

## 5. Chat 1x1 (`chat.ts`, `ChatScreen.tsx`, `ChatsScreen.tsx`)

### Estrutura Firestore

```
chats/{chatId} (doc)
  - participants: string[] (sorted UIDs join '_')
  - name?: string (nome do grupo ou null p/ 1x1)
  - createdAt: Timestamp
  - lastMessageTime: Timestamp
  - isGroup?: boolean
  - groupId?: string
  - photoURL?: string
  - hiddenFor: string[] (archive)
  - clearedAt: map<uid, Timestamp>
  - typing: map<uid, Timestamp>

chats/{chatId}/messages/{messageId} (subcollection)
  - text?: string
  - mediaUrl?: string
  - mediaKey?: string (base64)
  - mediaIv?: string (base64)
  - mediaType?: string
  - senderId: string
  - senderName?: string
  - timestamp: Timestamp
  - participants: string[]
  - forwarded?: boolean
  - readBy: string[]
  - deletedFor?: string[]
  - deletedForEveryone?: boolean
  - viewOnce?: boolean
  - viewedOnceBy?: string[]
  - audioUrl?: string
  - duration?: number
  - reactions?: { [emoji: string]: string[] }
  - sticker?: { id, emoji, name, lottieUrl }
  - replyTo?: { id, text?, senderId, senderName, mediaUrl?, audioUrl? }
```

### `findOrCreateChat(currentUid, otherUid, otherDisplayName?)`
- ID determinístico: `sorted([uid1, uid2]).join('_')`
- Cria/atualiza doc `chats/{chatId}` com `participants`, `name`, `lastMessageTime`
- Lida com `hiddenFor` (unarchive) e `clearedAt`

### Funcionalidades do ChatScreen

| Feature | Implementação |
|---------|---------------|
| Mensagens tempo real | `onSnapshot` ordenado por `timestamp asc` |
| Envio texto | `add()` em `messages` subcollection |
| Mídia (imagem/vídeo) | `uploadEncryptedChatMedia` → AES-256-GCM → Supabase |
| Legenda mídia | Campo `text` na mesma mensagem |
| Visualização única (👁️) | Toggle `viewOnceMode` só aparece com mídia selecionada; blur + "Toque para ver"; `viewedOnceBy` array |
| Áudio | `expo-audio` `AudioRecorder`; upload não criptografado |
| Emoji picker | 27 emojis fixos (`EMOJIS` array) |
| Figurinhas animadas | `StickerPicker` (Lottie via `lottie-react-native`) |
| Figurinhas de vídeo | Aba "Suas" no picker; `VideoView` loop |
| Reações | Long-press → `ReactionBar`; `reactions` map no doc |
| Responder | Swipe right → `replyTo` no envio |
| Encaminhar | Long-press → "Encaminhar" → lista de chats |
| Apagar para mim | `deletedFor: arrayUnion(uid)` |
| Apagar para todos | `deletedForEveryone: true` + delete mídia no Storage |
| Busca mensagens | Header search icon → filtro local por `text` |
| Digitando... | `typing.{uid}` timestamp no chat doc (TTL 2s) |
| Lido (✓/✓✓) | `readBy` array; debounce 500ms |
| Big emoji | `isEmojiOnly()` → `fontSize: 42` + pulse animation |
| Criptografia | `mediaKey`/`mediaIv` no doc; descriptografia on-demand via `useDecryptedMedia` |
| Cache mídia | `mediaCache.ts` → `expo-file-system` cache dir `rilaxy-decrypted` |

### ChatsScreen
- `where('participants', 'array-contains', uid).orderBy('lastMessageTime', 'desc')`
- Nomes/fotos dos contatos via batch `where('uid', 'in', chunks[10])`
- **Online indicator**: subscribe to `presence/{uid}` — ponto verde no avatar quando `online: true`
- **Skeleton loading**: 5 rows placeholder com pulse animation
- **Pressable + Haptic**: todos os itens de chat e FAB
- FAB "+" → `NewChatScreen`

---

## 6. Stories / Status (`stories.ts`, `StoriesRow.tsx`, `StoryViewer.tsx`, `CreateStoryScreen.tsx`)

### Firestore: `stories/{storyId}` (coleção flat)

```typescript
interface Story {
  id: string;
  userId: string;
  userName: string;
  photoURL?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  text?: string;
  bgColor?: string;           // 8 cores pré-definidas
  createdAt: Timestamp;
  expiresAt: Timestamp;       // +24h
  viewedBy: string[];
  videoSegmentStart?: number;
  videoSegmentEnd?: number;
}
```

### Funcionalidades
- **Criação**: Fundo colorido + emoji/texto **OU** mídia (foto/vídeo 15s)
- **8 cores** + **30 emojis** picker
- **Expiração**: 24h (Cloud Function pubsub a cada 60min limpa expirados)
- **Row no ChatsScreen**: "Meu Status" (sempre primeiro) + contatos com stories ativos
- **Viewer**: Fullscreen, progress bars (5s auto), tap L/R navega, swipe down fecha
- **Animações**: Fade-in + scale-up + pulse contínuo no texto/emoji
- **Visualização**: `markViewed(storyId, uid)` → `viewedBy: arrayUnion(uid)`

### Observers
- `observeStories(callback)` → filtra `expiresAt >= now`, ordena `expiresAt asc`, agrupa por `userId`
- `observeMyStory(uid, callback)` → `where userId == uid`, `createdAt desc`

---

## 7. Grupos (`groups.ts`, `GroupsScreen.tsx`, `ChatScreen.tsx` group logic)

### Firestore: `groups/{groupId}`

```typescript
interface GroupData {
  id: string;
  name: string;
  description?: string;
  participants: string[];
  createdBy: string;
  createdAt: Timestamp;
  photoURL?: string;
  inviteCode: string;           // 8 chars alfanumérico
  admins: string[];             // creator = admin inicial
  memberTags: Record<string, string>; // uid → "Tag"
  pendingApprovals: string[];   // usuários aguardando aprovação
  autoDeleteDuration?: number | null; // segundos (1h, 1d, 7d, 90d)
  bannedUsers: Record<string, string>; // uid → reason
}
```

### Sincronização
- `groups/{groupId}` ↔ `chats/{groupId}` (mesmo ID)
- `createGroup` cria ambos atomicamente (batch)

### Funcionalidades
| Feature | Detalhes |
|---------|----------|
| Criar grupo | Nome + participantes → `createGroup` |
| Admins | `admins[]`; criador pode `promoteToAdmin` / `demoteAdmin` |
| @Menções | Digitar `@` → `MentionOverlay` com membros; admin vê "Adicionar externo" |
| Push menção | `sendExpoPush` p/ cada mencionado |
| Highlight menção | Render roxo no `MessageBubble` (cor accent) |
| Link convite | `inviteCode`; botão copiar no info do grupo |
| Aprovação entrada | `joinGroupByCode` → `pendingApprovals`; admin aprova/rejeita |
| Member Tags | Toque no próprio nome no info → define tag |
| Auto-delete | Opção no info; Cloud Function limpa mensagens antigas |
| Banir | `banMember` → remove de participants + `bannedUsers` |
| Transferir ownership | `transferOwnership` |

---

## 8. Feed / Posts (`FeedScreen.tsx`, `CreatePostScreen.tsx`)

### Firestore: `posts/{postId}`

```typescript
interface Post {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  mediaUrl?: string;           // single (legacy)
  mediaKey?: string;
  mediaIv?: string;
  mediaType?: string;
  mediaUrls?: string[];        // multi-mídia
  mediaKeys?: string[];
  mediaIvs?: string[];
  timestamp: Timestamp;
  likesCount: number;
  commentsCount: number;
  likedBy?: string[];
  reactions?: { [emoji: string]: string[] };
}
```

### Subcollections
- `posts/{postId}/comments/{commentId}`: `{ text, senderId, senderName, timestamp }`
- `posts/{postId}/likes/{userId}`: `{ }` (existência = like)

### Features
- Posts com múltiplas mídias (imagem/vídeo)
- Criptografia opcional (mesmo esquema do chat)
- Curtir / Comentar (tempo real via `onSnapshot`)
- Modal comentários (`CommentsModal`)
- Delete próprio post (ou admin)
- StoriesRow no topo do Feed
- **Double-tap to like** (gesto Instagram)
- **Carrossel de mídia** (swipe horizontal entre `mediaUrls[]`)
- **Pinch-to-zoom** no `MediaViewer` (gesture-handler)
- **Editar post** (alterar caption/texto)
- **Compartilhar post no chat** (selecionar chat → enviar)
- **Reações** (❤️😂😢😡👍) — long-press no like abre picker animado
- **Bookmark/Salvar** — botão bookmark com `savedBy[]` no Firestore
- **Video autoplay** — `expo-video` `useVideoPlayer` com `muted: true` quando visível
- **Hashtags clicáveis** — `parsePostText()` extrai `#hashtag` do texto, tappable
- **@Menções** — `@username` parseado, tappable → navega para perfil
- **3 feeds** — "Para Você" (all), "Seguindo" (chat participants), "Favoritos" (savedBy)
- **Skeleton loading** — 3 cards placeholder com pulse animation
- **Tab indicator animado** — underline spring entre tabs
- **Pressable + Haptics** — todos os botões de ação com feedback tátil
- **Empty states melhorados** — ícone circular + CTA "Criar post"

---

## 9. WebRTC — Chamadas P2P (`webrtc.ts`, `CallScreen.tsx`, `callService.ts`)

### Arquitetura
- **Signaling via Firestore**: `calls/{userId}` doc + `iceCandidates` subcollection
- **STUN/TURN**: Google STUN + openrelay.metered.ca TURN
- **Requer**: `expo-dev-client` (build nativo) — **NÃO funciona no Expo Go**
- **Dynamic import**: `react-native-webrtc` só carrega se `NativeModules.WebRTCModule` existir

### Fluxo Chamada
1. **Caller**: `startCall()` → `createOffer` → salva `offer` em `calls/{calleeId}` + FCM push
2. **Callee**: `listenForOffer` → `answerCall()` → `setRemoteDescription(offer)` → `createAnswer` → salva `answer` em `calls/{callerId}`
3. **ICE**: Candidates trocados via `calls/{userId}/iceCandidates` (queue + process após remote description)
4. **Estabelecido**: `onRemoteStream` → render `VideoView` / `VoiceView`
5. **Encerrar**: `hangUp()` → `status: 'ended'` + cleanup

### Componentes de Call
- `CallScreen`: Orquestra estado (connecting, ringing, connected, ended)
- `IncomingCallView`: Tela de chamada entrante (aceitar/recusar)
- `CallControls`: Mute, video toggle, switch camera, end
- `CallStatusBar`: Duração, status conexão

---

## 10. Figurinhas Animadas em Vídeo (`CreateVideoStickerScreen.tsx`, `StickerPicker.tsx`, `settingsStore.ts`)

### Criação
1. Picker vídeo da galeria (`expo-image-picker`, max 10s, permite trim)
2. Preview loop muted (`expo-video` `VideoView`)
3. Trim handles (início/fim) → define `trimStart`, `trimEnd`
4. Nome + emoji representativo
5. **Salva local**: `DocumentDirectory/rilaxy-stickers/{id}.mp4`
6. **Upload Supabase**: `rilaxy-stickers/{id}.mp4` (bucket `rilaxy-media`)
7. **Index local**: `index.json` + `favorites.json` (Zustand persiste)

### Uso no Chat
- `StickerPicker` → aba "Suas" mostra `VideoStickerMeta[]`
- `VideoView` loop preview no picker
- Envio: `sticker: { id, emoji, name, lottieUrl: videoUrl }` no message doc
- Recebimento: `VideoView` renderiza loop muted

### Persistência Local
```
Paths.document/rilaxy-stickers/
├── index.json        # VideoStickerMeta[]
├── favorites.json    # string[] (ids)
└── {id}.mp4          # arquivo local (fallback se URL remota falhar)
```

---

## 11. Criptografia Ponta-a-Ponta (Utilitário) — `crypto.ts`

### Algoritmo
- **XSalsa20-Poly1305** via `tweetnacl.secretbox` (não é AES)
- Chave: 32 bytes (`getRandomBytesAsync(32)`)
- Nonce/IV: 24 bytes (`getRandomBytesAsync(24)`)
- Base64 **manual** (sem `btoa`/`atob` — Hermes corrompe bytes >127)

### Funções Exportadas
| Função | Descrição |
|--------|-----------|
| `generateMediaKey()` | `{ key: base64, iv: base64 }` |
| `encryptMedia(uri, keyB64, ivB64)` | `Uint8Array` criptografado |
| `decryptAndCache(mediaUrl, keyB64, ivB64, mimeType)` | Baixa, descriptografa, salva cache, retorna `file://` URI |
| `extractStoragePath(url)` | Extrai path do Supabase public URL |
| `pathHash(path)` | FNV-1a hex (8 chars) p/ nome arquivo cache (não usa `createHash` — expo-crypto não exporta) |

### Cache Descriptografado
- Dir: `CacheDirectory/rilaxy-decrypted/`
- Arquivo: `{pathHash}.jpg|mp4` (FNV-1a hash, 8 hex chars)
- `useDecryptedMedia` hook gerencia loading/error state

### Correções Hermes (críticas)
- **NÃO usar** `btoa`/`atob`/`String.fromCharCode` — corrompe bytes > 127
- `blob.arrayBuffer()` pode falhar → `new Response(blob).arrayBuffer()` fallback
- `new Blob([Uint8Array])` falha → `buffer.slice(offset, offset+len)` para cópia segura

---

## 12. Armazenamento Supabase (`storage.ts`)

### Bucket: `rilaxy-media` (público, RLS via SQL `supabase_fix.sql`)

### Funções Principais
| Função | Path | Criptografia |
|--------|------|--------------|
| `uploadMedia(uri, path, contentType)` | (base) | Não |
| `uploadEncryptedMedia(uri, path, contentType)` | (base) | **Sim** (XSalsa20-Poly1305) |
| `uploadChatMedia` | `chats/{chatId}/{msgId}.{ext}` | Não |
| `uploadEncryptedChatMedia` | `chats/{chatId}/{msgId}.{ext}` | **Sim** (XSalsa20-Poly1305) |
| `uploadPostMedia` | `posts/{postId}/media.{ext}` | Não |
| `uploadEncryptedPostMedia` | `posts/{postId}/media.{ext}` | **Sim** |
| `uploadPostMedias` | `posts/{postId}/media_{i}.{ext}` | Não (array) |
| `uploadEncryptedPostMedias` | `posts/{postId}/media_{i}.{ext}` | **Sim** (array) |
| `uploadAvatar` | `avatars/{uid}.{ext}` | Não |
| `uploadStoryMedia` | `stories/{uid}/{storyId}.{ext}` | Não |
| `uploadChatDocument` | `chats/{chatId}/documents/{msgId}.{ext}` | Não |
| `deleteMedia(path)` | Remove do bucket | — |

### Upload
- `File(uri).arrayBuffer()` → `supabase.storage.from(BUCKET).upload(path, arrayBuffer, { contentType, upsert: true })`
- Public URL: `supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl`

---

## 13. Cache de Mídia (`mediaCache.ts`)

```typescript
getMediaUri(remoteUrl) → local file:// URI
downloadAndCache(remoteUrl) → baixa + salva em CacheDir
clearCache() → remove CacheDir/rilaxy-decrypted
getCacheSize() → bytes totais
```

- Usado por `autoDownload` setting (`always` | `wifi` | `never`)
- `ChatScreen` pré-baixa mídia de mensagens recentes

---

## 14. Presença Online/Offline (`presence.ts`)

- Doc: `presence/{uid}` → `{ online: boolean, lastSeen: Timestamp }`
- `onAppStateChange`: foreground → `online: true`, background → `online: false, lastSeen: now`
- Cloud Function `onWrite` mantém `lastSeen` preciso

---

## 15. Notificações Push (`notifications.ts`, `callService.ts`)

### Canais Android
- `default`, `messages`, `posts`, `calls` (importance MAX, vibração, lightColor `#a78bfa`)

### Tipos de Push
| Evento | Título | Body | Data | Category |
|--------|--------|------|------|----------|
| Nova mensagem | `Nome` | `Mensagem...` | `{type: 'message', chatId}` | `message` |
| Chamada entrante | `Nome está ligando...` | `Chamada recebida` | `{type: 'call', callerId, audioOnly}` | `incomingCall` |
| Menção grupo | `Menção em Grupo` | `@você ...` | `{type: 'mention', chatId}` | `message` |
| Post like/comment | `Nome curtiu/comentou` | `...` | `{type: 'post', postId}` | `post` |

### FCM
- Token salvo em `users/{uid}.expoPushToken` + `fcmToken`
- Endpoint custom: `EXPO_PUBLIC_PUSH_URL` (default `https://rilexy-api.vercel.app/send-push`)
- API Key: `EXPO_PUBLIC_PUSH_API_KEY`

### Listener Respostas
- `addNotificationResponseListener` → navega para Chat/Call/Post conforme `data.type`

---

## 16. Lock Screen / PIN (`lockService.ts`, `LockScreen.tsx`)

- PIN 6 dígitos salvo no **Keychain/Keystore** (expo-secure-store implícito)
- `isPinSetup()` / `isLocked()` / `lockApp()` / `verifyPin(pin)`
- Bloqueio automático ao background (`AppState` change)
- `LockScreen` modal fullscreen sobre `AppNavigator`

---

## 17. Configurações (`SettingsScreen.tsx`, `settingsStore.ts`)

| Setting | Tipo | Persistência |
|---------|------|--------------|
| Tema | `dark` / `light` | Zustand (memória) |
| Auto-download mídia | `always` / `wifi` / `never` | Zustand |
| Limpar cache mídia | Ação | `mediaCache.clearCache()` |
| PIN Lock | Setup/Change/Disable | SecureStore |
| Figurinhas favoritas | Toggle estrela | `favorites.json` local |
| Uso figurinhas | Auto (top 8) | `stickerUsage` Zustand |

---

## 18. Firestore Rules (`firestore.rules`)

```javascript
// Users
match /users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == userId || isAdmin();
}

// Convites
match /convites/{codigo} {
  allow read: if true;
  allow create, update: if isAdmin();
}

// Admins
match /admins/{uid} { allow read: if request.auth != null; allow write: if false; }

// Chats 1x1
match /chats/{chatId} {
  allow read: if request.auth != null;
  allow create: if request.auth.uid in request.resource.data.participants;
  allow update, delete: if request.auth.uid in resource.data.participants;

  match /messages/{messageId} {
    allow read: if request.auth != null;
    allow create: if request.auth != null;
    allow update, delete: if request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
  }
}

// Grupos
match /groups/{groupId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow delete: if request.auth.uid == resource.data.createdBy;
  allow update: if request.auth.uid in resource.data.participants;

  match /messages/{messageId} {
    allow read: if request.auth != null;
    allow create: if request.auth.uid in get(/databases/$(database)/documents/groups/$(groupId)).data.participants;
    allow update, delete: if request.auth.uid == resource.data.senderId;
  }
}

// Posts
match /posts/{postId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow delete: if request.auth.uid == resource.data.senderId || isAdmin();
  allow update: if request.auth.uid == resource.data.senderId
    || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['commentsCount','likesCount','likedBy','reactions','mediaUrls','mediaKeys','mediaIvs','mediaType']);

  match /comments/{commentId} { allow read, create: if request.auth != null; }
  match /likes/{userId} { allow read, write: if request.auth != null; }
}

// Stories (flat collection)
match /stories/{storyId} {
  allow read: if request.auth != null;
  allow create: if request.auth.uid == request.resource.data.userId;
  allow update, delete: if request.auth.uid == resource.data.userId;
}

// WebRTC Signaling
match /calls/{userId} { allow read, write: if request.auth != null; }
match /calls/{userId}/iceCandidates/{cid} { allow read, write: if request.auth != null; }

// Call History
match /callHistory/{userId}/logs/{logId} {
  allow read, create, delete: if request.auth.uid == userId;
}

// Fallback
match /{document=**} { allow read, write: if false; }
```

### Índices Necessários
| Coleção | Campos | Status |
|---------|--------|--------|
| `chats` | `participants` (array-contains) + `lastMessageTime` (desc) | ✅ Criado |
| `stories` | `expiresAt` (asc) | ✅ Single-field |
| `stories` | `userId` (asc) + `createdAt` (desc) | ✅ Criado |
| `callHistory/{uid}/logs` | `timestamp` (desc) | ✅ Criado |

---

## 19. Cloud Functions (`functions/index.js`)

| Função | Trigger | Descrição |
|--------|---------|-----------|
| `signaling` | HTTP / onWrite | WebRTC offer/answer/ICE |
| `presence` | onWrite `presence/{uid}` | Atualiza `lastSeen` |
| `updateLastMessage` | onCreate `chats/{chatId}/messages/{msgId}` | Atualiza `lastMessageTime` no chat |
| `deleteExpiredStories` | PubSub (every 60 min) | Deleta `stories` onde `expiresAt < now` |

> **Deploy bloqueado** por rede lenta. Deploy manual via Firebase Console (Rules tab) ou:
> ```bash
> npx firebase-tools deploy --only functions --project rilaxy-cd8c5
> ```

---

## 20. Problemas Conhecidos & Fixes (do AGENTS.md)

| Problema | Causa | Fix |
|----------|-------|-----|
| `Unknown property: EmojiModifier` | Regex `\p{EmojiModifier}` falha no Hermes | Usar `codePointAt()` loop: `code < 0x800` → não é emoji |
| `Encountered two children with same key` | Duplicatas no array `EMOJIS` | Remover duplicatas + usar `index` como key |
| Firestore `permission-denied` stories | Rule usava `stories/{userId}/{storyId}` (subcollection) mas dados ficam flat em `stories/{storyId}` | Rule: `match /stories/{storyId}` |
| Firebase SDK crash Expo Go | Modular SDK v10+ → Metro carrega ESM | Usar **sempre** `firebase/compat/*` v9.23.0 |
| `Decryption failed` (Hermes base64) | `btoa`/`atob`/`String.fromCharCode` corrompe bytes > 127 | Base64 manual (`uint8ToBase64`/`base64ToUint8`) — ver `crypto.ts:9-43` |
| `blob.arrayBuffer()` buggy | Hermes | `new Response(blob).arrayBuffer()` fallback → `blob.arrayBuffer()` |
| `new Blob([Uint8Array])` falha | Hermes | Usar `buffer.slice(byteOffset, byteOffset+byteLength)` |
| Supabase RLS rejeita anon insert | Políticas auto-criadas | Rodar `supabase_fix.sql` no SQL Editor (público no bucket `rilaxy-media`) |
| `Invalid hook call` em `renderPost` (FeedScreen) | Callback `renderPost` (usa `useRef`/`useCallback`) passado como `renderItem` ao `FlatList` — callback não é componente React, viola Rules of Hooks | Extrair para componente `PostItem` separado com `PostItemProps` interface |
| Auth não persiste após reinício (sessão perdida) | `@firebase/auth` build RN usa `require('react-native').AsyncStorage` removido no RN 0.72+ → fallback in-memory | `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` em `firebase.ts` antes de `firebase.auth()` |
| Feed não renderiza mídia (cards vazios) | `expo-crypto` não exporta `createHash` → `pathHash()` chamava `undefined` → `TypeError` em todo `decryptAndCache` | Substituir por FNV-1a hash em `crypto.ts`; corrigir MIME type; retornar `null` em fetch error; remover filtro `mediaKeys` |
| MediaViewer fullscreen não fecha no toque | `Gesture.Simultaneous` com tap + pan faz o pan "engolir" o toque antes do singleTap resolver | Substituir gesture-based close por `Pressable` no backdrop; gestures (pinch/pan/doubleTap) só na imagem |

---

## 21. Comandos Úteis

```bash
# Dev (LAN)
npx expo start

# Deploy Firestore Rules (manual via Console ou)
node scripts/deploy_rules.js service-account.json

# Deploy Cloud Functions
npx firebase-tools deploy --only functions --project rilaxy-cd8c5

# Limpar cache Metro
npx expo start -c

# Ver logs dispositivo
npx expo log:device
```

---

## 22. Variáveis de Ambiente (`.env` — **não comitar**)

```env
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=rilaxy-cd8c5.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=rilaxy-cd8c5
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=rilaxy-cd8c5.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://kojmnryyhzxuyxarlvse.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# Push Notifications (opcional)
EXPO_PUBLIC_PUSH_URL=https://rilexy-api.vercel.app/send-push
EXPO_PUBLIC_PUSH_API_KEY=...
```

---

## 23. Roadmap Sugerido (Priorizado)

### ~~Fase 1 — Feed Core~~ ✅ CONCLUÍDA
1. ~~Double-tap to like~~
2. ~~Carrossel de mídia~~
3. ~~Pinch-to-zoom~~
4. ~~Editar post~~
5. ~~Compartilhar post no chat~~

### ~~Fase 2 — Engajamento Social~~ ✅ CONCLUÍDA
6. ~~**Post reactions** — múltiplas reações (❤️😂😢😡👍) em vez de like único~~ (v1.0.5)
7. ~~**Salvar/Bookmark post** — coleção pessoal~~ (v1.0.5)
8. ~~**Mute user** — ocultar posts do feed sem bloquear~~ (v1.1.0)
9. ~~**Reportar post** — moderação (admin pode deletar)~~ (v1.1.1)
10. ~~**Hashtags #** — clicáveis com busca por tag~~ (v1.0.5)
11. ~~**@Menções em posts** — marcar usuários~~ (v1.0.5)
12. ~~**Feed de perfil do usuário** — grid de posts do usuário~~ (pré-existente)
13. ~~**Video autoplay** (muted, com som ao tocar)~~ (v1.0.5)
14. **Drafts** — rascunhos de posts
15. ~~**Múltiplos feeds** (Seguindo / Para Você / Favoritos)~~ (v1.0.5)

### ~~Fase 3 — UX Polish~~ ✅ CONCLUÍDA
16. ~~**Skeleton loading** — cards placeholder com pulse~~ (v1.0.9)
17. ~~**Haptic feedback** — vibração em ações principais~~ (v1.0.9)
18. ~~**Pressable** — substituir TouchableOpacity~~ (v1.0.9)
19. ~~**Tab indicator animado** — spring entre tabs~~ (v1.0.9)
20. ~~**Reaction picker animado** — scale+fade~~ (v1.0.9)
21. ~~**Empty states** — CTA + ícone contextual~~ (v1.0.9)
22. ~~**Online indicator** — ponto verde no avatar~~ (v1.0.9)

### Fase 4 — Infraestrutura (contínuo)
23. **E2E Encryption Real** — integrar `crypto.ts` em todo envio/recebimento de mensagens (hoje só mídia usa)
24. **Message Search Global** — indexar mensagens/posts/usuários
25. **Backup/Restore Chat** — exportar conversas (JSON + mídia)
19. **Link Preview** — `linkPreview.ts` serviço pronto, precisa UI no chat
20. **Multi-device Sync** — Firestore já suporta, testar sessões simultâneas
21. **Performance** — Virtualized lists (`FlashList`), memoização pesada em `ChatScreen`
22. **Tests** — Jest + React Native Testing Library (não há testes hoje)
23. **CI/CD** — GitHub Actions para lint, typecheck, build EAS

---

## 24. Referências de Arquivos-Chave

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `src/navigation/AppNavigator.tsx` | 650 | Navegação completa |
| `src/screens/ChatScreen.tsx` | 1944 | Chat 1x1 + grupos (core) |
| `src/screens/ChatsScreen.tsx` | 270 | Lista de conversas (skeleton, online, pressable) |
| `src/screens/FeedScreen.tsx` | 1235 | Feed com posts (8 features + skeleton + haptics + tabs animadas) |
| `src/components/MessageBubble.tsx` | 1176 | Bubble de mensagem (share card, view-once, big emoji) |
| `src/components/MediaViewer.tsx` | 151 | Visualizador fullscreen (pinch-to-zoom + Pressable close) |
| `src/services/firebase.ts` | 25 | Firebase init + auth persistence |
| `src/services/chat.ts` | 52 | `findOrCreateChat` |
| `src/services/groups.ts` | 216 | Grupos CRUD + admins |
| `src/services/stories.ts` | 157 | Stories observer + CRUD |
| `src/services/storage.ts` | 199 | Upload Supabase (criptografado ou não) |
| `src/services/crypto.ts` | 141 | XSalsa20-Poly1305 + base64 manual + FNV-1a pathHash |
| `src/services/webrtc.ts` | 351 | WebRTC signaling via Firestore |
| `src/components/StoriesRow.tsx` | 306 | Carrossel stories (haptics + pressable) |
| `src/components/StoryViewer.tsx` | — | Visualizador fullscreen |
| `src/components/StickerPicker.tsx` | 188 | Picker figurinhas (estáticas + vídeo) |
| `src/store/settingsStore.ts` | 134 | Zustand (tema, auto-download, stickers) |
| `firestore.rules` | 111 | Regras de segurança (inclui savedBy) |
| `src/theme/colors.ts` | 53 | Tokens de cor dark/light |

---

*Documento gerado automaticamente a partir da análise do código-fonte (Jul 2025). Última atualização: v1.1.1 (Report Post).*

---

## 25. Análise Comparativa — Feed

### Estado Atual do Feed (`FeedScreen.tsx`, `CreatePostScreen.tsx`)

| Aspecto | Implementação Atual |
|---------|-------------------|
| Tipo de feed | **Cronológico puro** — todos os posts de todos os usuários, ordenados por `timestamp desc` |
| Stories | ✅ `StoriesRow` no topo + `StoryViewer` fullscreen |
| Post text | ✅ Input + body |
| Mídia única | ✅ Imagem/vídeo (via `expo-image`) |
| Múltiplas mídias | ✅ Array `mediaUrls[]` + `mediaKeys[]` + `mediaIvs[]` |
| Criptografia mídia | ✅ AES-256-GCM via `uploadEncryptedPostMedias` |
| Carrossel in-post | ✅ Swipe horizontal `mediaUrls[]` com dots indicativos |
| Curtir | ✅ Heart toggle, `likedBy[]`, `likesCount` |
| Comentário inline | ✅ TextInput abaixo de cada post |
| Modal comentários | ✅ `CommentsModal` — FlatList + input |
| Comentário tempo real | ✅ `onSnapshot` na subcollection |
| Delete post | ✅ Só do próprio autor |
| Push notificações | ✅ Curtidas/comentários via `postNotifications.ts` |
| Pull-to-refresh | ✅ `RefreshControl` |
| Post notifications (outbound) | ✅ Notifica contatos via `sendFcmPush` ao criar post |
| Cache descriptografado | ✅ `decryptAndCache` em `useEffect` |
| Tela criação | ✅ `CreatePostScreen` (texto + múltiplas mídias + compressão vídeo) |
| Stories no feed | ✅ Feed + Stories na mesma tela |

### Comparativo com Apps Similares

| Funcionalidade | Instagram | Facebook | WhatsApp | Telegram | Relaxy |
|----------------|-----------|----------|----------|----------|--------|
| Feed cronológico | Opcional | Opcional | N/A | N/A | ✅ |
| Stories | ✅ | ✅ | ✅ | ✅ | ✅ |
| Double-tap like | ✅ | ✅ | ❌ | ❌ | ✅ |
| Post reactions | ❌ | ✅❤️ | ✅ | ✅ | ❌ |
| Compartilhar post no chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| Salvar/Bookmark post | ✅ | ✅ | ❌ | ❌ | ❌ |
| Carrossel mídia | ✅ | ✅ | ❌ | ❌ | ✅ |
| Editar post | ✅ | ✅ | ❌ | ✅ | ✅ |
| Pinch-to-zoom | ✅ | ✅ | ✅ | ✅ | ✅ |
| Hashtags # | ✅ | ✅ | ❌ | ✅ | ❌ |
| @Menções em posts | ✅ | ✅ | ❌ | ✅ | ❌ |
| Muting user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reportar post | ✅ | ✅ | ✅ | ✅ | ❌ |
| Video autoplay | ✅ | ✅ | ✅ | ✅ | ❌ |
| Múltiplos feeds | ✅ | ✅ | ❌ | ❌ | ❌ |
| Post scheduling | ✅ | ✅ | ❌ | ❌ | ❌ |
| Drafts | ✅ | ✅ | ❌ | ✅ | ❌ |
| Feed explorar/descobrir | ✅ | ✅ | ❌ | ✅ | ❌ |
| Live streaming | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reels/Shorts | ✅ | ✅ | ❌ | ❌ | ❌ |
| Filtros/efeitos câmera | ✅ | ✅ | ❌ | ❌ | Parcial |

### Análise por Categoria

#### 1. Navegação e UX do Feed
- **Instagram/Facebook** usam feed infinito com scroll, tabs (Following/Favorites/For You), e interação rápida
- **Relaxy** — feed linear único, sem tabs, sem filtro
- **Gap**: Falta segmentação do feed (ex: "Seguindo" vs "Explorar" vs "Favoritos")

#### 2. Interação com Posts
- **Double-tap like** é padrão da indústria (Instagram, Facebook, TikTok) — ✅ Implementado
- **Post reactions** (Facebook: ❤️😂😢😡; Telegram: 👍👎) — Relaxy não tem além do like
- **Compartilhar post** diretamente no chat — ✅ Implementado
- **Salvar post** para ver depois (bookmark) — Relaxy não tem
- **Editar post** após publicação — ✅ Implementado

#### 3. Mídia e Visualização
- **Carrossel**: swipe horizontal entre múltiplas mídias no mesmo post — ✅ Implementado (dots indicativos)
- **Pinch-to-zoom**: essencial para visualizar fotos — ✅ Implementado (gesture-handler)
- **Video autoplay**: padrão em todos os apps de feed — Relaxy mostra thumbnail com play button

#### 4. Descoberta e Conexão Social
- **Hashtags (#)**: Instagram/Telegram/Facebook usam para categorizar e buscar — Relaxy não tem
- **@Menções em posts**: marcar outros usuários — Relaxy não tem
- **Mute user**: silenciar posts de alguém sem bloquear — Relaxy não tem
- **Feed de perfil**: grid de posts do usuário — `UserProfileScreen` existe mas não mostra posts

#### 5. Moderação e Controle
- **Reportar post**: nenhum app social moderno deixa de ter — Relaxy não tem
- **Restrict/Mute**: controle granular sobre o que aparece — Relaxy não tem

### Prioridades de Melhoria Sugeridas

#### ✅ Concluídas (Fase 1)
1. **Double-tap to like** — implementado
2. **Compartilhar post no chat** — implementado
3. **Carrossel de mídia** — implementado (swipe + dots)
4. **Pinch-to-zoom** em `MediaViewer` — implementado
5. **Editar post** — implementado

#### 🟡 Médias (Impacto Social)
6. **Post reactions** (❤️😂😢😡👍) — em vez de apenas like
7. **Salvar/Bookmark post** — coleção pessoal de posts favoritos
8. **Mute user** — esconder posts sem bloquear a pessoa
9. **Reportar post** — moderação básica (admin pode deletar)
10. **Hashtags #** — clicáveis, com busca por tag (escopo privado)
11. **@Menções em posts** — marcar usuários no post

#### 🟢 Baixas (Nice to Have)
12. **Video autoplay** no feed (muted, como Instagram)
13. **Feed de perfil do usuário** — grid de posts do usuário
14. **Drafts** — salvar rascunho de post
15. **Múltiplos feeds** (Seguindo / Para Você)
16. **Post scheduling** — agendar publicação
17. **Stories quick reply** — enviar reação emoji para story (já tem `IntentionBadge`)

### Análise de Esforço vs Impacto

```
Alto impacto │
pouco esforço │  ~~Double-tap like~~ ✅
             │  ~~Carrossel mídia~~ ✅
             │  ~~Editar post~~ ✅
             │  ~~Compartilhar post~~ ✅
             │  ~~Pinch-to-zoom~~ ✅
             │
             │  Post reactions
             │  Bookmark/Salvar
             │  Hashtags #
             │
             │  @Menções
             │  Mute user     ● Report
             │  Video autoplay
             │
             │  Drafts        ● Feed perfis
             │  Scheduling    ● Múltiplos feeds
             │
             └──────────────────────────────▶
                Pouco esforço    Muito esforço
```

---

## 26. Changelog / Planos Executados

### v1.0.1 — Remover link de cadastro da tela de login

**Data**: Jul 2025
**Motivação**: Registro no Relaxy só é permitido via código de convite. O link direto "Não tem conta? Criar conta" na tela de login permitia contornar essa validação.

**Mudança**:
| Arquivo | Ação |
|---------|------|
| `src/screens/LoginScreen.tsx` | Removido `TouchableOpacity` que navegava para `Register` (linhas 94-96) |

**Resultado**:
- Tela de login contém apenas: campos email/senha, botão "Entrar", link "Esqueci minha senha"
- Cadastro acessível exclusivamente via `InviteScreen` → validação de código → `Register`
- `Import` de `useNavigation` e `RootStackParamList` permanecem pois são usados por outros links na tela

### v1.0.2 — Fix: Invalid Hook Call em MessageBubble + ChatScreen

**Data**: Jul 2025
**Motivação**: Erro "Invalid hook call" ao renderizar mensagens deletadas. Hooks chamados após `return null` condicional, violando as Rules of Hooks do React.

**Causa raiz**:
Em ambos os componentes `MessageBubble`, existe um early return `if (isDeletedForMe(item)) return null` localizado **depois** de alguns hooks mas **antes** de outros. Quando uma mensagem deletada é renderizada, o React vê número diferente de hooks entre renders → crash.

**Arquivos afetados e correção**:

| Arquivo | Fix |
|---------|-----|
| `src/components/MessageBubble.tsx` | `isDeletedForMe` early return movido para **após** todos os hooks |
| `src/screens/ChatScreen.tsx` | `isDeletedForMe` early return movido para **após** todos os hooks |

**Regra**: Todos os hooks devem ser chamados incondicionalmente, antes de qualquer `return` antecipado.

---

### v1.0.3 — Fix: Invalid Hook Call em FeedScreen (renderPost)

**Data**: Jul 2025
**Motivação**: Erro "Invalid hook call" ao renderizar o feed. A função `renderPost` (callback passado como `renderItem` ao `FlatList`) usava `useRef` e `useCallback` — mas callbacks não são componentes React, violando as Rules of Hooks.

**Causa raiz**:
`renderPost` era uma função callback dentro do componente `FeedScreen` que usava `useRef`/`useCallback`. Quando passada como `renderItem` ao `FlatList`, o React não a reconhecia como componente e os hooks falhavam.

**Fix**:
Extrair a lógica de renderização para um componente `PostItem` separado, com interface `PostItemProps`. O `FlatList` usa `renderItem={({ item }) => <PostItem item={item} ... />}`.

**Arquivo**: `src/screens/FeedScreen.tsx`

---

### v1.0.4 — Fix: Firebase Auth Persistence (sessão perdida)

**Data**: Jul 2025
**Motivação**: Usuário era deslogado ao fechar/reabrir o app. Auth não persistia entre sessões.

**Causa raiz**:
A build React Native do `@firebase/auth` (v9 compat) usa internamente `require('react-native').AsyncStorage`, que foi removido no RN 0.72+. Sem AsyncStorage disponível, o Firebase caía em persistência in-memory — sessão se perdia ao reiniciar o app.

**Fix**:
Adicionar `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` em `src/services/firebase.ts` **antes** de `firebase.auth()`. Import de `@firebase/auth/react-native` e `@react-native-async-storage/async-storage`.

**Arquivo**: `src/services/firebase.ts`

---

### v1.0.5 — Feed Features: Double-tap, Carrossel, Pinch-to-zoom, Editar, Compartilhar

**Data**: Jul 2025
**Motivação**: Feed básico sem features esperadas por usuários de apps sociais modernos.

**Features implementadas**:

| Feature | Arquivo | Descrição |
|---------|---------|-----------|
| Double-tap to like | `FeedScreen.tsx` | Gesto de dois toques → like + animação de coração |
| Carrossel de mídia | `FeedScreen.tsx` | Swipe horizontal entre `mediaUrls[]` + dots indicativos |
| Pinch-to-zoom | `MediaViewer.tsx` | Gesture-handler com `Gesture.Pinch()` + `Gesture.Pan()` |
| Editar post | `FeedScreen.tsx` | Modal de edição com TextInput preenchido |
| Compartilhar post no chat | `FeedScreen.tsx` + `MessageBubble.tsx` | Modal de seleção de chat → envio como shared post com card visual |

---

### v1.0.6 — Fix: Feed não renderiza mídia (cards vazios)

**Data**: Jul 2025
**Motivação**: Mídia de posts (imagens/vídeos) não aparece no feed — apenas o layout do card é renderizado.

**Causas raiz**:

| # | Tipo | Arquivo | Linha | Problema |
|---|------|---------|-------|----------|
| 1 | 🔴 Alta | `FeedScreen.tsx` | 296 | MIME type `p.mediaType` passado cru (`'image'`/`'video'`) em vez de `'image/jpeg'`/`'video/mp4'` — vídeos salvos com extensão `.jpg` no cache |
| 2 | 🔴 Alta | `crypto.ts` | 111 | `fetch()` falho retorna `mediaUrl` (URL criptografada) em vez de `null` — `Image` tenta renderizar blob criptografado |
| 3 | 🟡 Média | `FeedScreen.tsx` | 290 | Filtro exclui posts sem `mediaKeys`, e fallback `item.mediaUrls` pode não funcionar corretamente |

**Detalhamento**:

**Bug 1 — MIME type errado**:
No chat (`useDecryptedMedia.ts:46`), o MIME é convertido corretamente:
```ts
mediaType === 'video' ? 'video/mp4' : 'image/jpeg'
```
No feed (`FeedScreen.tsx:296`), o valor cru é passado:
```ts
decryptAndCache(url, keys[i] || null, ivs[i] || null, p.mediaType || 'image/jpeg')
// p.mediaType é 'image' ou 'video', não 'image/jpeg' ou 'video/mp4'
```
`'video'.startsWith('video/')` retorna `false` → cache com extensão `.jpg` → `expo-image` falha.

**Bug 2 — Fetch error retorna URL criptografada**:
`crypto.ts:109-112`:
```ts
if (!resp.ok) {
  return mediaUrl; // ← retorna URL do blob criptografado
}
```
O `Image` recebe a URL criptografada do Supabase, tenta decodificar como imagem → falha silenciosa → box vazio.

**Bug 3 — Exclusão de posts sem chaves**:
O filtro `(p.mediaKey || p.mediaKeys?.length)` impede que posts sem criptografia entrem no efeito de descriptografia. O fallback `item.mediaUrls` deveria funcionar para estes, mas a combinação com Bug 2 pode causar falhas.

**Plano de correção**:

| # | Arquivo | Linha | Mudança |
|---|---------|-------|---------|
| 1 | `FeedScreen.tsx` | 296 | Trocar `p.mediaType \|\| 'image/jpeg'` por `(p.mediaType === 'video' ? 'video/mp4' : 'image/jpeg')` |
| 2 | `crypto.ts` | 111 | Trocar `return mediaUrl` por `return null` |
| 3 | `FeedScreen.tsx` | 290 | Remover exigência de `mediaKeys` do filtro; processar posts com `mediaUrls` mesmo sem chaves |

**Verificação**: Postar imagem/vídeo no feed → mídia deve aparecer corretamente. Testar com e sem criptografia. Logs do `Image` não devem mostrar erros de decode.

---

### v1.0.7 — Fix: Mídia no feed não renderiza (root cause: `expo-crypto` sem `createHash`)

**Data**: Jul 2025
**Motivação**: Mídia de posts (imagens/vídeos) continuava sem aparecer no feed mesmo após o v1.0.6. Usuário vê cards sem mídia.

**Causa raiz**:
`expo-crypto` (v14) não exporta `createHash`. A função `pathHash()` em `crypto.ts` chamava `createHash('SHA256')` que retornava `undefined` → `TypeError: undefined is not a function` em todo post com mídia. Todos os `decryptAndCache` falhavam silenciosamente.

**Fix**:
| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `crypto.ts` | Substituir `createHash('SHA256')` por FNV-1a hash simples (apenas para nomes de cache, não segurança) |
| 2 | `FeedScreen.tsx` | MIME type corrigido: `(p.mediaType === 'video' ? 'video/mp4' : 'image/jpeg')` |
| 3 | `FeedScreen.tsx` | Filtro: remover exigência `mediaKeys` — processar todos os posts com `mediaUrls` |
| 4 | `crypto.ts` | `decryptAndCache` retorna `null` em vez de URL encriptografada em caso de fetch error |

**Verificação**: Mídia aparece corretamente no feed para todos os posts com e sem criptografia.

---

### v1.0.8 — Fix: MediaViewer fullscreen não fecha no toque

**Data**: Jul 2025
**Motivação**: Ao abrir imagem fullscreen no feed, tocar nela não fechava o viewer. Usuário ficava preso na tela.

**Causa raiz**:
`Gesture.Simultaneous` com `singleTap` + `doubleTap` + `pinchGesture` + `panGesture` causava conflito: o `panGesture` "engolia" o toque antes do `singleTap` conseguir resolver, mesmo com `activeOffset` e `requireExternalGestureToFail`.

**Fix**:
| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `MediaViewer.tsx` | Fechar com `Pressable` no backdrop (`onPress={onClose}`) — funciona sempre |
| 2 | `MediaViewer.tsx` | Gestures (pinch/pan/doubleTap) ficam só no `GestureDetector` da imagem |
| 3 | `MediaViewer.tsx` | Removido `glassBorder`, `singleTap`, `moved` ref — simplificação total |

**Verificação**: Tocar no fundo fecha o viewer. Double-tap faz zoom. Pinch/pan funcionam na imagem.

---

### v1.0.9 — Melhorias de UX: Skeleton, Haptics, Animações, Pressable

**Data**: Jul 2025
**Motivação**: Aplicar diretrizes da skill "UI/UX Pro Max" para elevar a qualidade perceptiva do app — substituir componentes legados, adicionar feedback tátil e visual, e melhorar empty/loading states.

**Mudanças**:

#### FeedScreen (`src/screens/FeedScreen.tsx`)
| # | Melhoria | Detalhe |
|---|-----------|---------|
| 1 | **Skeleton loading** | 3 cards placeholder com `Animated.loop` (pulse 0.4→1→0.4) substituem `ActivityIndicator` |
| 2 | **Pressable + Haptics** | Todos os botões de ação (like, comment, share, bookmark) convertidos de `TouchableOpacity` → `Pressable` com `({ pressed })` style callback |
| 3 | **Haptic feedback** | `ImpactFeedbackStyle.Light` no like/bookmark/comment; `ImpactFeedbackStyle.Medium` no share |
| 4 | **Tab indicator animado** | Underline se move com `Animated.spring` (tension: 150, friction: 12) entre Para Você / Seguindo / Favoritos |
| 5 | **Reaction picker animado** | Entra com `spring` scale 0.5→1 + fade; cada emoji entra com delay escalonado |
| 6 | **Empty states melhorados** | Ícone circular colorido (`accent + 15% opacity`) + título contextual + subtítulo + botão CTA "Criar post" no feed vazio |
| 7 | **Share modal melhorado** | Itens de chat com ícone chevron + press feedback; loading usa ícone em vez de spinner |

#### ChatsScreen (`src/screens/ChatsScreen.tsx`)
| # | Melhoria | Detalhe |
|---|-----------|---------|
| 1 | **Skeleton loading** | 5 rows placeholder com pulse animation |
| 2 | **Pressable + Haptics** | Todos os itens de chat e FAB |
| 3 | **Online indicator** | Ponto verde no avatar via `presence/{uid}` Firestore subscription |
| 4 | **Empty state melhorado** | Ícone circular + texto contextual |
| 5 | **FAB animado** | Scale `0.9` no press via style callback |

#### StoriesRow (`src/components/StoriesRow.tsx`)
| # | Melhoria | Detalhe |
|---|-----------|---------|
| 1 | **Haptic feedback** | `ImpactFeedbackStyle.Light` ao tocar em qualquer story |
| 2 | **Pressable** | Todos os toques convertidos de `TouchableOpacity` |

#### ProfileScreen (`src/screens/ProfileScreen.tsx`)
| # | Melhoria | Detalhe |
|---|-----------|---------|
| 1 | **Pressable** | Avatar, intenções, grid de posts, logout |
| 2 | **Logout melhorado** | Ícone `log-out-outline` + borda `destructive + 40% opacity` (mais sutil) + layout row com gap |

**Arquivos afetados**: `FeedScreen.tsx`, `ChatsScreen.tsx`, `StoriesRow.tsx`, `ProfileScreen.tsx`

**Pendências futuras**:
- `React.memo` em `PostItem` (performance)
- Paginação Firestore com `onEndReached`
- `react-native-reanimated` para heart animation (substituir `Animated.Value` bridge)
- `prefers-reduced-motion` check

---

### v1.1.0 — Silenciar Usuários (Mute User)

**Data**: Jul 2025
**Motivação**: Permitir que o usuário silencie其他人 no feed sem precisar bloquear — posts de usuários silenciados são ocultos do feed, mas o bloqueio total continua disponível para casos mais graves.

**Mudanças**:

#### Novo serviço: `src/services/mute.ts`
- `muteUser(currentUid, targetUid)` — adiciona `targetUid` ao array `mutedUsers` no doc do usuário
- `unmuteUser(currentUid, targetUid)` — remove do array
- `getMutedUids(uid)` — retorna lista de UIDs silenciados
- `observeMutedUids(uid, cb)` — listener em tempo real

#### FeedScreen (`src/screens/FeedScreen.tsx`)
- Escuta `observeMutedUids` e filtra posts de usuários silenciados
- Botão **•••** no header de posts de outros usuários abre menu com opção "Silenciar @username"
- Confirmação via Alert antes de mutar
- Haptic feedback ao silenciar

#### Nova tela: `src/screens/MutedUsersScreen.tsx`
- Lista de usuários silenciados com avatar + nome
- Botão "Desmutar" em cada item
- Empty state quando ninguém está silenciado

#### Navegação (`src/navigation/AppNavigator.tsx`)
- Adicionada tela `MutedUsers` ao stack

#### SettingsScreen (`src/screens/SettingsScreen.tsx`)
- Nova seção "Privacidade" com link para "Silenciados" e "Bloqueados"

**Arquivos afetados**: `mute.ts` (novo), `FeedScreen.tsx`, `MutedUsersScreen.tsx` (novo), `AppNavigator.tsx`, `SettingsScreen.tsx`

---

### v1.1.1 — Reportar Post (Moderação de Conteúdo)

**Data**: Jul 2025
**Motivação**: Permitir que usuários reportem posts inadequados (spam, assédio, violência, fake news) para moderação administrativa.

**Mudanças**:

#### Novo serviço: `src/services/report.ts`
- `reportPost(postId, postSenderId, reportedBy, reportedByName, reason, postText?, postMediaUrl?)` — cria report com proteção contra duplicatas
- `getReports()` — lista reports pendentes (admin)
- `dismissReport(reportId)` — marca como dispensado
- `deletePostAndReport(reportId, postId)` — deleta post + marca report como reviewed (batch)
- `REPORT_REASONS` — 6 opções: spam, inappropriate, harassment, misinformation, copyright, other

#### FeedScreen (`src/screens/FeedScreen.tsx`)
- Menu ••• agora inclui "Reportar post" (além de "Silenciar")
- Modal com seleção de razão (radio buttons animados)
- Haptic feedback ao selecionar razão
- Feedback de sucesso/erro

#### Nova tela: `src/screens/ReportsScreen.tsx`
- Lista de reports pendentes (admin only)
- Cada card mostra: razão, preview do texto, quem reportou
- Ações: "Deletar post" (remove post + report) ou "Dispensar"
- Verificação de admin via `isAdmin` ou `admins[]` no doc do usuário

#### Navegação (`src/navigation/AppNavigator.tsx`)
- Adicionada tela `Reports` ao stack

#### SettingsScreen (`src/screens/SettingsScreen.tsx`)
- Link "Reports" visível apenas para admins na seção Privacidade

#### Firestore Rules (`firestore.rules`)
- `reports/{reportId}` — create se `reportedBy == auth.uid`; read se autenticado; update/delete se admin

**Arquivos afetados**: `report.ts` (novo), `FeedScreen.tsx`, `ReportsScreen.tsx` (novo), `AppNavigator.tsx`, `SettingsScreen.tsx`, `firestore.rules`

---

## 27. Análise UI/UX — Feed (v1.0)

### Problemas Identificados vs Skill "UI/UX Pro Max"

| # | Severidade | Categoria | Problema Atual | Recomendação | Status |
|---|------------|-----------|----------------|--------------|--------|
| 1 | 🔴 Alta | Card Layout | Cards sem `borderRadius`, `marginBottom`, ou sombra — parecem faixas contínuas | Restaurar `borderRadius: 16`, `marginBottom: 12`, adicionar sombra sutil | ✅ v1.0.5 |
| 2 | 🔴 Alta | Loading | Apenas `ActivityIndicator` simples enquanto carrega — sem feedback visual | Implementar skeleton cards (pulse animation) para cada post | ✅ v1.0.9 |
| 3 | 🔴 Alta | Performance | `PostItem` sem `React.memo` — re-renderiza todo card a cada mudança | Envolver `PostItem` com `React.memo` (guideline `react-native` listas) | ✅ v1.0.3 |
| 4 | 🔴 Alta | Mídia | `aspectRatio: 1` força quadrado mesmo em imagens retrato/paisagem | Usar dimensões reais da imagem ou `contentFit: 'contain'` com fundo escuro | ⏳ Pendente |
| 5 | 🟡 Média | Tipografia | Fonte padrão do sistema (sem definição no tema) | Adicionar font-family explícita no theme (DM Sans / Inter) | ⏳ Pendente |
| 6 | 🟡 Média | Feed Vazio | "Nenhum post ainda" com ícone básico | Sugerir "Crie o primeiro post!" com CTA + exemplos de perfis | ✅ v1.0.9 |
| 7 | 🟡 Média | Comentários | Input inline "Comentar..." dentro do card torna o card longo e poluído | Manter comentários inline mas reduzir altura; atalho para abrir modal cheio | ⏳ Pendente |
| 8 | 🟡 Média | Like Feedback | Sem feedback tátil (haptic) ao curtir | Adicionar `ImpactFeedbackStyle.Light` via `expo-haptics` | ✅ v1.0.9 |
| 9 | 🟡 Média | OLED | `bg: #020617` (não é preto puro) — perde benefício OLED em telas AMOLED | Usar `#000000` no bg e `#121212` no surface | ⏳ Pendente |
| 10 | 🟡 Média | Interação | Action buttons sem `activeOpacity` definido — feedback visual fraco | `activeOpacity={0.6}` + escala sutil no toque | ✅ v1.0.9 |
| 11 | 🟡 Média | Post Header | Sem menu de contexto (•••) — editar/deletar só aparece no próprio post | Adicionar "mais opções" com report/mute/bookmark | ⏳ Pendente |
| 12 | 🟡 Média | Compartilhar | Usa `Alert.alert` (modal bloqueante) como feedback | Substituir por toast efêmero (`Animated.View` que desaparece) | ⏳ Pendente |
| 13 | 🟡 Média | Mídia | Sem placeholder/blurhash enquanto imagem carrega | Usar `placeholder` do `expo-image` com cor média ou blurhash | ⏳ Pendente |
| 14 | 🟢 Baixa | Video | Play overlay básico com `rgba(0,0,0,0.15)` | Overlay com gradiente + ícone maior + "Toque para ver" | ⏳ Pendente |
| 15 | 🟢 Baixa | Dots | Dots do carrossel são `absolute` e podem sobrepor conteúdo | Adicionar padding abaixo do media ou fundo semi-transparente nos dots | ⏳ Pendente |
| 16 | 🟢 Baixa | Ações | Sem bookmark/save — usuário não pode salvar post para ver depois | Adicionar botão bookmark com `BookmarkIcon` | ✅ v1.0.5 |
| 17 | 🟢 Baixa | Animações | `heartAnimation` usa `Animated.Value` (bridge JS) | Migrar para `react-native-reanimated` com `useSharedValue` | ⏳ Pendente |
| 18 | 🟢 Baixa | Paginação | FlatList carrega TODOS os posts de uma vez | Adicionar `onEndReached` com paginação Firestore | ⏳ Pendente |

### Checklist UI Pro Max Aplicado ao Feed

- [x] **Use gesture handler** — já usa `GestureDetector` (double-tap, single-tap)
- [x] **Memoize list items** — `PostItem` é componente separado (extrair de `renderPost`)
- [x] **Skeleton loading** — 3 skeleton cards com pulse animation no feed
- [x] **Haptic feedback** — `expo-haptics` no like, bookmark, comment, share, reaction, tab switch, story tap
- [x] **Reserve space for media** — `aspectRatio` OK
- [x] **Touch targets > 8px gap** — `gap: 16` OK entre ações
- [x] **Pressable over TouchableOpacity** — Feed, Chats, Stories, Profile todos convertidos
- [x] **No emojis as icons** — já usa `Ionicons` (OK)
- [x] **Cores com contraste 4.5:1+** — `#f1f5f9` em `#0f172a` = 12.5:1 (✓)
- [x] **Cursor pointer** — N/A (React Native)
- [x] **Empty states with CTA** — feed vazio mostra CTA "Criar post"
- [x] **Animated transitions** — tab indicator spring, reaction picker scale+fade
- [ ] **Focus states visible** — verificar acessibilidade
- [ ] **prefers-reduced-motion** — não verificado

### Plano de Implementação

| Fase | Items | Esforço |
|------|-------|---------|
| **P0 — Imediato** | ① Card layout (borderRadius, margin) + ③ React.memo | 1h |
| **P1 — Alta** | ② Skeleton loading + ④ Aspect ratio dinâmico + ⑧ Haptic + ⑩ activeOpacity | 2-3h |
| **P2 — Média** | ⑤ Font theme + ⑫ Toast feedback + ⑬ Placeholder mídia + ⑯ Bookmark | 3-4h |
| **P3 — Baixa** | ⑥ Empty state CTA + ⑪ Menu contexto + ⑭ Video overlay + ⑮ Dots + ⑰ Reanimated + ⑱ Paginação | 5-8h |