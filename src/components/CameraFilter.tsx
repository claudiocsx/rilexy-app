import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraFilter as FilterType } from '../data/cameraFilters';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  filter: FilterType;
}

export default function CameraFilter({ filter }: Props) {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[styles.overlay, { backgroundColor: filter.overlayColor, opacity: filter.overlayOpacity }]} />
      {filter.vignette && (
        <LinearGradient
          colors={['transparent', `rgba(0,0,0,${filter.vignetteOpacity})`]}
          locations={[0.6, 1]}
          style={styles.vignette}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  vignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.5,
  },
});
