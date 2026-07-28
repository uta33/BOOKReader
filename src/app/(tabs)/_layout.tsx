import React from 'react';
import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { COLORS } from '../../constants/colors';

/** 絵文字をそのままアイコンに使う（@expo/vector-icons を足さない）。 */
function icon(glyph: string) {
  return ({ color }: { color: ColorValue }) => (
    <Text style={{ fontSize: 19, color, opacity: color === COLORS.accent ? 1 : 0.75 }}>
      {glyph}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        },
        tabBarLabelStyle: { fontSize: 10.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="shelf" options={{ title: '本棚', tabBarIcon: icon('📚') }} />
      <Tabs.Screen name="progress" options={{ title: '進捗', tabBarIcon: icon('📈') }} />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
