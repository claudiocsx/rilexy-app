import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, TextInput, Modal, Dimensions, Alert, StatusBar, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMAGE_MAX_H = SCREEN_H - 220;
const COLORS = ['#ffffff', '#ff4444', '#ff8800', '#ffdd00', '#44cc44', '#4488ff', '#cc44ff', '#000000'];
const BRUSH_SIZES = [3, 5, 8, 12];

interface CropRect {
  x: number; y: number; w: number; h: number;
}

interface DrawPath {
  id: string; points: { x: number; y: number }[]; color: string; width: number;
}

interface TextEl {
  id: string; x: number; y: number; text: string; color: string; fontSize: number;
}

type EditRoute = RouteProp<RootStackParamList, 'EditImage'>;

export default function EditImageScreen() {
  const route = useRoute<EditRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const { imageUri, chatId, name: peerName } = route.params;

  const [imgUri, setImgUri] = useState(imageUri);
  const [imgSize, setImgSize] = useState({ w: SCREEN_W, h: SCREEN_W });
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [cropRatio, setCropRatio] = useState<string | null>(null);
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const [currentDrawPath, setCurrentDrawPath] = useState<{ x: number; y: number }[]>([]);
  const [drawColor, setDrawColor] = useState('#ff4444');
  const [brushSize, setBrushSize] = useState(5);
  const [textElements, setTextElements] = useState<TextEl[]>([]);
  const [textModalVisible, setTextModalVisible] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(24);
  const [processing, setProcessing] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const imageRef = useRef<View>(null);
  const viewRef = useRef<View>(null);

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const cropStartRef = useRef(cropStart);
  cropStartRef.current = cropStart;
  const currentDrawPathRef = useRef(currentDrawPath);
  currentDrawPathRef.current = currentDrawPath;
  const drawColorRef = useRef(drawColor);
  drawColorRef.current = drawColor;
  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;

  useEffect(() => {
    Image.getSize(
      imageUri,
      (w, h) => {
        const ratio = w / h;
        let displayW = SCREEN_W - 32;
        let displayH = displayW / ratio;
        if (displayH > IMAGE_MAX_H) { displayH = IMAGE_MAX_H; displayW = displayH * ratio; }
        setImgSize({ w: displayW, h: displayH });
      },
      () => {}
    );
  }, [imageUri]);

  const getTransformStyle = useCallback(() => {
    const transforms: any[] = [];
    if (flipH) transforms.push({ scaleX: -1 });
    if (flipV) transforms.push({ scaleY: -1 });
    if (rotation !== 0) transforms.push({ rotate: `${rotation}deg` });
    return transforms.length > 0 ? { transform: transforms } : {};
  }, [flipH, flipV, rotation]);

  const imgDisplayStyle = {
    width: imgSize.w,
    height: imgSize.h,
    ...getTransformStyle(),
  };

  const handleCropRatio = (ratio: string | null) => {
    setCropRatio(ratio);
    setCropRect(null);
    setCropStart(null);
  };

  const getCropFromRatio = (): CropRect | null => {
    if (!cropRatio || cropRatio === 'free') return cropRect;
    const [rw, rh] = cropRatio.split(':').map(Number);
    const iw = imgSize.w;
    const ih = imgSize.h;
    const imgAspect = iw / ih;
    const cropAspect = rw / rh;
    let cw: number, ch: number;
    if (cropAspect > imgAspect) {
      cw = iw;
      ch = iw / cropAspect;
    } else {
      ch = ih;
      cw = ih * cropAspect;
    }
    return { x: (iw - cw) / 2, y: (ih - ch) / 2, w: cw, h: ch };
  };

  const getImageSize = (uri: string): Promise<[number, number]> => {
    return new Promise((resolve, reject) => {
      Image.getSize(uri, (w, h) => resolve([w, h]), (err) => reject(err));
    });
  };

  const applyImageOps = async () => {
    const actions: any[] = [];
    if (flipH) actions.push({ flip: 'horizontal' });
    if (flipV) actions.push({ flip: 'vertical' });
    if (rotation !== 0) actions.push({ rotate: rotation });
    const cropData = getCropFromRatio();
    if (cropData && cropData.w > 10 && cropData.h > 10) {
      const [origW, origH] = await getImageSize(imageUri);
      const scaleX = origW / imgSize.w;
      const scaleY = origH / imgSize.h;
      actions.push({
        crop: {
          originX: Math.round(cropData.x * scaleX),
          originY: Math.round(cropData.y * scaleY),
          width: Math.round(cropData.w * scaleX),
          height: Math.round(cropData.h * scaleY),
        },
      });
    }
    if (actions.length === 0) return imageUri;
    const result = await manipulateAsync(imageUri, actions, { format: SaveFormat.PNG, compress: 0.9 });
    return result.uri;
  };

  const handleSend = async () => {
    setProcessing(true);
    try {
      let finalUri = await applyImageOps();
      const hasOverlays = drawPaths.length > 0 || textElements.length > 0;
      if (hasOverlays && viewRef.current) {
        const updatedImage = await Image.resolveAssetSource({ uri: finalUri });
        const shot = await captureRef(viewRef.current, {
          format: 'png',
          quality: 0.9,
        });
        finalUri = shot;
      }
      navigation.navigate('Chat', { chatId, name: peerName, editedImageUri: finalUri } as any);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha ao processar imagem');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => activeToolRef.current === 'crop' || activeToolRef.current === 'draw',
      onMoveShouldSetPanResponder: () => activeToolRef.current === 'crop' || activeToolRef.current === 'draw',
      onPanResponderGrant: (evt) => {
        if (activeToolRef.current === 'crop') {
          const { locationX, locationY } = evt.nativeEvent;
          setCropStart({ x: locationX, y: locationY });
          setCropRect(null);
        } else if (activeToolRef.current === 'draw') {
          setCurrentDrawPath([{ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }]);
        }
      },
      onPanResponderMove: (evt) => {
        if (activeToolRef.current === 'crop' && cropStartRef.current) {
          const { locationX, locationY } = evt.nativeEvent;
          const nx = Math.min(locationX, cropStartRef.current.x);
          const ny = Math.min(locationY, cropStartRef.current.y);
          const nw = Math.abs(locationX - cropStartRef.current.x);
          const nh = Math.abs(locationY - cropStartRef.current.y);
          setCropRect({ x: nx, y: ny, w: nw, h: nh });
        } else if (activeToolRef.current === 'draw') {
          setCurrentDrawPath((prev) => [...prev, { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }]);
        }
      },
      onPanResponderRelease: () => {
        if (activeToolRef.current === 'crop') {
          setCropStart(null);
        } else if (activeToolRef.current === 'draw' && currentDrawPathRef.current.length > 1) {
          setDrawPaths((prev) => [...prev, {
            id: Date.now().toString(),
            points: currentDrawPathRef.current,
            color: drawColorRef.current,
            width: brushSizeRef.current,
          }]);
          setCurrentDrawPath([]);
        } else {
          setCurrentDrawPath([]);
        }
      },
    })
  ).current;

  const undoLastDraw = () => {
    setDrawPaths((prev) => prev.slice(0, -1));
  };

  const handleAddText = () => {
    setTextModalVisible(true);
    setCurrentText('');
  };

  const confirmText = () => {
    if (!currentText.trim()) { setTextModalVisible(false); return; }
    const x = imgSize.w / 2 - 40;
    const y = imgSize.h / 2 - 10;
    setTextElements((prev) => [...prev, {
      id: Date.now().toString(),
      x, y, text: currentText.trim(),
      color: textColor,
      fontSize: textSize,
    }]);
    setTextModalVisible(false);
  };

  const getTransformForSave = useCallback(() => {
    const transforms: any[] = [];
    if (flipH) transforms.push({ scaleX: -1 });
    if (flipV) transforms.push({ scaleY: -1 });
    if (rotation !== 0) transforms.push({ rotate: `${rotation}deg` });
    return transforms;
  }, [flipH, flipV, rotation]);

  const renderCropOverlay = () => {
    const rect = cropRect || getCropFromRatio();
    if (!rect || rect.w < 5 || rect.h < 5) return null;
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderWidth: 2, borderColor: '#fff', borderStyle: 'dashed' }} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleCancel} style={styles.topBarBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Editar</Text>
        <TouchableOpacity onPress={handleSend} disabled={processing} style={[styles.topBarBtn, styles.sendBtn]}>
          {processing ? (
            <Text style={styles.sendText}>... </Text>
          ) : (
            <Ionicons name="checkmark" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.imageArea} ref={viewRef} collapsable={false}>
        <View ref={imageRef} style={[styles.imageWrap, { width: imgSize.w, height: imgSize.h }]} {...panResponder.panHandlers}>
          <Svg width={imgSize.w} height={imgSize.h} style={StyleSheet.absoluteFill} pointerEvents="none">
            {drawPaths.map((p) => {
              if (p.points.length < 2) return null;
              const d = p.points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ');
              return (
                <Path
                  key={p.id}
                  d={d}
                  stroke={p.color}
                  strokeWidth={p.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}
            {currentDrawPath.length > 1 && (
              <Path
                d={currentDrawPath.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ')}
                stroke={drawColor}
                strokeWidth={brushSize}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {textElements.map((t) => (
              <SvgText
                key={t.id}
                x={t.x}
                y={t.y}
                fill={t.color}
                fontSize={t.fontSize}
                fontWeight="bold"
              >
                {t.text}
              </SvgText>
            ))}
          </Svg>
          <Image source={{ uri: imgUri }} style={[styles.image, imgDisplayStyle]} resizeMode="contain" />
          {activeTool === 'crop' && renderCropOverlay()}
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.toolRow}>
          {[
            { key: 'crop', icon: 'crop-outline', label: 'Cortar' },
            { key: 'rotate', icon: 'refresh-outline', label: 'Girar' },
            { key: 'flip', icon: 'swap-horizontal-outline', label: 'Espelhar' },
            { key: 'draw', icon: 'brush-outline', label: 'Desenhar' },
            { key: 'text', icon: 'text-outline', label: 'Texto' },
          ].map((tool) => (
            <TouchableOpacity
              key={tool.key}
              style={[styles.toolBtn, activeTool === tool.key && styles.toolBtnActive]}
              onPress={() => {
                if (tool.key === 'text') { handleAddText(); return; }
                setActiveTool(activeTool === tool.key ? null : tool.key);
              }}
            >
              <Ionicons name={tool.icon as any} size={22} color={activeTool === tool.key ? '#a78bfa' : '#999'} />
              <Text style={[styles.toolLabel, activeTool === tool.key && styles.toolLabelActive]}>{tool.label}</Text>
            </TouchableOpacity>
          ))}
          {activeTool === 'draw' && drawPaths.length > 0 && (
            <TouchableOpacity style={styles.toolBtn} onPress={undoLastDraw}>
              <Ionicons name="arrow-undo" size={22} color="#999" />
              <Text style={styles.toolLabel}>Desfazer</Text>
            </TouchableOpacity>
          )}
        </View>

        {activeTool === 'crop' && (
          <View style={styles.toolOptions}>
            {[
              { key: null, label: 'Livre' },
              { key: '1:1', label: '1:1' },
              { key: '3:4', label: '3:4' },
              { key: '4:3', label: '4:3' },
              { key: '9:16', label: '9:16' },
              { key: '16:9', label: '16:9' },
            ].map((r) => (
              <TouchableOpacity
                key={r.key || 'free'}
                style={[styles.ratioBtn, cropRatio === r.key && styles.ratioBtnActive]}
                onPress={() => handleCropRatio(r.key)}
              >
                <Text style={[styles.ratioText, cropRatio === r.key && styles.ratioTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTool === 'rotate' && (
          <View style={styles.toolOptions}>
            <TouchableOpacity style={styles.rotateBtn} onPress={() => setRotation((r) => ((r - 90) % 360 + 360) % 360)}>
              <Ionicons name="refresh-outline" size={20} color="#fff" />
              <Text style={styles.rotateText}>90°</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rotateBtn} onPress={() => setRotation((r) => (r + 90) % 360)}>
              <Ionicons name="refresh-outline" size={20} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.rotateText}>90°</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTool === 'flip' && (
          <View style={styles.toolOptions}>
            <TouchableOpacity style={[styles.flipBtn, flipH && styles.flipBtnActive]} onPress={() => setFlipH((v) => !v)}>
              <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
              <Text style={styles.flipText}>H</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.flipBtn, flipV && styles.flipBtnActive]} onPress={() => setFlipV((v) => !v)}>
              <Ionicons name="swap-vertical-outline" size={20} color="#fff" />
              <Text style={styles.flipText}>V</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTool === 'draw' && (
          <View style={styles.toolOptions}>
            <View style={styles.colorRow}>
              {COLORS.map((clr) => (
                <TouchableOpacity
                  key={clr}
                  style={[styles.colorDot, { backgroundColor: clr }, drawColor === clr && styles.colorDotActive]}
                  onPress={() => setDrawColor(clr)}
                />
              ))}
            </View>
            <View style={styles.brushRow}>
              {BRUSH_SIZES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.brushBtn, brushSize === s && styles.brushBtnActive]}
                  onPress={() => setBrushSize(s)}
                >
                  <View style={{ width: s * 2, height: s * 2, borderRadius: s, backgroundColor: drawColor }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      <Modal visible={textModalVisible} transparent animationType="fade" onRequestClose={() => setTextModalVisible(false)}>
        <View style={styles.textModalOverlay}>
          <View style={[styles.textModalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.textModalTitle, { color: c.text }]}>Adicionar texto</Text>
            <TextInput
              style={[styles.textModalInput, { color: c.text, backgroundColor: c.elevated, borderColor: c.borderLight }]}
              placeholder="Digite o texto..."
              placeholderTextColor={c.textMuted}
              value={currentText}
              onChangeText={setCurrentText}
              autoFocus
            />
            <View style={styles.textModalColors}>
              {COLORS.map((clr) => (
                <TouchableOpacity
                  key={clr}
                  style={[styles.colorDot, { backgroundColor: clr }, textColor === clr && styles.colorDotActive]}
                  onPress={() => setTextColor(clr)}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {[18, 24, 32, 40].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.textSizeBtn, textSize === s && styles.ratioBtnActive]}
                  onPress={() => setTextSize(s)}
                >
                  <Text style={[styles.textSizeLabel, { color: c.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.textModalActions}>
              <TouchableOpacity onPress={() => setTextModalVisible(false)} style={styles.textModalCancel}>
                <Text style={{ color: c.textMuted }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmText} style={[styles.textModalConfirm, { backgroundColor: c.accent }]}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
  },
  topBarBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  sendBtn: { backgroundColor: 'rgba(167,139,250,0.3)' },
  sendText: { color: '#a78bfa', fontSize: 16, fontWeight: 'bold' },
  imageArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageWrap: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  image: { position: 'absolute' },
  bottomPanel: {
    paddingHorizontal: 12, paddingBottom: 32, paddingTop: 8,
  },
  toolRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  toolBtn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  toolBtnActive: { backgroundColor: 'rgba(167,139,250,0.15)' },
  toolLabel: { color: '#999', fontSize: 11, marginTop: 2 },
  toolLabelActive: { color: '#a78bfa' },
  toolOptions: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#222',
  },
  ratioBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#222',
  },
  ratioBtnActive: { backgroundColor: '#a78bfa' },
  ratioText: { color: '#999', fontSize: 13 },
  ratioTextActive: { color: '#fff' },
  rotateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#222',
  },
  rotateText: { color: '#fff', fontSize: 13 },
  flipBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: '#222',
  },
  flipBtnActive: { backgroundColor: '#a78bfa' },
  flipText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff' },
  brushRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  brushBtn: { padding: 6, borderRadius: 8 },
  brushBtnActive: { backgroundColor: 'rgba(167,139,250,0.3)' },
  textModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  textModalCard: { width: '100%', borderRadius: 16, padding: 20 },
  textModalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  textModalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, marginBottom: 12 },
  textModalColors: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  textSizeBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: '#222' },
  textSizeLabel: { fontSize: 13 },
  textModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  textModalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  textModalConfirm: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
});
