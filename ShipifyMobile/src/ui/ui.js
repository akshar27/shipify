import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from './theme';

export function Screen({ children, onRefresh, refreshing = false, scroll = true, style }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[s.screen, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.screen, { flex: 1 }, style]}>{children}</View>
  );
  return <SafeAreaView style={s.safe} edges={['left', 'right', 'bottom']}>{body}</SafeAreaView>;
}

export const H1 = ({ children, style }) => <Text accessibilityRole="header" style={[s.h1, style]}>{children}</Text>;
export const P = ({ children, muted, style, ...rest }) => <Text style={[s.p, muted && { color: colors.muted }, style]} {...rest}>{children}</Text>;

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style, testID }) {
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [s.btn, s[`btn_${variant}`], off && { opacity: 0.5 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary} /> : <Text style={[s.btnText, s[`btnText_${variant}`]]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, hint, style, ...input }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[s.input, error && { borderColor: colors.bad }, style]}
        {...input}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, onPress, style }) {
  const C = onPress ? Pressable : View;
  return <C onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={[s.card, style]}>{children}</C>;
}

const toneColors = {
  good: [colors.good, colors.goodBg], warn: [colors.warn, colors.warnBg], bad: [colors.bad, colors.badBg],
  info: [colors.info, colors.infoBg], neutral: [colors.neutral, colors.neutralBg],
};

export function Pill({ label, tone = 'neutral' }) {
  const [fg, bg] = toneColors[tone];
  return <View style={[s.pill, { backgroundColor: bg }]}><Text style={{ color: fg, fontWeight: '600', fontSize: 12 }}>{label}</Text></View>;
}

/** Inline message. Used instead of alert() so it works the same on every platform and never blocks the screen. */
export function Banner({ type = 'info', children, style }) {
  if (!children) return null;
  const [fg, bg] = toneColors[type === 'error' ? 'bad' : type === 'success' ? 'good' : type];
  return <View accessibilityRole="alert" style={[s.banner, { backgroundColor: bg }, style]}><Text style={{ color: fg }}>{children}</Text></View>;
}

export function Chips({ options, value, onChange }) {
  return (
    <View style={s.chips}>
      {options.map((o) => {
        const { key, label } = typeof o === 'string' ? { key: o, label: o } : o;
        const on = key === value;
        return (
          <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(key)} style={[s.chip, on && s.chipOn]}>
            <Text style={{ color: on ? '#fff' : colors.text, textTransform: 'capitalize' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Check({ checked, onChange, children }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={s.checkRow}>
      <View style={[s.box, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{checked ? <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text> : null}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export const Center = ({ children }) => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg }}>{children}</View>;
export const Spinner = () => <Center><ActivityIndicator size="large" color={colors.primary} /></Center>;
export const Gap = ({ h = space.md }) => <View style={{ height: h }} />;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  screen: { padding: space.lg, paddingBottom: space.xl * 2 },
  h1: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: space.md },
  p: { fontSize: 15, color: colors.text, lineHeight: 21 },
  btn: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, marginTop: space.sm },
  btn_primary: { backgroundColor: colors.primary },
  btn_secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  btn_danger: { backgroundColor: colors.bad },
  btnText: { fontSize: 16, fontWeight: '600' },
  btnText_primary: { color: '#fff' },
  btnText_secondary: { color: colors.text },
  btnText_danger: { color: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: space.md, minHeight: 46, fontSize: 16, color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  error: { fontSize: 12, color: colors.bad, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: space.lg, marginBottom: space.md, borderWidth: 1, borderColor: colors.border },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  banner: { padding: space.md, borderRadius: 10, marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.md },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
