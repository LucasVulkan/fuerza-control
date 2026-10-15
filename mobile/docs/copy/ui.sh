#!/usr/bin/env bash
# Ayudante adb para las capturas de copy (ver inventario-capturas.md).
#   ui.sh ls                 → textos en pantalla con su centro (x,y) en píxeles reales
#   ui.sh tap "Texto"        → toca el primer elemento cuyo texto/desc contenga «Texto»
#   ui.sh tapxy X Y          → toca en coordenadas reales (1080×2520)
#   ui.sh swipe up|down      → desplaza la pantalla
#   ui.sh back               → botón atrás
#   ui.sh shot NOMBRE        → guarda capturas/NOMBRE.png y la deja para mirar
#   ui.sh type "texto"       → escribe (espacios incluidos)
export MSYS_NO_PATHCONV=1
A=/c/Users/lucas/AppData/Local/Android/Sdk/platform-tools/adb
DIR="$(cd "$(dirname "$0")" && pwd)/capturas"; mkdir -p "$DIR"
# uiautomator falla a ratos si hay animaciones en marcha: reintenta.
dump() { for i in 1 2 3 4; do $A shell rm -f /sdcard/ui.xml; $A shell uiautomator dump /sdcard/ui.xml 2>&1 | grep -q dumped && break; $A shell sleep 1; done; $A exec-out cat /sdcard/ui.xml; }
nodes() { dump | grep -oE '<node [^>]*>' | sed -nE 's/.*text="([^"]*)".*content-desc="([^"]*)".*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1|\2|\3|\4|\5|\6/p' \
  | awk -F'|' '($1!="" || $2!="") { printf "%s%s\t(%d,%d)\n", $1, ($2!="" ? " ["$2"]" : ""), ($3+$5)/2, ($4+$6)/2 }'; }
case "$1" in
  ls)    nodes ;;
  tap)   line=$(nodes | awk -v q="$2" 'index(tolower($0), tolower(q)) { print; exit }')
         [ -z "$line" ] && { echo "NO ENCONTRADO: $2"; exit 1; }
         xy=$(echo "$line" | grep -oE '\([0-9]+,[0-9]+\)$' | tr -d '()' | tr ',' ' ')
         $A shell input tap $xy; $A shell sleep 1; echo "tocado: $line" ;;
  tapxy) $A shell input tap "$2" "$3"; $A shell sleep 1 ;;
  swipe) if [ "$2" = up ]; then $A shell input swipe 540 1900 540 700 400; else $A shell input swipe 540 700 540 1900 400; fi; $A shell sleep 1 ;;
  back)  $A shell input keyevent BACK; $A shell sleep 1 ;;
  type)  $A shell input text "$(echo "$2" | sed 's/ /%s/g')" ;;
  shot)  $A exec-out screencap -p > "$DIR/$2.png"; echo "$DIR/$2.png" ;;
  *)     sed -n 2,9p "$0" ;;
esac
