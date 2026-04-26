import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
  Image,
  SafeAreaView,
  StatusBar
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  CloudOff,
  MapPin,
  HeartPulse,
  HardHat,
  Apple,
  Home,
  Camera,
  X,
} from 'lucide-react-native';

import { submitOrQueueReport, syncPendingReports } from '../services/reportService';

const CATEGORIES = [
  { key: 'healthcare', label: 'Healthcare', Icon: HeartPulse },
  { key: 'infrastructure', label: 'Infrastructure', Icon: HardHat },
  { key: 'food', label: 'Food', Icon: Apple },
  { key: 'shelter', label: 'Shelter', Icon: Home },
];

const SEVERITY_COLORS = ['#22c55e', '#4ade80', '#eab308', '#f97316', '#ef4444'];

const showToast = (message) => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('', message);
};

export default function SubmitReportScreen({ route }) {
  const token = route?.params?.token || '';

  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState(3);
  const [populationAffected, setPopulationAffected] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const locationLabel = useMemo(() => {
    if (lat === null || lng === null) {
      return '';
    }
    return `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
  }, [lat, lng]);

  const requestAndSetLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showToast('Location permission denied');
      return;
    }

    const position = await Location.getCurrentPositionAsync({});
    setLat(position.coords.latitude);
    setLng(position.coords.longitude);
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Camera permission denied');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg',
      });
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Gallery permission denied');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || 'photo.jpg',
      });
    }
  };

  const resetForm = () => {
    setCategory('');
    setSeverity(3);
    setPopulationAffected('');
    setDescription('');
    setImage(null);
  };

  const handleSubmit = async () => {
    if (lat === null || lng === null) {
      showToast('Please set location');
      return;
    }
    if (!category) {
      showToast('Please select category');
      return;
    }
    if (!token) {
      showToast('Missing auth token');
      return;
    }

    const payload = {
      lat,
      lng,
      category_key: category,
      severity,
      population_affected: Number(populationAffected || 0),
      description: description.trim(),
      photo: image,
    };

    setLoading(true);
    try {
      const result = await submitOrQueueReport({ payload, token });
      if (result.mode === 'online') {
        showToast('Report submitted');
      } else {
        showToast('Saved offline — will sync');
      }
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const runPendingSync = useCallback(async () => {
    if (!token) return;

    setSyncing(true);
    try {
      const result = await syncPendingReports({ token });
      if (result.syncedCount > 0) {
        showToast(`Synced ${result.syncedCount} pending report(s)`);
      }
    } finally {
      setSyncing(false);
    }
  }, [token]);

  useEffect(() => {
    runPendingSync();
  }, [runPendingSync]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runPendingSync();
      }
    });
    return () => sub.remove();
  }, [runPendingSync]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />
      
      {/* 1. Top Navigation & Status Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Submit Report</Text>
      </View>

      {/* Offline Banner */}
      <View style={styles.offlineBanner}>
        <CloudOff size={20} color="#f59e0b" />
        <Text style={styles.offlineText}>
          Working Offline. Reports will sync automatically.
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        
        {/* Location Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={requestAndSetLocation}
            activeOpacity={0.8}
          >
            <MapPin size={20} color="#ffffff" />
            <Text style={styles.locationButtonText}>Use Current GPS Location</Text>
          </TouchableOpacity>
          {locationLabel ? (
            <Text style={styles.locationLabel}>{locationLabel}</Text>
          ) : null}
        </View>

        {/* Category Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CATEGORY</Text>
          <View style={styles.grid}>
            {CATEGORIES.map((item) => {
              const isSelected = category === item.key;
              const IconComp = item.Icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.gridItem,
                    isSelected ? styles.gridItemSelected : styles.gridItemUnselected,
                  ]}
                  onPress={() => setCategory(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconWrapper, isSelected && styles.iconWrapperSelected]}>
                    <IconComp size={24} color={isSelected ? '#ffffff' : '#94a3b8'} />
                  </View>
                  <Text
                    style={[
                      styles.gridItemText,
                      isSelected ? styles.gridItemTextSelected : styles.gridItemTextUnselected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Severity Scale */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>URGENCY LEVEL</Text>
          <View style={styles.severityRow}>
            {SEVERITY_COLORS.map((color, index) => {
              const value = index + 1;
              const isSelected = severity === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.severityCircle,
                    { borderColor: color },
                    isSelected
                      ? {
                          backgroundColor: color,
                          shadowColor: color,
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.6,
                          shadowRadius: 8,
                          elevation: 6,
                          transform: [{ scale: 1.15 }],
                        }
                      : { backgroundColor: 'transparent' },
                  ]}
                  onPress={() => setSeverity(value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.severityText,
                      { color: isSelected ? '#020617' : color },
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>POPULATION AFFECTED</Text>
          <TextInput
            style={styles.input}
            value={populationAffected}
            onChangeText={setPopulationAffected}
            keyboardType="numeric"
            placeholder="e.g., 50"
            placeholderTextColor="#475569"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            placeholder="Add specific details about the situation..."
            placeholderTextColor="#475569"
            textAlignVertical="top"
          />
        </View>

        {/* Photo Capture */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHOTO</Text>
          {image?.uri ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setImage(null)}
              >
                <X size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoDropzone}
              onPress={() => {
                Alert.alert(
                  'Upload Photo',
                  'Choose an option',
                  [
                    { text: 'Camera', onPress: pickFromCamera },
                    { text: 'Gallery', onPress: pickFromGallery },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <View style={styles.cameraIconContainer}>
                <Camera size={28} color="#6366f1" />
              </View>
              <Text style={styles.photoDropzoneText}>
                Tap to attach a photo
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {syncing ? <Text style={styles.syncText}>Syncing pending reports...</Text> : null}
      </ScrollView>

      {/* 3. Action Area / Floating Sticky Footer */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617', // bg-slate-950
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  offlineBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
  },
  offlineText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 120, // Extra room for floating footer
  },
  section: {
    marginBottom: 28,
  },
  locationButton: {
    height: 52,
    backgroundColor: 'rgba(79, 70, 229, 0.15)', // Light indigo tint
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.5)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  locationButtonText: {
    color: '#818cf8',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  locationLabel: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridItem: {
    width: '48%',
    height: 100,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
  },
  gridItemUnselected: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
  },
  gridItemSelected: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridItemText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gridItemTextUnselected: {
    color: '#94a3b8',
  },
  gridItemTextSelected: {
    color: '#ffffff',
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  severityCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityText: {
    fontWeight: '800',
    fontSize: 18,
  },
  input: {
    height: 54,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '500',
  },
  multilineInput: {
    height: 120,
    paddingTop: 16,
  },
  photoContainer: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  photoDropzone: {
    height: 140,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1e293b',
    borderStyle: 'dashed',
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  cameraIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDropzoneText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 14,
  },
  syncText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
  },
  submitButton: {
    height: 60,
    backgroundColor: '#10b981', // emerald-500
    borderRadius: 30, // fully rounded pill
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  submitButtonText: {
    color: '#020617', // dark text on bright green looks premium
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
