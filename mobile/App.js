import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';

import LandingScreen from './src/screens/LandingScreen';
import SubmitReportScreen from './src/screens/SubmitReportScreen';

export default function App() {
  const [screen, setScreen] = useState('landing');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#080b14' }}>
      <StatusBar barStyle="light-content" backgroundColor="#080b14" />
      {screen === 'landing' ? (
        <LandingScreen onGetStarted={() => setScreen('submit')} />
      ) : (
        <SubmitReportScreen
          route={{ params: { token: process.env.EXPO_PUBLIC_AUTH_TOKEN || '' } }}
        />
      )}
    </SafeAreaView>
  );
}

