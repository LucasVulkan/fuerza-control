import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * A navigation ref that can be used outside of React components
 * (e.g., from the Zustand store's `navigate` action).
 *
 * Wire this up in App.js:
 *   <NavigationContainer ref={navigationRef}>
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Maps a store view name to a React Navigation screen + optional tab.
 * Returns { screen, params? } or null if no mapping exists.
 */
export function viewToRoute(view) {
  switch (view) {
    case 'home':
      return { screen: 'Main', params: { screen: 'Home' } };
    case 'history':
      return { screen: 'Main', params: { screen: 'History' } };
    case 'stats':
      return { screen: 'Main', params: { screen: 'Stats' } };
    case 'programPrint':
    case 'programSummary':
      return { screen: 'ProgramDetail' };
    case 'program':
      return { screen: 'Main', params: { screen: 'Program' } };
    case 'workout':
      return { screen: 'Workout' };
    case 'setup':
      return { screen: 'Setup' };
    case 'onboarding':
      return { screen: 'Onboarding' };
    case 'programEditor':
      return { screen: 'ProgramEditor' };
    default:
      return null;
  }
}

/**
 * Navigate imperatively from outside React components.
 * Called by the store's `navigate` action.
 */
export function navigateTo(view) {
  if (!navigationRef.isReady()) return;
  const route = viewToRoute(view);
  if (!route) return;
  navigationRef.navigate(route.screen, route.params);
}
