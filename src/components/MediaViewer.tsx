import { Modal, TouchableOpacity, Image, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

export default function MediaViewer({ visible, uri, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        {uri && (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        )}
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
