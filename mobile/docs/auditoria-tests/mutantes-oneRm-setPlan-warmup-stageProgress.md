# Huecos (b) clasificados a mano (Opus) — oneRm, setPlan, warmup, stageProgress

Formato: línea:col del fuente · mutante · entrada → esperado · cita.

## oneRm.js (P10 §2.2/§2.3 y «fallos de QA» del final de P10; T02 §1)
- 23 `!w && w<=0` / `w<=0→false` · epley1RM(-100, 5) → null · P10 §2.2 «las que den `null` no cuentan» (sin peso válido no hay e1RM).
- 23:29 `!r→false` · epley1RM(100, '') → null · ídem.
- 25:7 `rpe>5` · epley1RM(100, 5, 5) → 133,33 (5 + 5 en recámara = 10RM) · P10 «suma la recámara con RPE 5-10».
- 25:22 `rpe<=10→true` · epley1RM(100, 5, 11) → 116,67 (fuera de 5-10 cuenta como al fallo) · P10 «fuera de ahí la serie cuenta como hecha al fallo».
- 28 `r>=12` · epley1RM(100, 12) → 140 (12 todavía vale) · P10 §2.2 «devuelve `null` por encima de `MAX_RELIABLE_REPS = 12`».
- 45:9 `w>=0` · e1rmAtLeast(0, 5, 8) → null. 45:21 `r>1` · e1rmAtLeast(100, 1, 8) → 110 (1 + 2 en recámara = 3RM). 45:34 `p>=0` · e1rmAtLeast(100, 5, 0) → null (sin RPE). Cita: P10 «RPE < 5 cuenta como 5 y más de 12 reps equivalentes como 12» + §2.2 paso 1 (series con peso, reps y RPE).
- 47 `eq===1→false` · e1rmAtLeast(100, 1, 10) → 100 · P10 §2.2 «r === 1 → e1rm» (mismo modelo que la inversa).
- 58:22 `r<1→false` · weightForReps(100, 0, 10) → null · b? (la spec no dice r<1) → NO escribir; anotar.
- 68 (`true`, `&&`, `false`) · bestSetE1RM([100×5@8 hecha, 80×5@8 hecha]) → 123,33 (la mejor, no la última) · T02 tabla `e1rm` «mejor e1RM»; P10 §2.2 ejemplo 80×5@8 → 98,7.
- 88 (`true`, `&&`, `false`) · recentE1RM con dos logs dentro de la ventana, el primero 100×5@8 y el segundo (más reciente) 80×5@8 → value 123,33 y timestamp del primero · docstring «best e1RM over the last weeks» (T02).
- 66 `s.done && s.weight` · bestSetE1RM([{weight:'100',reps:'5',rpe:'8',done:false}]) → ¿cuenta? → b? (la spec no lo fija) → NO escribir; anotar.
- Equivalentes (a): 23:13 `w<0`, 25:22 `rpe<10`, 65 y 85 `?? []`→array con texto, 66 `→false` y `→true`, 68:41 `v>=best`, 86 `<=cutoff`. Nulo (n): 87 `exercise.sets`.

## setPlan.js (P12 §4.5)
- 15:33 `has→ v!==''` · overrideEx {weight: null} y plan con chip up 62,5 → weight {value:'62.5', source:'plan'} (null no es valor) · P12 §4.5 «Por campo, el primero que tenga valor».
- 15:39 `''→texto` · overrideEx {weight: ''} → igual, source 'plan' · ídem.
- 58:7 `→true` · (1) chip {type:'hold', suggestedWeight:60, suggestedReps:9} y lastSets[0].reps '10' → reps {value:'10', source:'last'} · P12 §4.5 «En mantener, el gris es lo que hiciste (decisión 4)». (2) chip {effort:true, type:'up', suggestedWeight:80, suggestedReps:7} con minReps 5 → reps '5' source plan · P12 §4.5 «chip.effort → … reps = minReps».
- Nulo (n): 37, 38, 51 (×2), 53.

## warmup.js (T05)
- 62 (`true`, `||`, `w>=0`, `best==null→false`) · resolveWorkWeight(null, {sets:[60,80,70 hechas]}, null) → 80; y con todas a '0' y tecleado '50' → '50' (o 50, lo que reciba) · T05 §2 «Top set weight from the last logged session» — confirmar la cita en T05.
- 21/22 NOCOV · warmupSteps({mode:'custom'}) → [] y warmupSteps({mode:'auto', sets: 99}) → [] · b de poco valor: escribir solo si T05 lo dice.
- (a) 62:48 `w>=best`.

## weekProgress.js
- (a) 44 `date>=today` (hoy ya lo trata la rama anterior).

## stageProgress.js (P08, C03, C04)
- 378 ObjectLiteral → {} · closeOpenStage con etapa sin techo, empezada hace 3 semanas → durationWeeks = semana en curso − 1 (no 1) · buscar en P08/P14 la regla de cerrar una etapa abierta.
- 412 `→false` · progressChanged(a, b) con un campo de progreso distinto → true · C04 §3.2 a.
- 440:22/440:30 `→true` · mergeProgressOnImport con blob de OTRO programa (programId distinto) → no se conserva su progreso (reset a la etapa del programa) · comentario «No blob for THIS program means a different program arrived»; buscar cita en C03/P08. Comprobar también currentStageIndex (la arqueología vio que el test actual solo mira stageSessionsDone).
- 487 `→false` · fromLegacyProgress con totalWeeksCompleted > 0 → programStartedOn = lunes − 7·total · P08 (migración).
- 86 `length >= 0` · ensureStages({stages: [], days: [...]}) → una etapa «Etapa 1» con esos días · P08/P03.
- 91:89 · ensureStages con una etapa sin `days` → days [] .
- 78/97 nombre por defecto 'Etapa 1' · cubierto por el caso de 86.
- (a) 62, 298, 301, 314 (×5). (n) el resto de OptionalChaining, 79, 107.
