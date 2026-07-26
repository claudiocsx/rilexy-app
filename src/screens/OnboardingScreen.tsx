import { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../theme/colors';
import { useSettingsStore } from '../store/settingsStore';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

const slides = [
  {
    title: 'Bem-vindo ao Relaxy',
    description: 'Sua rede social privada. Conecte-se com quem realmente importa, sem distrações.',
  },
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Mensagens Privadas',
    description: 'Conversas com criptografia de ponta a ponta. Apenas você e a pessoa com quem está falando podem ler.',
  },
  {
    icon: 'videocam-outline' as const,
    title: 'Chamadas de Vídeo',
    description: 'Chamadas P2P seguras e privadas. Sua comunicação, seus dados, seu controle.',
  },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const theme = useSettingsStore((s) => s.theme);
  const c = getColors(theme);
  const styles = useMemo(() => getStyles(c), [c]);

  const isLastSlide = currentIndex === slides.length - 1;

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      scrollRef.current?.scrollTo({ x: width * (currentIndex + 1), animated: true });
    }
  };

  const handleSkip = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      scrollRef.current?.scrollTo({ x: width * (slides.length - 1), animated: true });
      setCurrentIndex(slides.length - 1);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Pular</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {slides.map((slide, index) => (
          <View key={index} style={styles.slide}>
            <View style={styles.iconWrap}>
              {index === 0 ? (
                <View style={styles.logoCircle}>
                  <Text style={styles.logoText}>♀♂</Text>
                </View>
              ) : (
                <Ionicons name={slide.icon!} size={80} color={c.accent} />
              )}
            </View>

            <Text style={styles.title}>
              {slide.title}
            </Text>

            <Text style={styles.description}>
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLastSlide ? 'Começar' : 'Próximo'}
          </Text>
          <Ionicons
            name={isLastSlide ? 'checkmark-circle-outline' : 'arrow-forward-outline'}
            size={20}
            color={c.bg}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(c: ReturnType<typeof getColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    skipButton: {
      position: 'absolute',
      top: 60,
      right: 24,
      zIndex: 10,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    skipText: {
      color: c.textMuted,
      fontSize: 16,
      fontWeight: '500',
    },
    slide: {
      width,
      height: SCREEN_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    iconWrap: {
      marginBottom: 48,
      alignItems: 'center',
      justifyContent: 'center',
      width: 120,
      height: 120,
    },
    logoCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 3,
      borderColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: c.accent,
      fontSize: 36,
      fontWeight: 'bold',
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: c.text,
      textAlign: 'center',
      marginBottom: 16,
    },
    description: {
      fontSize: 16,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: 8,
    },
    footer: {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    dotsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dotActive: {
      backgroundColor: c.accent,
      width: 24,
      borderRadius: 4,
    },
    dotInactive: {
      backgroundColor: c.textMuted,
      opacity: 0.3,
    },
    nextButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.accent,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    nextButtonText: {
      color: c.bg,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
}
