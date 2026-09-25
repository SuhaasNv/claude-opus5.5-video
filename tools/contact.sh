#!/usr/bin/env bash
# usage: tools/contact.sh out.png f0078 f0126 ...   → 2-column contact sheet of out/stills frames
set -e
FF=${FFMPEG:-ffmpeg}; OUT=$1; shift
n=$#; rows=$(( (n+1)/2 ))
args=(); for f in "$@"; do args+=(-i "out/stills/$f.png"); done
$FF -y -loglevel error "${args[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf "[$i]scale=960:540[s$i];"; done; for i in $(seq 0 $((n-1))); do printf "[s$i]"; done; printf "concat=n=$n:v=1:a=0,tile=2x$rows")" -frames:v 1 "$OUT"
