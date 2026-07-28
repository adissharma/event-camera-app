/* eslint-disable no-undef */

// NOTE: Reanimated is deliberately NOT required here.
//
// Reanimated 4 pulls in react-native-worklets, which touches native module
// internals at import time and throws under Jest ("Cannot read properties of
// undefined (reading 'loadUnpackers')"). Requiring it eagerly in setup breaks
// every suite, including pure-logic ones that never render a component.
//
// Component tests that render animated views should mock it locally instead:
//   jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
