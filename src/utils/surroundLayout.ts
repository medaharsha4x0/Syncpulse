/**
 * Pure algorithms for multi-speaker spatial surround grouping,
 * automatic layout distribution, and channel acoustics.
 */

export type SpatialChannel = 'left' | 'right' | 'center' | 'subwoofer' | 'all';

export interface ChannelGroupConfig {
  id: SpatialChannel;
  name: string;
  shortLabel: string;
  description: string;
  color: string;
  panValue: number; // -1 (left) to 1 (right)
  filterType?: 'lowpass' | 'highpass' | 'allpass';
  cutoffHz?: number;
  iconName: string;
}

export const CHANNEL_CONFIGS: Record<SpatialChannel, ChannelGroupConfig> = {
  left: {
    id: 'left',
    name: 'Left Channel',
    shortLabel: 'LEFT',
    description: 'Front & Rear Left stereo separation (Pan -1.0)',
    color: 'from-cyan-500 to-blue-600',
    panValue: -1.0,
    filterType: 'allpass',
    iconName: 'ArrowLeft',
  },
  center: {
    id: 'center',
    name: 'Center Channel',
    shortLabel: 'CENTER',
    description: 'Lead vocals, punchy snare, and mono clarity (Pan 0.0)',
    color: 'from-violet-500 to-indigo-600',
    panValue: 0.0,
    filterType: 'allpass',
    iconName: 'Dot',
  },
  right: {
    id: 'right',
    name: 'Right Channel',
    shortLabel: 'RIGHT',
    description: 'Front & Rear Right stereo separation (Pan +1.0)',
    color: 'from-fuchsia-500 to-pink-600',
    panValue: 1.0,
    filterType: 'allpass',
    iconName: 'ArrowRight',
  },
  subwoofer: {
    id: 'subwoofer',
    name: 'Subwoofer (LFE)',
    shortLabel: 'SUB',
    description: 'Deep low-end rumble (<140Hz Biquad Lowpass filter)',
    color: 'from-amber-500 to-orange-600',
    panValue: 0.0,
    filterType: 'lowpass',
    cutoffHz: 140,
    iconName: 'Speaker',
  },
  all: {
    id: 'all',
    name: 'Full Range Master',
    shortLabel: 'ALL',
    description: 'Full unadulterated stereo mix for all speakers',
    color: 'from-emerald-500 to-teal-600',
    panValue: 0.0,
    iconName: 'Radio',
  },
};

export type SurroundPresetType = 'stereo_pair' | '2_1_surround' | 'quad_surround' | '5_1_spatial' | 'reset_all';

export interface SurroundPreset {
  id: SurroundPresetType;
  title: string;
  description: string;
  minSpeakers: number;
}

export const SURROUND_PRESETS: SurroundPreset[] = [
  {
    id: 'stereo_pair',
    title: 'Stereo Pair (2.0)',
    description: 'Splits available nodes evenly into Left and Right stages',
    minSpeakers: 2,
  },
  {
    id: '2_1_surround',
    title: 'Bass Boosted (2.1)',
    description: 'Allocates dedicated Subwoofer with Left and Right satellites',
    minSpeakers: 3,
  },
  {
    id: 'quad_surround',
    title: 'Quadraphonic (4.0)',
    description: 'Even distribution across 4 room corners',
    minSpeakers: 4,
  },
  {
    id: '5_1_spatial',
    title: 'True Spatial Array (5.1)',
    description: 'Left, Center, Right + dedicated Subwoofer bass pump',
    minSpeakers: 4,
  },
  {
    id: 'reset_all',
    title: 'All Full Range (Mono/Stereo)',
    description: 'Every node plays the complete mix without attenuation',
    minSpeakers: 1,
  },
];

/**
 * Calculates auto-assignment of channel groups given a list of device IDs and a preset.
 */
export function calculatePresetAssignments(
  deviceIds: string[],
  preset: SurroundPresetType
): Record<string, SpatialChannel> {
  const result: Record<string, SpatialChannel> = {};
  const n = deviceIds.length;
  if (n === 0) return result;

  if (preset === 'reset_all') {
    for (const id of deviceIds) {
      result[id] = 'all';
    }
    return result;
  }

  if (preset === 'stereo_pair') {
    // Alternate Left and Right
    deviceIds.forEach((id, index) => {
      result[id] = index % 2 === 0 ? 'left' : 'right';
    });
    return result;
  }

  if (preset === '2_1_surround') {
    // Last device is subwoofer, remaining split between left and right
    if (n === 1) {
      result[deviceIds[0]] = 'all';
    } else if (n === 2) {
      result[deviceIds[0]] = 'left';
      result[deviceIds[1]] = 'right';
    } else {
      const subId = deviceIds[deviceIds.length - 1];
      result[subId] = 'subwoofer';
      const remaining = deviceIds.slice(0, -1);
      remaining.forEach((id, index) => {
        result[id] = index % 2 === 0 ? 'left' : 'right';
      });
    }
    return result;
  }

  if (preset === 'quad_surround') {
    // Alternate Left and Right
    deviceIds.forEach((id, index) => {
      const mod = index % 4;
      result[id] = mod === 0 || mod === 2 ? 'left' : 'right';
    });
    return result;
  }

  if (preset === '5_1_spatial') {
    if (n < 4) {
      return calculatePresetAssignments(deviceIds, '2_1_surround');
    }
    // Pattern: 0 -> Left, 1 -> Center, 2 -> Right, 3 -> Subwoofer, rest distributed
    const channels: SpatialChannel[] = ['left', 'center', 'right', 'subwoofer'];
    deviceIds.forEach((id, index) => {
      result[id] = channels[index % channels.length];
    });
    return result;
  }

  return result;
}

/**
 * Groups devices by spatial channel
 */
export function groupDevicesByChannel<T extends { deviceId: string; channel?: string }>(
  devices: T[]
): Record<SpatialChannel, T[]> {
  const groups: Record<SpatialChannel, T[]> = {
    all: [],
    left: [],
    center: [],
    right: [],
    subwoofer: [],
  };

  for (const dev of devices) {
    const ch = (dev.channel || 'all').toLowerCase() as SpatialChannel;
    if (groups[ch]) {
      groups[ch].push(dev);
    } else {
      groups.all.push(dev);
    }
  }

  return groups;
}
