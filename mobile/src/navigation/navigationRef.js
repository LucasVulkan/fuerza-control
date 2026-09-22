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
    case 'myProgram':
      return { screen: 'Main', params: { screen: 'MyProgram' } };
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
 * Vuelve a Main desapilando lo que tenga encima. Con `params` elige pestaña;
 * sin ellos Main conserva la que tenía (el editor vuelve a donde se abrió).
 * Si Main no está en la pila (arranque en Workout tras matar la app), la pila
 * pasa a ser solo Main: apilarla dejaría debajo una pantalla muerta.
 * En React Navigation 7 `navigate` a una ruta ya apilada APILA otra: por eso
 * existe esto.
 */
export function backToMain(navigation, params) {
  const inStack = navigation.getState()?.routes?.some((r) => r.name === 'Main');
  if (inStack) navigation.popTo('Main', params);
  else navigation.reset({ index: 0, routes: [{ name: 'Main', params }] });
}

/**
 * Navigate imperatively from outside React components.
 * Called by the store's `navigate` action.
 *
 * En v7 `navigate` a una ruta ya apilada apila otra encima; `Main` necesita
 * la misma regla que `backToMain` pero mirando la pila raíz del contenedor.
 */
export function navigateTo(view) {
  if (!navigationRef.isReady()) return;
  const route = viewToRoute(view);
  if (!route) return;
  if (route.screen === 'Main') {
    const inStack = navigationRef.getRootState()?.routes?.some((r) => r.name === 'Main');
    if (inStack) navigationRef.navigate(route.screen, route.params, { pop: true });
    else navigationRef.reset({ index: 0, routes: [{ name: 'Main', params: route.params }] });
    return;
  }
  navigationRef.navigate(route.screen, route.params, { pop: true });
}
