import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePresetAssignments,
  groupDevicesByChannel,
  CHANNEL_CONFIGS,
} from './surroundLayout.ts';

test('calculatePresetAssignments stereo pair splits devices evenly into left and right', () => {
  const devices = ['d1', 'd2', 'd3', 'd4'];
  const assignments = calculatePresetAssignments(devices, 'stereo_pair');

  assert.equal(assignments['d1'], 'left');
  assert.equal(assignments['d2'], 'right');
  assert.equal(assignments['d3'], 'left');
  assert.equal(assignments['d4'], 'right');
});

test('calculatePresetAssignments 2.1 assigns dedicated subwoofer and stereo satellites', () => {
  const devices = ['d1', 'd2', 'd3'];
  const assignments = calculatePresetAssignments(devices, '2_1_surround');

  assert.equal(assignments['d1'], 'left');
  assert.equal(assignments['d2'], 'right');
  assert.equal(assignments['d3'], 'subwoofer');
});

test('calculatePresetAssignments 5.1 spatial covers left, center, right, and subwoofer', () => {
  const devices = ['d1', 'd2', 'd3', 'd4'];
  const assignments = calculatePresetAssignments(devices, '5_1_spatial');

  assert.equal(assignments['d1'], 'left');
  assert.equal(assignments['d2'], 'center');
  assert.equal(assignments['d3'], 'right');
  assert.equal(assignments['d4'], 'subwoofer');
});

test('calculatePresetAssignments reset_all maps every device to full range', () => {
  const devices = ['d1', 'd2', 'd3'];
  const assignments = calculatePresetAssignments(devices, 'reset_all');

  assert.equal(assignments['d1'], 'all');
  assert.equal(assignments['d2'], 'all');
  assert.equal(assignments['d3'], 'all');
});

test('groupDevicesByChannel categorizes connected device array into channel buckets', () => {
  const devices = [
    { deviceId: 'd1', channel: 'left' },
    { deviceId: 'd2', channel: 'right' },
    { deviceId: 'd3', channel: 'subwoofer' },
    { deviceId: 'd4', channel: 'left' },
  ];

  const grouped = groupDevicesByChannel(devices);
  assert.equal(grouped.left.length, 2);
  assert.equal(grouped.right.length, 1);
  assert.equal(grouped.subwoofer.length, 1);
  assert.equal(grouped.center.length, 0);
});

test('CHANNEL_CONFIGS defines proper panning and filter specifications', () => {
  assert.equal(CHANNEL_CONFIGS.left.panValue, -1.0);
  assert.equal(CHANNEL_CONFIGS.right.panValue, 1.0);
  assert.equal(CHANNEL_CONFIGS.center.panValue, 0.0);
  assert.equal(CHANNEL_CONFIGS.subwoofer.filterType, 'lowpass');
  assert.equal(CHANNEL_CONFIGS.subwoofer.cutoffHz, 140);
});
