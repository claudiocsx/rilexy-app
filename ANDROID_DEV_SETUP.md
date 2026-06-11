# Setup Android Dev-Client (Relaxy)

## Pré-requisitos (5 minutos)

### 1. JDK 17 (obrigatório)
Abra **PowerShell como Administrador** e execute:
```powershell
winget install "Eclipse Adoptium Temurin.17.JDK"
```
Feche e reabra o PowerShell.

### 2. Android Studio + SDK
Abra **PowerShell como Administrador**:
```powershell
winget install "Google.AndroidStudio"
```
Após instalar, abra o Android Studio → clique **More Actions** → **SDK Manager**:

1. Aba **SDK Platforms** → marque **Android 14.0 ("UpsideDownCake")** → Apply
2. Aba **SDK Tools** → marque **Android SDK Platform-Tools** → Apply

### 3. Variáveis de Ambiente
Abra **PowerShell como Administrador**:
```powershell
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
[Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "$env:LOCALAPPDATA\Android\Sdk", "User")
```
Feche e reabra o PowerShell. Verifique:
```powershell
echo $env:ANDROID_HOME
```

### 4. Conectar Celular
- Ative **Modo Desenvolvedor** (Settings → Sobre → toque 7x em "Número da build")
- Ative **Debug USB** (Settings → Opções do Desenvolvedor)
- Conecte via cabo USB
- Aceite a impressão digital no celular

Verifique:
```powershell
adb devices
```
Deve mostrar `XXXXXXXXX device`.

---

## Build do Dev-Client (5-15 minutos)

```powershell
cd C:\Users\Ana Claudia\Documents\Rilaxy\Rilaxy
npx expo prebuild --clean
npx expo run:android
```

O Expo vai compilar o app com `react-native-webrtc` e instalar direto no celular.

## Testar Chamada
- Abra o app (ícone roxo, NÃO o Expo Go)
- Entre em um chat → ícones de telefone/câmera no header
- Lembre-se: o **outro celular** também precisa estar rodando o mesmo build (ou um também com dev-client)
