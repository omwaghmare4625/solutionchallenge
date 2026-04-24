import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';

import SubmitReportScreen from './src/screens/SubmitReportScreen';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <SubmitReportScreen route={{ params: { token: process.env.EXPO_PUBLIC_AUTH_TOKEN || '' } }} />
    </SafeAreaView>
  );
}
