import { describe, it, expect } from 'vitest';
import {
  SECTIONS, sectionOf, sectionProgress, barFills, skipTarget, afterSettings, afterProgram,
  builderExit, afterProposal, learnStart, coachedExit, deviceLanguage, initialRouteFor, newFlow, canGoBack, entryTab,
} from './onboardingFlow';

const A = (patch = {}) => ({ ...newFlow().answers, ...patch });

describe('sectionOf', () => {
  it('bienvenida y recuperar no tienen barra; listo es el completado', () => {
    expect(sectionOf('welcome')).toBe(-1);
    expect(sectionOf('recover')).toBe(-1);
    for (const id of ['r_trainer', 'r_code', 'r_client']) expect(sectionOf(id)).toBe(-1);
    expect(sectionOf('done')).toBe(SECTIONS.length);
  });

  it('cada pantalla cae en su tramo', () => {
    expect(['units', 'theme', 'role', 't_client', 'a_cards'].map(sectionOf)).toEqual([0, 0, 1, 2, 3]);
    expect(sectionOf('s_adjust')).toBe(2);
  });
});

describe('rutas tras los ajustes', () => {
  it('la invitación se salta la bifurcación', () => {
    expect(afterSettings(A({ viaInvite: true }))).toBe('c_code');
    expect(afterSettings(A())).toBe('role');
  });

  it('saltar Ajustes cae en la bifurcación (o en el código, si hay invitación)', () => {
    expect(skipTarget('units', A())).toBe('role');
    expect(skipTarget('theme', A())).toBe('role');
    expect(skipTarget('theme', A({ viaInvite: true }))).toBe('c_code');
  });
});

describe('skipTarget', () => {
  it('las preguntas de ajuste no se saltan: se vuelve con atrás', () => {
    expect(skipTarget('s_adjust', A({ role: 'self' }))).toBeNull();
  });

  it('la bifurcación no se puede saltar, ni la cuenta del entrenador ni su código', () => {
    for (const id of ['welcome', 'recover', 'r_trainer', 'r_code', 'r_client', 'role', 't_account', 't_code', 'done']) {
      expect(skipTarget(id, A({ role: 'trainer' }))).toBeNull();
    }
  });

  it('saltar un tramo lleva a lo siguiente con los valores por defecto', () => {
    expect(skipTarget('a_home', A())).toBe('done');
    expect(skipTarget('c_code', A({ role: 'coached' }))).toBe('a_home');
    expect(skipTarget('t_client', A({ role: 'trainer' }))).toBe('a_cards');
    expect(skipTarget('t_client', A({ role: 'trainer', alsoTrains: true }))).toBe('a_home');
  });

  it('desde la app solo se salta dentro del constructor', () => {
    expect(skipTarget('s_level', A(), 'newProgram')).toBeNull();
    expect(skipTarget('n_source', A(), 'newProgram')).toBeNull();
    expect(skipTarget('b_exercise', A({ programId: 'prog_1' }), 'newProgram')).toBe('n_done');
  });
});

describe('rutas de los caminos', () => {
  it('el entrenador solo invita con app y programa enviado', () => {
    expect(afterProgram(A({ clientMode: 'app', sent: true }))).toBe('t_invite');
    expect(afterProgram(A({ clientMode: 'app', sent: false }))).toBe('t_self');
    expect(afterProgram(A({ clientMode: 'self', sent: true }))).toBe('t_self');
  });

  it('el constructor sale según el camino', () => {
    expect(builderExit(A({ builderCtx: 'self' }))).toBe('a_home');
    expect(builderExit(A({ builderCtx: 'copy' }))).toBe('a_home');
    expect(builderExit(A({ builderCtx: 'trainer', clientMode: 'app', sent: true }))).toBe('t_invite');
    expect(builderExit(A({ builderCtx: 'trainer', clientMode: 'self' }))).toBe('t_self');
    expect(builderExit(A({ builderCtx: 'self', programId: 'prog_1' }), 'newProgram')).toBe('n_done');
  });

  it('desde la app, el constructor sin programa creado termina el recorrido', () => {
    expect(builderExit(A({ builderCtx: 'self' }), 'newProgram')).toBeNull();
    // y entonces «Saltar» no existe hasta que haya programa
    expect(skipTarget('b_sessions', A(), 'newProgram')).toBeNull();
    expect(skipTarget('b_sessions', A({ programId: 'prog_1' }), 'newProgram')).toBe('n_done');
  });

  it('las salidas del camino «con entrenador» van a Aprende, o terminan desde la app', () => {
    expect(coachedExit(A({ role: 'coached' }))).toBe('a_home');
    expect(coachedExit(A({ role: 'trainer' }))).toBe('a_cards');
    expect(coachedExit(A({ role: 'coached' }), 'newProgram')).toBeNull();
  });

  it('las propuestas salen a Aprende, o al final de «Nuevo programa»', () => {
    expect(afterProposal()).toBe('a_home');
    expect(afterProposal('newProgram')).toBe('n_done');
  });

  it('el entrenador que no entrena solo ve sus tarjetas', () => {
    expect(learnStart(A({ role: 'trainer' }))).toBe('a_cards');
    expect(learnStart(A({ role: 'trainer', alsoTrains: true }))).toBe('a_home');
    expect(learnStart(A({ role: 'self' }))).toBe('a_home');
  });
});

describe('progreso', () => {
  it('el tramo se llena con las pantallas vistas', () => {
    const a = A();
    expect(sectionProgress('units', ['welcome'], a)).toBe(0.5);
    expect(sectionProgress('theme', ['welcome', 'units'], a)).toBe(1);
    expect(sectionProgress('welcome', [], a)).toBe(0);
    expect(sectionProgress('done', [], a)).toBe(1);
  });

  it('volver y repetir una pantalla no suma dos veces', () => {
    expect(sectionProgress('units', ['welcome', 'units', 'theme'], A())).toBe(1);
  });

  it('los tramos anteriores van llenos y los siguientes vacíos', () => {
    expect(barFills('role', ['welcome', 'units', 'theme'], A())).toEqual([1, 1 / 3, 0, 0]);
    expect(barFills('done', [], A())).toEqual([1, 1, 1, 1]);
    expect(barFills('welcome', [], A())).toEqual([0, 0, 0, 0]);
  });

  it('la barra no baja al avanzar en el camino común', () => {
    const a = A({ role: 'trainer' });
    const route = ['welcome', 'units', 'theme', 'role', 't_clients', 't_groups', 't_client', 't_self', 'a_cards', 'done'];
    let prev = 0;
    route.forEach((id, i) => {
      const f = barFills(id, route.slice(0, i), a);
      const total = f.reduce((s, x) => s + x, 0);
      expect(total, id).toBeGreaterThanOrEqual(prev);
      prev = total;
    });
  });

  it('el total del tramo cambia con el camino: la barra no miente', () => {
    // «con entrenador» con código: solo código, programa encontrado y conectado
    const coached = A({ role: 'coached', coachApp: 'code' });
    expect(sectionProgress('c_confirm', ['c_code'], coached)).toBeCloseTo(2 / 3);
    // por invitación el tramo «Tú» es una sola pantalla
    expect(sectionProgress('role', [], A({ viaInvite: true }))).toBe(1);
  });
});

describe('deviceLanguage', () => {
  it('empieza por en → inglés; lo demás, español', () => {
    expect(deviceLanguage('en-US')).toBe('en');
    expect(deviceLanguage('EN')).toBe('en');
    expect(deviceLanguage('es-ES')).toBe('es');
    expect(deviceLanguage('fr-FR')).toBe('es');
    expect(deviceLanguage(undefined)).toBe('es');
  });
});

describe('initialRouteFor', () => {
  const base = { flow: null, onboardingCompleted: false, hasProgram: false, hasActiveSession: false };

  it('instalación limpia → Start', () => {
    expect(initialRouteFor(base)).toBe('Start');
  });

  it('con programa o con el onboarding hecho, la app de siempre', () => {
    expect(initialRouteFor({ ...base, hasProgram: true })).toBe('Main');
    expect(initialRouteFor({ ...base, onboardingCompleted: true })).toBe('Main');
    expect(initialRouteFor({ ...base, hasProgram: true, hasActiveSession: true })).toBe('Workout');
  });

  it('un recorrido en curso manda aunque el constructor ya haya creado un programa', () => {
    const flow = newFlow('first');
    expect(initialRouteFor({ ...base, flow, hasProgram: true, onboardingCompleted: true })).toBe('Start');
  });

  it('un «Nuevo programa» a medias no secuestra el arranque', () => {
    const flow = newFlow('newProgram');
    expect(initialRouteFor({ ...base, flow, hasProgram: true, onboardingCompleted: true })).toBe('Main');
  });
});

describe('canGoBack', () => {
  it('con historial sí; en la bienvenida y en el cierre no', () => {
    expect(canGoBack(newFlow())).toBe(false);
    expect(canGoBack({ ...newFlow(), screen: 'units', history: ['welcome'] })).toBe(true);
    expect(canGoBack({ ...newFlow(), screen: 'done', history: ['a_cards'] })).toBe(false);
    expect(canGoBack(null)).toBe(false);
  });
});

describe('newFlow', () => {
  it('empieza en la bienvenida, o en el selector si viene de la app', () => {
    expect(newFlow().screen).toBe('welcome');
    expect(newFlow('newProgram').screen).toBe('n_source');
    expect(newFlow('newProgram').entry).toBe('newProgram');
  });
});

describe('constructor sin paso de progresión (O03-03)', () => {
  it('b_prog ya no existe y los pasos del constructor saltan a la salida', () => {
    expect(sectionOf('b_prog')).toBe(-1);
    expect(skipTarget('b_prog', A({ builderCtx: 'self' }))).toBeNull();
    for (const id of ['b_sessions', 'b_exercise', 'b_volume', 'b_done']) {
      expect(skipTarget(id, A({ builderCtx: 'self' }))).toBe('a_home');
    }
  });

  it('el tramo del constructor espera cuatro pantallas', () => {
    const a = A({ role: 'trainer', clientMode: 'self', programSource: 'builder', builderCtx: 'trainer' });
    const seen = ['t_client', 'b_sessions', 'b_exercise', 'b_volume'];
    expect(sectionProgress('b_done', seen, a)).toBeCloseTo(5 / 7);
  });
});

describe('entryTab — la pestaña de entrada (§7.9)', () => {
  it('Clientes para el entrenador que no entrena; Inicio en lo demás', () => {
    expect(entryTab({ homeTab: 'Clients', proTabsHidden: false })).toBe('Clients');
    expect(entryTab({ homeTab: 'Home' })).toBe('Home');
    expect(entryTab({})).toBe('Home');
    expect(entryTab(undefined)).toBe('Home');
  });

  it('con las pestañas de entrenador ocultas no hay Clientes: Inicio', () => {
    expect(entryTab({ homeTab: 'Clients', proTabsHidden: true })).toBe('Home');
  });
});
