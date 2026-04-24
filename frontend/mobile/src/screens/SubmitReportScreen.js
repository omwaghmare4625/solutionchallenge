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
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { submitOrQueueReport, syncPendingReports } from '../services/reportService';

const CATEGORIES = [
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'food', label: 'Food' },
  { key: 'shelter', label: 'Shelter' },
];

const SEVERITY_COLORS = ['#34D399', '#84CC16', '#FACC15', '#F97316', '#EF4444'];

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
  const [populationAffected, setPopulationAffected] = useState('0');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const locationLabel = useMemo(() => {
    if (lat === null || lng === null) {
      return 'No location selected';
    }

    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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
    setPopulationAffected('0');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Submit Report</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Location</Text>
        <TouchableOpacity style={styles.actionButton} onPress={requestAndSetLocation}>
          <Text style={styles.actionButtonText}>Use Current Location</Text>
        </TouchableOpacity>
        <Text style={styles.helperText}>{locationLabel}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.grid}>
          {CATEGORIES.map((item) => {
            const selected = category === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.gridItem, selected && styles.gridItemSelected]}
                onPress={() => setCategory(item.key)}
              >
                <Text style={[styles.gridItemText, selected && styles.gridItemTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Severity</Text>
        <View style={styles.severityRow}>
          {SEVERITY_COLORS.map((color, index) => {
            const value = index + 1;
            const selected = severity === value;
            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.severityCircle,
                  { backgroundColor: color },
                  selected && styles.severityCircleSelected,
                ]}
                onPress={() => setSeverity(value)}
              >
                <Text style={styles.severityText}>{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Population Affected</Text>
        <TextInput
          style={styles.input}
          value={populationAffected}
          onChangeText={setPopulationAffected}
          keyboardType="numeric"
          placeholder="0"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholder="Add details"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Photo</Text>
        <View style={styles.photoActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={pickFromCamera}>
            <Text style={styles.secondaryButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={pickFromGallery}>
            <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
        {image?.uri ? <Image source={{ uri: image.uri }} style={styles.preview} /> : null}
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Submit</Text>}
      </TouchableOpacity>

      {syncing ? <Text style={styles.syncText}>Syncing pending reports...</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    color: '#0F172A',
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  helperText: {
    marginTop: 8,
    color: '#475569',
  },
  actionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  gridItemSelected: {
    backgroundColor: '#1D4ED8',
  },
  gridItemText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  gridItemTextSelected: {
    color: '#FFFFFF',
  },
  severityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  severityCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityCircleSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  severityText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  preview: {
    marginTop: 10,
    width: '100%',
    height: 180,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  submitButton: {
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  syncText: {
    marginTop: 10,
    color: '#334155',
    textAlign: 'center',
  },
});
