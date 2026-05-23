import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { COLORS } from '../constants/colors';
import { VOICES, PREVIEW_TEXT, VoiceOption } from '../constants/voices';
import { SPEED_STEPS } from '../constants/speeds';
import { useSettingsStore } from '../store/settingsStore';
import { generatePreview } from '../services/googleTTS';

export default function SettingsScreen() {
  const router = useRouter();
  const { voiceName, speakingRate, pitch, speedStepIdx, setVoice, setSpeedIdx, setPitch } =
    useSettingsStore();

  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const stopCurrentPreview = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setPlayingVoice(null);
    setLoadingVoice(null);
  }, []);

  const playVoicePreview = useCallback(
    async (voice: VoiceOption) => {
      // If already playing this voice, stop it
      if (playingVoice === voice.name) {
        await stopCurrentPreview();
        return;
      }

      await stopCurrentPreview();
      setLoadingVoice(voice.name);

      try {
        const filePath = await generatePreview(PREVIEW_TEXT, {
          voiceName: voice.name,
          speakingRate,
          pitch,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: filePath },
          { shouldPlay: true }
        );
        soundRef.current = sound;
        setLoadingVoice(null);
        setPlayingVoice(voice.name);

        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) {
            setPlayingVoice(null);
            sound.unloadAsync();
            soundRef.current = null;
          }
        });
      } catch (e: any) {
        setLoadingVoice(null);
        Alert.alert('エラー', `試聴できませんでした: ${e.message}`);
      }
    },
    [playingVoice, speakingRate, pitch, stopCurrentPreview]
  );

  const playCurrentSettings = useCallback(async () => {
    await stopCurrentPreview();
    setLoadingVoice('__current__');
    try {
      const filePath = await generatePreview(PREVIEW_TEXT, {
        voiceName,
        speakingRate,
        pitch,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setLoadingVoice(null);
      setPlayingVoice('__current__');
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setPlayingVoice(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e: any) {
      setLoadingVoice(null);
      Alert.alert('エラー', e.message);
    }
  }, [voiceName, speakingRate, pitch, stopCurrentPreview]);

  const filteredVoices =
    genderFilter === 'all' ? VOICES : VOICES.filter((v) => v.gender === genderFilter);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { stopCurrentPreview(); router.back(); }}>
          <Text style={styles.back}>‹ 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>設定</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Voice Selection */}
        <Text style={styles.sectionTitle}>音声選択</Text>

        {/* Gender Filter */}
        <View style={styles.filterRow}>
          {(['all', 'female', 'male'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setGenderFilter(f)}
              style={[styles.filterBtn, genderFilter === f && styles.filterBtnActive]}
            >
              <Text style={[styles.filterText, genderFilter === f && styles.filterTextActive]}>
                {f === 'all' ? 'すべて' : f === 'female' ? '女性' : '男性'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Voice Cards */}
        {filteredVoices.map((voice) => {
          const isSelected = voiceName === voice.name;
          const isLoading = loadingVoice === voice.name;
          const isPlaying = playingVoice === voice.name;

          return (
            <View
              key={voice.name}
              style={[styles.voiceCard, isSelected && styles.voiceCardSelected]}
            >
              <TouchableOpacity
                style={styles.voiceInfo}
                onPress={() => setVoice(voice.name)}
              >
                <View style={styles.voiceLeft}>
                  {isSelected && <View style={styles.selectedDot} />}
                  <View>
                    <Text style={[styles.voiceLabel, isSelected && styles.voiceLabelSelected]}>
                      {voice.label}
                    </Text>
                    <Text style={styles.voiceQuality}>
                      {voice.quality === 'neural2' ? '✨ Neural2' : 'Standard'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Per-voice preview button */}
              <TouchableOpacity
                onPress={() => playVoicePreview(voice)}
                style={styles.previewBtn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : isPlaying ? (
                  <Text style={styles.previewBtnText}>⏸</Text>
                ) : (
                  <Text style={styles.previewBtnText}>▶</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Speed */}
        <Text style={styles.sectionTitle}>読み上げ速度</Text>
        <View style={styles.sliderCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>速度</Text>
            <Text style={styles.sliderValue}>{SPEED_STEPS[speedStepIdx]}x</Text>
          </View>
          <View style={styles.speedSteps}>
            {SPEED_STEPS.map((s, i) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSpeedIdx(i)}
                style={[
                  styles.stepBtn,
                  speedStepIdx === i && styles.stepBtnActive,
                ]}
              >
                <Text style={[
                  styles.stepBtnText,
                  speedStepIdx === i && styles.stepBtnTextActive,
                ]}>
                  {s}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pitch */}
        <Text style={styles.sectionTitle}>ピッチ</Text>
        <View style={styles.sliderCard}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>高さ</Text>
            <Text style={styles.sliderValue}>{pitch >= 0 ? '+' : ''}{pitch.toFixed(1)}</Text>
          </View>
          <Slider
            minimumValue={-10}
            maximumValue={10}
            step={0.5}
            value={pitch}
            onSlidingComplete={(v) => setPitch(parseFloat(v.toFixed(1)))}
            minimumTrackTintColor={COLORS.accent}
            maximumTrackTintColor={COLORS.border}
            thumbTintColor={COLORS.accent}
            style={{ marginTop: 8 }}
          />
          <View style={styles.sliderRange}>
            <Text style={styles.rangeText}>-10</Text>
            <Text style={styles.rangeText}>0</Text>
            <Text style={styles.rangeText}>+10</Text>
          </View>
        </View>

        {/* Current settings preview */}
        <TouchableOpacity
          onPress={loadingVoice === '__current__' || playingVoice === '__current__'
            ? stopCurrentPreview
            : playCurrentSettings}
          style={styles.fullPreviewBtn}
        >
          {loadingVoice === '__current__' ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.fullPreviewText}>
              {playingVoice === '__current__' ? '⏸ 試聴停止' : '▶ 現在の設定で試聴'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  back: { color: COLORS.accent, fontSize: 17, width: 60 },
  headerTitle: { color: COLORS.white, fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  sectionTitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: COLORS.accentDim, borderColor: COLORS.accent },
  filterText: { color: COLORS.muted, fontSize: 14 },
  filterTextActive: { color: COLORS.accent, fontWeight: '600' },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 14,
  },
  voiceCardSelected: { borderColor: COLORS.accent },
  voiceInfo: { flex: 1 },
  voiceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  voiceLabel: { color: COLORS.mutedLight, fontSize: 15, fontWeight: '500' },
  voiceLabelSelected: { color: COLORS.white },
  voiceQuality: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  previewBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  previewBtnText: { color: COLORS.accent, fontSize: 16 },
  sliderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sliderLabel: { color: COLORS.mutedLight, fontSize: 14 },
  sliderValue: { color: COLORS.accent, fontSize: 16, fontWeight: '700' },
  speedSteps: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  stepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  stepBtnActive: { backgroundColor: COLORS.accent },
  stepBtnText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  stepBtnTextActive: { color: COLORS.white },
  sliderRange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeText: { color: COLORS.muted, fontSize: 11 },
  fullPreviewBtn: {
    marginTop: 32,
    backgroundColor: COLORS.accent,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  fullPreviewText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
