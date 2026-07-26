import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarImage from './AvatarImage';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

interface MentionItem {
  uid: string;
  name: string;
  photoURL?: string | null;
  isNew?: boolean;
}

interface MentionOverlayProps {
  visible: boolean;
  results: MentionItem[];
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
}

export default function MentionOverlay({ visible, results, onSelect, onClose }: MentionOverlayProps) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const s = getStyles(c);

  if (!visible || results.length === 0) return null;

  return (
    <View style={s.overlay}>
      <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={s.container}>
        <View style={s.handle} />
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => onSelect(item)} activeOpacity={0.6}>
              <AvatarImage photoURL={item.photoURL} name={item.name || '?'} size={36} />
              <View style={s.nameWrap}>
                <Text style={s.name} numberOfLines={1}>@{item.name}</Text>
                {item.isNew && (
                  <View style={s.addBadge}>
                    <Ionicons name="add-circle-outline" size={14} color={c.accent} />
                    <Text style={s.addBadgeText}>Adicionar ao grupo</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    backdrop: {
      flex: 1,
    },
    container: {
      maxHeight: 220,
      backgroundColor: c.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderColor: c.glassBorder,
      paddingBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.textMuted,
      alignSelf: 'center',
      marginVertical: 8,
      opacity: 0.4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    nameWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    name: {
      color: c.text,
      fontSize: 15,
      fontWeight: '500',
    },
    addBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(167,139,250,0.12)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    addBadgeText: {
      color: c.accent,
      fontSize: 12,
      fontWeight: '500',
    },
  });
}
