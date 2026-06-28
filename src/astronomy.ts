import * as Astronomy from 'astronomy-engine';
import type {
  LandmarkLinePosition,
  ObserverLocation,
  StarPosition,
  TargetCategory,
  TargetDefinition,
  TargetPosition,
} from './types';
import { normalizeAzimuth } from './drawing';

export const TARGETS: TargetDefinition[] = [
  { id: 'moon', label: '月', body: Astronomy.Body.Moon, color: '#e7dfc8', glow: 'rgba(235, 230, 207, 0.24)', radius: 7.2, kind: 'moon', category: 'solar', recommended: true },
  { id: 'mercury', label: '水星', body: Astronomy.Body.Mercury, color: '#b8b2aa', glow: 'rgba(184, 178, 170, 0.08)', radius: 2.2, kind: 'planet', category: 'solar' },
  { id: 'venus', label: '金星', body: Astronomy.Body.Venus, color: '#fff1ca', glow: 'rgba(255, 241, 202, 0.24)', radius: 3.2, kind: 'planet', category: 'solar', recommended: true },
  { id: 'mars', label: '火星', body: Astronomy.Body.Mars, color: '#d27b5e', glow: 'rgba(210, 123, 94, 0.1)', radius: 2.5, kind: 'planet', category: 'solar', recommended: true },
  { id: 'jupiter', label: '木星', body: Astronomy.Body.Jupiter, color: '#dcc7a5', glow: 'rgba(220, 199, 165, 0.13)', radius: 3.0, kind: 'planet', category: 'solar', recommended: true },
  { id: 'saturn', label: '土星', body: Astronomy.Body.Saturn, color: '#d7c696', glow: 'rgba(215, 198, 150, 0.1)', radius: 2.7, kind: 'planet', category: 'solar', recommended: true },
];

export const CATALOG_TARGETS: TargetDefinition[] = [
  { id: 'star_vega', label: 'ベガ', nameEn: 'Vega', kind: 'star', category: 'stars', raHours: 18.615, decDeg: 38.783, magnitude: 0.03, color: '#dbe8ff', glow: 'rgba(205,225,255,0.22)', radius: 2.2, recommended: true, seasonalTags: ['summer'], descriptionJa: '夏の大三角の明るい星' },
  { id: 'star_altair', label: 'アルタイル', nameEn: 'Altair', kind: 'star', category: 'stars', raHours: 19.846, decDeg: 8.868, magnitude: 0.77, color: '#e8efff', glow: 'rgba(210,225,255,0.18)', radius: 1.9, recommended: true, seasonalTags: ['summer'], descriptionJa: '夏の大三角の一角' },
  { id: 'star_deneb', label: 'デネブ', nameEn: 'Deneb', kind: 'star', category: 'stars', raHours: 20.691, decDeg: 45.28, magnitude: 1.25, color: '#dce9ff', glow: 'rgba(205,225,255,0.16)', radius: 1.8, recommended: true, seasonalTags: ['summer'], descriptionJa: 'はくちょう座の明るい星' },
  { id: 'star_arcturus', label: 'アークトゥルス', nameEn: 'Arcturus', kind: 'star', category: 'stars', raHours: 14.261, decDeg: 19.182, magnitude: -0.05, color: '#ffbf78', glow: 'rgba(255,184,108,0.2)', radius: 2.3, recommended: true, seasonalTags: ['spring'], descriptionJa: '春の大曲線でたどりやすい橙色の星' },
  { id: 'star_spica', label: 'スピカ', nameEn: 'Spica', kind: 'star', category: 'stars', raHours: 13.42, decDeg: -11.161, magnitude: 0.98, color: '#dbe8ff', glow: 'rgba(205,225,255,0.16)', radius: 1.8, recommended: true, seasonalTags: ['spring'], descriptionJa: '春の大曲線の先にある明るい星' },
  { id: 'star_antares', label: 'アンタレス', nameEn: 'Antares', kind: 'star', category: 'stars', raHours: 16.49, decDeg: -26.432, magnitude: 0.96, color: '#ff9f65', glow: 'rgba(255,154,92,0.18)', radius: 1.9, recommended: true, seasonalTags: ['summer'], descriptionJa: 'さそり座の赤い一等星' },
  { id: 'star_sirius', label: 'シリウス', nameEn: 'Sirius', kind: 'star', category: 'stars', raHours: 6.752, decDeg: -16.716, magnitude: -1.46, color: '#dbe8ff', glow: 'rgba(205,225,255,0.26)', radius: 2.6, recommended: true, seasonalTags: ['winter'], descriptionJa: '全天で最も明るい恒星' },
  { id: 'star_betelgeuse', label: 'ベテルギウス', nameEn: 'Betelgeuse', kind: 'star', category: 'stars', raHours: 5.919, decDeg: 7.407, magnitude: 0.42, color: '#ffb06c', glow: 'rgba(255,176,108,0.18)', radius: 2.0, recommended: true, seasonalTags: ['winter'], descriptionJa: 'オリオン座の赤っぽい星' },
  { id: 'star_rigel', label: 'リゲル', nameEn: 'Rigel', kind: 'star', category: 'stars', raHours: 5.242, decDeg: -8.202, magnitude: 0.13, color: '#dbe8ff', glow: 'rgba(205,225,255,0.2)', radius: 2.1, recommended: true, seasonalTags: ['winter'], descriptionJa: 'オリオン座の青白い明るい星' },
  { id: 'star_capella', label: 'カペラ', nameEn: 'Capella', kind: 'star', category: 'stars', raHours: 5.278, decDeg: 45.998, magnitude: 0.08, color: '#ffedbd', glow: 'rgba(255,238,184,0.2)', radius: 2.1, recommended: true, seasonalTags: ['winter'], descriptionJa: 'ぎょしゃ座の明るい星' },
  { id: 'star_aldebaran', label: 'アルデバラン', nameEn: 'Aldebaran', kind: 'star', category: 'stars', raHours: 4.598, decDeg: 16.509, magnitude: 0.86, color: '#ffb06c', glow: 'rgba(255,176,108,0.16)', radius: 1.9, recommended: true, seasonalTags: ['winter'], descriptionJa: 'おうし座の赤っぽい星' },
  { id: 'star_procyon', label: 'プロキオン', nameEn: 'Procyon', kind: 'star', category: 'stars', raHours: 7.655, decDeg: 5.225, magnitude: 0.34, color: '#dbe8ff', glow: 'rgba(205,225,255,0.18)', radius: 2.0, recommended: true, seasonalTags: ['winter'], descriptionJa: '冬の大三角の一角' },
  { id: 'star_pollux', label: 'ポルックス', nameEn: 'Pollux', kind: 'star', category: 'stars', raHours: 7.755, decDeg: 28.026, magnitude: 1.14, color: '#ffedbd', glow: 'rgba(255,238,184,0.15)', radius: 1.8, seasonalTags: ['winter'], descriptionJa: 'ふたご座の明るい星' },
  { id: 'star_regulus', label: 'レグルス', nameEn: 'Regulus', kind: 'star', category: 'stars', raHours: 10.139, decDeg: 11.967, magnitude: 1.35, color: '#e6edff', glow: 'rgba(215,226,255,0.14)', radius: 1.7, seasonalTags: ['spring'], descriptionJa: 'しし座の明るい星' },
  { id: 'star_fomalhaut', label: 'フォーマルハウト', nameEn: 'Fomalhaut', kind: 'star', category: 'stars', raHours: 22.961, decDeg: -29.622, magnitude: 1.16, color: '#ffedbd', glow: 'rgba(255,238,184,0.15)', radius: 1.8, seasonalTags: ['autumn'], descriptionJa: '秋の南の空で目立つ星' },
  { id: 'star_polaris', label: '北極星', nameEn: 'Polaris', kind: 'star', category: 'stars', raHours: 2.53, decDeg: 89.264, magnitude: 1.98, color: '#ffedbd', glow: 'rgba(255,238,184,0.14)', radius: 1.6, recommended: true, descriptionJa: '北の方角と高度の目安になる星' },
  { id: 'star_canopus', label: 'カノープス', nameEn: 'Canopus', kind: 'star', category: 'stars', raHours: 6.399, decDeg: -52.696, magnitude: -0.74, color: '#dbe8ff', glow: 'rgba(205,225,255,0.18)', radius: 2.2, seasonalTags: ['winter'], descriptionJa: '南の低空に見える明るい星' },

  { id: 'messier_m31', label: 'M31 アンドロメダ銀河', nameEn: 'Andromeda Galaxy', kind: 'messier', category: 'messier', raHours: 0.712, decDeg: 41.269, magnitude: 3.4, color: '#b9d7ff', glow: 'rgba(155,196,255,0.16)', radius: 2.2, recommended: true, seasonalTags: ['autumn'], descriptionJa: '肉眼や双眼鏡でも狙いやすい銀河' },
  { id: 'messier_m42', label: 'M42 オリオン大星雲', nameEn: 'Orion Nebula', kind: 'messier', category: 'messier', raHours: 5.588, decDeg: -5.391, magnitude: 4.0, color: '#bfe8d6', glow: 'rgba(155,240,205,0.14)', radius: 2.0, recommended: true, seasonalTags: ['winter'], descriptionJa: 'オリオン座三つ星の下にある明るい星雲' },
  { id: 'messier_m45', label: 'M45 すばる', nameEn: 'Pleiades', kind: 'messier', category: 'messier', raHours: 3.792, decDeg: 24.117, magnitude: 1.6, color: '#cddcff', glow: 'rgba(190,210,255,0.18)', radius: 2.3, recommended: true, seasonalTags: ['winter'], descriptionJa: '肉眼で見つけやすい散開星団' },
  { id: 'messier_m13', label: 'M13 ヘルクレス座球状星団', nameEn: 'Hercules Globular Cluster', kind: 'messier', category: 'messier', raHours: 16.695, decDeg: 36.467, magnitude: 5.8, color: '#d5d7ff', glow: 'rgba(205,210,255,0.12)', radius: 1.7, seasonalTags: ['summer'], descriptionJa: '代表的な球状星団' },
  { id: 'messier_m57', label: 'M57 リング星雲', nameEn: 'Ring Nebula', kind: 'messier', category: 'messier', raHours: 18.894, decDeg: 33.029, magnitude: 8.8, color: '#9fe6d2', glow: 'rgba(120,230,200,0.12)', radius: 1.5, seasonalTags: ['summer'], descriptionJa: 'こと座にある小さな惑星状星雲' },
  { id: 'messier_m27', label: 'M27 亜鈴状星雲', nameEn: 'Dumbbell Nebula', kind: 'messier', category: 'messier', raHours: 19.993, decDeg: 22.721, magnitude: 7.5, color: '#9fe6d2', glow: 'rgba(120,230,200,0.12)', radius: 1.5, seasonalTags: ['summer'], descriptionJa: 'こぎつね座の惑星状星雲' },
  { id: 'messier_m44', label: 'M44 プレセペ星団', nameEn: 'Beehive Cluster', kind: 'messier', category: 'messier', raHours: 8.672, decDeg: 19.672, magnitude: 3.7, color: '#d8e3ff', glow: 'rgba(190,210,255,0.13)', radius: 1.8, seasonalTags: ['spring'], descriptionJa: 'かに座の散開星団' },
  { id: 'messier_m3', label: 'M3 球状星団', nameEn: 'M3', kind: 'messier', category: 'messier', raHours: 13.704, decDeg: 28.377, magnitude: 6.2, color: '#d5d7ff', glow: 'rgba(205,210,255,0.12)', radius: 1.6, seasonalTags: ['spring'], descriptionJa: '春に見やすい球状星団' },
  { id: 'messier_m8', label: 'M8 干潟星雲', nameEn: 'Lagoon Nebula', kind: 'messier', category: 'messier', raHours: 18.061, decDeg: -24.386, magnitude: 6.0, color: '#9fe6d2', glow: 'rgba(120,230,200,0.12)', radius: 1.6, seasonalTags: ['summer'], descriptionJa: 'いて座の明るい星雲' },
  { id: 'messier_m20', label: 'M20 三裂星雲', nameEn: 'Trifid Nebula', kind: 'messier', category: 'messier', raHours: 18.042, decDeg: -22.971, magnitude: 6.3, color: '#a9d8ff', glow: 'rgba(140,200,255,0.11)', radius: 1.5, seasonalTags: ['summer'], descriptionJa: 'いて座付近の星雲' },
  { id: 'messier_m17', label: 'M17 オメガ星雲', nameEn: 'Omega Nebula', kind: 'messier', category: 'messier', raHours: 18.346, decDeg: -16.172, magnitude: 6.0, color: '#9fe6d2', glow: 'rgba(120,230,200,0.12)', radius: 1.5, seasonalTags: ['summer'], descriptionJa: '夏の天の川沿いの星雲' },
  { id: 'messier_m11', label: 'M11 野鴨星団', nameEn: 'Wild Duck Cluster', kind: 'messier', category: 'messier', raHours: 18.851, decDeg: -6.27, magnitude: 6.3, color: '#d8e3ff', glow: 'rgba(190,210,255,0.12)', radius: 1.5, seasonalTags: ['summer'], descriptionJa: 'たて座の散開星団' },

  { id: 'double_albireo', label: 'アルビレオ', nameEn: 'Albireo', kind: 'double_star', category: 'double', raHours: 19.512, decDeg: 27.959, magnitude: 3.1, color: '#ffd78e', glow: 'rgba(255,210,130,0.15)', radius: 1.8, recommended: true, seasonalTags: ['summer'], descriptionJa: '色の対比が楽しい二重星' },
  { id: 'double_mizar', label: 'ミザール', nameEn: 'Mizar', kind: 'double_star', category: 'double', raHours: 13.399, decDeg: 54.925, magnitude: 2.23, color: '#e6edff', glow: 'rgba(215,226,255,0.14)', radius: 1.8, recommended: true, descriptionJa: '北斗七星の柄にある二重星' },
  { id: 'double_castor', label: 'カストル', nameEn: 'Castor', kind: 'double_star', category: 'double', raHours: 7.576, decDeg: 31.888, magnitude: 1.58, color: '#e6edff', glow: 'rgba(215,226,255,0.14)', radius: 1.8, seasonalTags: ['winter'], descriptionJa: 'ふたご座の二重星' },
  { id: 'double_almach', label: 'アルマク', nameEn: 'Almach', kind: 'double_star', category: 'double', raHours: 2.065, decDeg: 42.329, magnitude: 2.1, color: '#ffd78e', glow: 'rgba(255,210,130,0.14)', radius: 1.7, seasonalTags: ['autumn'], descriptionJa: 'アンドロメダ座の二重星' },
  { id: 'double_epsilon_lyrae', label: 'ε Lyrae ダブル・ダブルスター', nameEn: 'Epsilon Lyrae', kind: 'double_star', category: 'double', raHours: 18.739, decDeg: 39.67, magnitude: 4.7, color: '#e6edff', glow: 'rgba(215,226,255,0.12)', radius: 1.5, seasonalTags: ['summer'], descriptionJa: 'こと座の有名な多重星' },
  { id: 'double_cor_caroli', label: 'コル・カロリ', nameEn: 'Cor Caroli', kind: 'double_star', category: 'double', raHours: 12.933, decDeg: 38.318, magnitude: 2.9, color: '#e6edff', glow: 'rgba(215,226,255,0.12)', radius: 1.6, seasonalTags: ['spring'], descriptionJa: 'りょうけん座の二重星' },

  { id: 'landmark_polaris', label: '北極星', nameEn: 'Polaris', kind: 'landmark', category: 'landmark', raHours: 2.53, decDeg: 89.264, magnitude: 1.98, color: '#ffedbd', glow: 'rgba(255,238,184,0.12)', radius: 1.5, recommended: true, descriptionJa: '北の方角を確認する目印' },
  { id: 'landmark_summer_triangle', label: '夏の大三角', kind: 'landmark', category: 'landmark', raHours: 19.72, decDeg: 30.0, color: '#bdd7ff', glow: 'rgba(180,210,255,0.1)', radius: 1.5, recommended: true, seasonalTags: ['summer'], descriptionJa: 'ベガ・アルタイル・デネブを結ぶ夏の目印' },
  { id: 'landmark_winter_triangle', label: '冬の大三角', kind: 'landmark', category: 'landmark', raHours: 6.78, decDeg: -1.35, color: '#d8e3ff', glow: 'rgba(190,210,255,0.1)', radius: 1.5, recommended: true, seasonalTags: ['winter'], descriptionJa: 'シリウス・プロキオン・ベテルギウスの目印' },
  { id: 'landmark_spring_arc', label: '春の大曲線', kind: 'landmark', category: 'landmark', raHours: 13.78, decDeg: 15.0, color: '#ffd39a', glow: 'rgba(255,200,140,0.1)', radius: 1.5, recommended: true, seasonalTags: ['spring'], descriptionJa: '北斗七星からアークトゥルス、スピカへたどる目印' },
  { id: 'landmark_big_dipper', label: '北斗七星', kind: 'landmark', category: 'landmark', raHours: 12.3, decDeg: 57.0, color: '#d8e3ff', glow: 'rgba(190,210,255,0.1)', radius: 1.5, recommended: true, seasonalTags: ['spring'], descriptionJa: '北の空で見つけやすい七つの星' },
  { id: 'landmark_cassiopeia', label: 'カシオペヤ座', kind: 'landmark', category: 'landmark', raHours: 0.95, decDeg: 60.5, color: '#d8e3ff', glow: 'rgba(190,210,255,0.1)', radius: 1.5, recommended: true, seasonalTags: ['autumn'], descriptionJa: 'W字で探しやすい北の目印' },
  { id: 'landmark_orion_belt', label: 'オリオン座三つ星', kind: 'landmark', category: 'landmark', raHours: 5.6, decDeg: -1.2, color: '#d8e3ff', glow: 'rgba(190,210,255,0.1)', radius: 1.5, recommended: true, seasonalTags: ['winter'], descriptionJa: 'オリオン座の中央に並ぶ三つ星' },
];

export const ALL_TARGETS = [...TARGETS, ...CATALOG_TARGETS];
export const VALID_TARGET_IDS = ALL_TARGETS.map((target) => target.id);

export const TARGET_CATEGORIES: Array<{ id: TargetCategory; label: string }> = [
  { id: 'recommended', label: 'おすすめ' },
  { id: 'solar', label: '月・惑星' },
  { id: 'stars', label: '明るい星' },
  { id: 'messier', label: '星雲・星団' },
  { id: 'double', label: '二重星' },
  { id: 'landmark', label: '目印' },
  { id: 'seasonal', label: '季節別' },
];

export const LANDMARK_LINES: Array<{
  id: string;
  label: string;
  points: Array<{ raHours: number; decDeg: number }>;
  closed?: boolean;
}> = [
  {
    id: 'line_summer_triangle',
    label: '夏の大三角',
    points: [
      { raHours: 18.615, decDeg: 38.783 },
      { raHours: 19.846, decDeg: 8.868 },
      { raHours: 20.691, decDeg: 45.28 },
    ],
    closed: true,
  },
  {
    id: 'line_winter_triangle',
    label: '冬の大三角',
    points: [
      { raHours: 6.752, decDeg: -16.716 },
      { raHours: 7.655, decDeg: 5.225 },
      { raHours: 5.919, decDeg: 7.407 },
    ],
    closed: true,
  },
  {
    id: 'line_big_dipper',
    label: '北斗七星',
    points: [
      { raHours: 11.063, decDeg: 61.751 },
      { raHours: 11.031, decDeg: 56.382 },
      { raHours: 11.897, decDeg: 53.695 },
      { raHours: 12.257, decDeg: 57.032 },
      { raHours: 12.901, decDeg: 55.959 },
      { raHours: 13.399, decDeg: 54.925 },
      { raHours: 13.792, decDeg: 49.313 },
    ],
  },
  {
    id: 'line_cassiopeia',
    label: 'カシオペヤ座',
    points: [
      { raHours: 0.153, decDeg: 59.15 },
      { raHours: 0.675, decDeg: 56.537 },
      { raHours: 0.945, decDeg: 60.717 },
      { raHours: 1.43, decDeg: 60.235 },
      { raHours: 1.906, decDeg: 63.67 },
    ],
  },
  {
    id: 'line_orion_belt',
    label: 'オリオン座三つ星',
    points: [
      { raHours: 5.533, decDeg: -0.299 },
      { raHours: 5.604, decDeg: -1.202 },
      { raHours: 5.679, decDeg: -1.943 },
    ],
  },
];

const BRIGHT_STARS: Array<{ name: string; raHours: number; decDeg: number; magnitude: number }> = [
  { name: 'Sirius', raHours: 6.752, decDeg: -16.716, magnitude: -1.46 },
  { name: 'Canopus', raHours: 6.399, decDeg: -52.696, magnitude: -0.74 },
  { name: 'Arcturus', raHours: 14.261, decDeg: 19.182, magnitude: -0.05 },
  { name: 'Vega', raHours: 18.615, decDeg: 38.783, magnitude: 0.03 },
  { name: 'Capella', raHours: 5.278, decDeg: 45.998, magnitude: 0.08 },
  { name: 'Rigel', raHours: 5.242, decDeg: -8.202, magnitude: 0.13 },
  { name: 'Procyon', raHours: 7.655, decDeg: 5.225, magnitude: 0.34 },
  { name: 'Betelgeuse', raHours: 5.919, decDeg: 7.407, magnitude: 0.42 },
  { name: 'Achernar', raHours: 1.628, decDeg: -57.237, magnitude: 0.46 },
  { name: 'Altair', raHours: 19.846, decDeg: 8.868, magnitude: 0.77 },
  { name: 'Aldebaran', raHours: 4.598, decDeg: 16.509, magnitude: 0.86 },
  { name: 'Antares', raHours: 16.49, decDeg: -26.432, magnitude: 0.96 },
  { name: 'Spica', raHours: 13.42, decDeg: -11.161, magnitude: 0.98 },
  { name: 'Pollux', raHours: 7.755, decDeg: 28.026, magnitude: 1.14 },
  { name: 'Fomalhaut', raHours: 22.961, decDeg: -29.622, magnitude: 1.16 },
  { name: 'Deneb', raHours: 20.691, decDeg: 45.28, magnitude: 1.25 },
  { name: 'Regulus', raHours: 10.139, decDeg: 11.967, magnitude: 1.35 },
  { name: 'Adhara', raHours: 6.977, decDeg: -28.972, magnitude: 1.5 },
  { name: 'Castor', raHours: 7.576, decDeg: 31.888, magnitude: 1.58 },
  { name: 'Shaula', raHours: 17.56, decDeg: -37.104, magnitude: 1.63 },
  { name: 'Bellatrix', raHours: 5.419, decDeg: 6.35, magnitude: 1.64 },
  { name: 'Elnath', raHours: 5.438, decDeg: 28.607, magnitude: 1.65 },
  { name: 'Alnilam', raHours: 5.604, decDeg: -1.202, magnitude: 1.69 },
  { name: 'Alnitak', raHours: 5.679, decDeg: -1.943, magnitude: 1.74 },
  { name: 'Alioth', raHours: 12.901, decDeg: 55.959, magnitude: 1.76 },
  { name: 'Dubhe', raHours: 11.063, decDeg: 61.751, magnitude: 1.79 },
  { name: 'Mirfak', raHours: 3.405, decDeg: 49.861, magnitude: 1.79 },
  { name: 'Wezen', raHours: 7.14, decDeg: -26.393, magnitude: 1.83 },
  { name: 'Kaus Australis', raHours: 18.403, decDeg: -34.384, magnitude: 1.85 },
  { name: 'Alkaid', raHours: 13.792, decDeg: 49.313, magnitude: 1.86 },
  { name: 'Menkent', raHours: 14.112, decDeg: -36.37, magnitude: 2.06 },
  { name: 'Alhena', raHours: 6.628, decDeg: 16.399, magnitude: 1.93 },
  { name: 'Mirzam', raHours: 6.378, decDeg: -17.956, magnitude: 1.98 },
  { name: 'Polaris', raHours: 2.53, decDeg: 89.264, magnitude: 1.98 },
  { name: 'Alphard', raHours: 9.46, decDeg: -8.658, magnitude: 2.0 },
  { name: 'Hamal', raHours: 2.119, decDeg: 23.462, magnitude: 2.0 },
  { name: 'Denebola', raHours: 11.817, decDeg: 14.572, magnitude: 2.14 },
  { name: 'Algol', raHours: 3.137, decDeg: 40.956, magnitude: 2.12 },
  { name: 'Almach', raHours: 2.065, decDeg: 42.329, magnitude: 2.1 },
  { name: 'Markab', raHours: 23.08, decDeg: 15.205, magnitude: 2.49 },
  { name: 'Scheat', raHours: 23.063, decDeg: 28.082, magnitude: 2.42 },
  { name: 'Alpheratz', raHours: 0.139, decDeg: 29.09, magnitude: 2.06 },
  { name: 'Enif', raHours: 21.737, decDeg: 9.875, magnitude: 2.4 },
  { name: 'Rasalhague', raHours: 17.582, decDeg: 12.56, magnitude: 2.07 },
  { name: 'Caph', raHours: 0.153, decDeg: 59.15, magnitude: 2.28 },
  { name: 'Schedar', raHours: 0.675, decDeg: 56.537, magnitude: 2.24 },
  { name: 'Kochab', raHours: 14.845, decDeg: 74.155, magnitude: 2.08 },
  { name: 'Mizar', raHours: 13.399, decDeg: 54.925, magnitude: 2.23 },
  { name: 'Merak', raHours: 11.031, decDeg: 56.382, magnitude: 2.34 },
];

export function calculateTargets(location: ObserverLocation, date: Date): TargetPosition[] {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  const solarSystemTargets = TARGETS.map((target) => {
    if (!target.body) {
      throw new Error(`Solar system target ${target.id} has no Astronomy body`);
    }
    const equator = Astronomy.Equator(target.body, date, observer, true, true);
    const horizon = Astronomy.Horizon(date, observer, equator.ra, equator.dec, 'normal');

    return {
      id: target.id,
      azimuthDeg: normalizeAzimuth(horizon.azimuth),
      altitudeDeg: horizon.altitude,
      kind: target.kind,
      phaseDeg: target.id === 'moon' ? Astronomy.MoonPhase(date) : undefined,
    };
  });

  return [...solarSystemTargets, ...calculateCatalogTargets(location, date)];
}

export function calculateCatalogTargets(location: ObserverLocation, date: Date): TargetPosition[] {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  return CATALOG_TARGETS.map((target) => {
    const horizon = Astronomy.Horizon(date, observer, target.raHours ?? 0, target.decDeg ?? 0, 'normal');
    return {
      id: target.id,
      azimuthDeg: normalizeAzimuth(horizon.azimuth),
      altitudeDeg: horizon.altitude,
      kind: target.kind,
    };
  });
}

export function getTargetDefinition(targetId: string | null | undefined) {
  if (!targetId) return undefined;
  return ALL_TARGETS.find((target) => target.id === targetId);
}

export function getKindLabel(target: TargetDefinition | undefined) {
  if (!target) return '対象';
  if (target.kind === 'moon') return '月';
  if (target.kind === 'planet') return '惑星';
  if (target.kind === 'star') return '恒星';
  if (target.kind === 'messier') return '星雲・星団';
  if (target.kind === 'double_star') return '二重星';
  return '目印';
}

export function calculateStars(location: ObserverLocation, date: Date): StarPosition[] {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  return BRIGHT_STARS.map((star) => {
    const horizon = Astronomy.Horizon(date, observer, star.raHours, star.decDeg, 'normal');

    return {
      name: star.name,
      azimuthDeg: normalizeAzimuth(horizon.azimuth),
      altitudeDeg: horizon.altitude,
      magnitude: star.magnitude,
      color: getStarColor(star.name),
    };
  });
}

export function calculateLandmarkLines(location: ObserverLocation, date: Date): LandmarkLinePosition[] {
  const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

  return LANDMARK_LINES.map((line) => ({
    id: line.id,
    label: line.label,
    closed: line.closed,
    points: line.points.map((point) => {
      const horizon = Astronomy.Horizon(date, observer, point.raHours, point.decDeg, 'normal');
      return {
        azimuthDeg: normalizeAzimuth(horizon.azimuth),
        altitudeDeg: horizon.altitude,
      };
    }),
  }));
}

function getStarColor(name: string) {
  const redOrange = new Set(['Betelgeuse', 'Aldebaran', 'Antares', 'Arcturus', 'Hamal']);
  const yellowWhite = new Set(['Capella', 'Pollux', 'Fomalhaut', 'Polaris', 'Alpheratz']);
  const blueWhite = new Set([
    'Sirius',
    'Canopus',
    'Vega',
    'Rigel',
    'Procyon',
    'Spica',
    'Deneb',
    'Adhara',
    'Shaula',
    'Bellatrix',
    'Elnath',
    'Alnilam',
    'Alnitak',
    'Mirfak',
    'Wezen',
  ]);

  if (redOrange.has(name)) return '255, 184, 108';
  if (yellowWhite.has(name)) return '255, 238, 184';
  if (blueWhite.has(name)) return '205, 225, 255';
  return '224, 232, 255';
}
