import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';

interface Props {
  photoURL?: string | null;
  name: string;
  size?: number;
}

export default function AvatarImage({ photoURL, name, size = 48 }: Props) {
  const initial = (name || '?')[0].toUpperCase();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {photoURL ? (
        <Image
          source={photoURL}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.45 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.accentDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  text: {
    color: colors.text,
    fontWeight: 'bold',
  },
});
