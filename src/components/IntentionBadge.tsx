import { View, Text, ViewStyle } from 'react-native';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';
import { INTENTIONS, IntentionType } from '../constants/intentions';

interface Props {
  type: string | null | undefined;
  size?: number;
  style?: ViewStyle;
}

export default function IntentionBadge({ type, size = 22, style }: Props) {
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  if (!type || !(type in INTENTIONS)) return null;
  const intention = INTENTIONS[type as IntentionType];

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: intention.color,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: c.bg,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.55 }}>
        {intention.emoji}
      </Text>
    </View>
  );
}
