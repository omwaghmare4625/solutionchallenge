import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

const features = [
  { icon: '🧠', label: 'AI OCR Validation' },
  { icon: '📡', label: 'Offline-First Sync' },
  { icon: '⚡', label: 'Real-Time Dashboard' },
];

export default function LandingScreen({ onGetStarted }) {
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(32)).current;
  const scaleAnim  = useRef(new Animated.Value(0.9)).current;
  const badge1Anim = useRef(new Animated.Value(0)).current;
  const badge2Anim = useRef(new Animated.Value(0)).current;
  const badge3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]),
      Animated.stagger(120, [
        Animated.timing(badge1Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(badge2Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(badge3Anim, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const badgeAnims = [badge1Anim, badge2Anim, badge3Anim];

  return (
    <View style={styles.root}>
      {/* ── Background gradient layers ── */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />
      <View style={styles.grid} />

      {/* ── Hero card ── */}
      <Animated.View
        style={[
          styles.hero,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo / wordmark */}
        <View style={styles.logoRow}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>GSOL</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaText}>BETA</Text>
          </View>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>
          Field intelligence,{'\n'}
          <Text style={styles.headlineAccent}>at the speed</Text>
          {'\n'}of the ground.
        </Text>

        {/* Sub-headline */}
        <Text style={styles.sub}>
          Submit reports from anywhere — even without internet. GSOL queues,
          syncs, and validates with AI-powered OCR.
        </Text>

        {/* Feature pills */}
        <View style={styles.featuresRow}>
          {features.map((f, i) => (
            <Animated.View
              key={f.label}
              style={[
                styles.featurePill,
                {
                  opacity: badgeAnims[i],
                  transform: [
                    {
                      translateY: badgeAnims[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* ── CTAs ── */}
      <Animated.View style={[styles.ctaContainer, { opacity: fadeAnim }]}>
        <Pressable
          id="landing-get-started"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onGetStarted}
          accessibilityRole="button"
          accessibilityLabel="Get started — submit a report"
        >
          <Text style={styles.primaryBtnText}>Get Started →</Text>
        </Pressable>

        <Text style={styles.hint}>Submit a field report in under 60 seconds</Text>
      </Animated.View>

      {/* ── Footer ── */}
      <Animated.Text style={[styles.footer, { opacity: fadeAnim }]}>
        Ground-level Survey &amp; Operations Layer
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080b14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
    overflow: 'hidden',
  },

  /* ── Background ── */
  orb1: {
    position: 'absolute',
    top: '-10%',
    left: '-15%',
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.425,
    backgroundColor: 'rgba(99,102,241,0.14)',
    // React Native doesn't support CSS blur; we approximate with layered opacity
  },
  orb2: {
    position: 'absolute',
    bottom: '-12%',
    right: '-18%',
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    backgroundColor: 'rgba(34,211,238,0.08)',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    // Grid lines via repeating subtle opacity – not possible in RN,
    // so we omit and rely on orb depth instead.
  },

  /* ── Hero card ── */
  hero: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 28,
    marginBottom: 24,
  },

  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  betaBadge: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  betaText: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  headline: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  headlineAccent: {
    color: '#818cf8',
  },
  sub: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },

  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureIcon: {
    fontSize: 13,
  },
  featureLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },

  /* ── CTAs ── */
  ctaContainer: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  hint: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },

  /* ── Footer ── */
  footer: {
    position: 'absolute',
    bottom: 20,
    color: '#1e293b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
