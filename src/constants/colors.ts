/**
 * 紙のノートから引いた配色。
 *
 * READING NOTE の主題は紙のノートなので、地は紙、本文は墨、構造は藍、
 * 抜き書きの標だけを朱にする。強さは朱の一点に集約し、周囲は静かに保つ。
 * ニュートラルは無彩色の既定値ではなく、緑みに寄せた紙色を選んでいる。
 */
export const COLORS = {
  // 紙
  bg: '#EDEFEA',
  card: '#F6F7F3',
  cardElevated: '#E3E6DF',

  // 墨（本文と副次テキスト）
  text: '#191D1B',
  mutedLight: '#4E554F',
  muted: '#6B726C',

  // 藍（主色・構造）
  accent: '#2B4C7E',
  accentBright: '#1F3A63',
  accentDim: 'rgba(43,76,126,0.10)',
  highlight: 'rgba(43,76,126,0.16)',

  // 朱（ドッグイヤー・抜き書きの標。ここだけ強い）
  shu: '#C8452E',
  shuDim: 'rgba(200,69,46,0.10)',
  danger: '#C8452E',

  // 罫線・境界
  border: '#C9CFC6',

  // 意味色（アクセントとは別系統）
  done: '#4A7A5C',
  doneDim: 'rgba(74,122,92,0.14)',

  /** 藍・朱・暗い面の上に載る文字。 */
  onAccent: '#F6F7F3',
};
