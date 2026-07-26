declare module 'lottie-react-native' {
  import { ComponentProps, ComponentType } from 'react';
  import { ViewProps, StyleProp, ViewStyle } from 'react-native';

  interface LottieViewProps extends ViewProps {
    source: { uri: string } | string | number;
    style?: StyleProp<ViewStyle>;
    autoPlay?: boolean;
    loop?: boolean;
    resizeMode?: 'contain' | 'cover' | 'center';
    speed?: number;
    onAnimationFinish?: (isCancelled: boolean) => void;
    onError?: (error: any) => void;
  }

  const LottieView: ComponentType<LottieViewProps>;
  export default LottieView;
}
