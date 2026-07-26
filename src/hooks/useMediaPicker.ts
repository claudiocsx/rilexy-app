import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

interface MediaResult {
  uri: string;
  type: 'image' | 'video';
}

export function useMediaPicker() {
  const [loading, setLoading] = useState(false);

  const requestPermission = async (mediaType: 'camera' | 'gallery') => {
    if (mediaType === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Acesse Configurações para permitir o uso da câmera');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Acesse Configurações para permitir o acesso à galeria');
        return false;
      }
    }
    return true;
  };

  const pickFromGallery = async (): Promise<MediaResult | null> => {
    const hasPermission = await requestPermission('gallery');
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.7,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
        };
      }
      return null;
    } catch (e: any) {
      console.error('pickFromGallery error:', e?.message || e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async (): Promise<MediaResult | null> => {
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          type: 'image',
        };
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const recordVideo = async (): Promise<MediaResult | null> => {
    const hasPermission = await requestPermission('camera');
    if (!hasPermission) return null;

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 60,
        quality: 0.7,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          type: 'video',
        };
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const pickMultipleFromGallery = async (): Promise<MediaResult[]> => {
    const hasPermission = await requestPermission('gallery');
    if (!hasPermission) return [];

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.7,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        return result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
        }));
      }
      return [];
    } catch (e: any) {
      console.error('pickMultipleFromGallery error:', e?.message || e);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { pickFromGallery, pickMultipleFromGallery, takePhoto, recordVideo, loading };
}
