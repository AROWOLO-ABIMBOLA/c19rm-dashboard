#!/usr/bin/env bash
# Fetches the five oxygen photographs from Drive, resizes them for the web and
# writes them into assets/img/oxygen/ — ready to commit. Nothing to move by hand.
#
#   cd <your repo>            <- must be the repo root
#   chmod +x fetch-oxygen-images.sh
#   ./fetch-oxygen-images.sh
#
set -uo pipefail

OUT="assets/img/oxygen"
FAIL=0

# ---- checks before we start -------------------------------------------------
command -v curl >/dev/null || { echo "curl is not installed. Aborting."; exit 1; }
if command -v magick >/dev/null; then IM=magick
elif command -v convert >/dev/null; then IM=convert
else
  echo "ImageMagick is not installed."
  echo "  macOS:  brew install imagemagick"
  echo "  Ubuntu: sudo apt install imagemagick"
  exit 1
fi
[ -d .git ] || echo "Note: no .git here — are you in the repo root? Continuing anyway."

mkdir -p "$OUT"
echo "Writing to $OUT/"
echo

download() {                       # $1 = Drive file id, $2 = slug, $3 = label
  printf '  %-18s ' "$2"
  tmp="$OUT/$2.tmp"
  curl -sL --max-time 90 "https://lh3.googleusercontent.com/d/$1=w1600" -o "$tmp"

  # Drive returns an HTML error page if the file is not publicly shared —
  # catch that here rather than letting ImageMagick fail confusingly.
  if [ ! -s "$tmp" ]; then
    echo "FAILED (empty response)"; rm -f "$tmp"; FAIL=1; return
  fi
  case "$(file -b --mime-type "$tmp")" in
    image/*) ;;
    *) echo "FAILED — Drive did not return an image."
       echo "                     Check the folder is shared as 'Anyone with the link'."
       rm -f "$tmp"; FAIL=1; return ;;
  esac

  # 1400px wide, quality 78, metadata stripped, progressive
  if $IM "$tmp" -resize 1400x -quality 78 -strip -interlace Plane "$OUT/$2.jpg" 2>/dev/null; then
    rm -f "$tmp"
    printf 'ok  %s  (%s)\n' "$(du -h "$OUT/$2.jpg" | cut -f1)" "$3"
  else
    echo "FAILED (resize)"; rm -f "$tmp"; FAIL=1
  fi
}

download 1Pyq_DTrFlgdvQLTdTz3ft6OSmjGCRP2G bwari-psa       "FCT · PSA plant"
download 1XoR48RJFISqZufPOwksrrTZ8Ii7fkdnK osun-bedside    "Osun · bedside outlet"
download 1yOCXONfFJ1XHljaZdmpgjs8ns-JNT82Q yobe-lox        "Yobe · bulk LOX tank"
download 19cIGBg2NoacdfjesArpdT8qgD5N2yLkP gwoza-psa       "Borno · PSA plant"
download 1NFbIzKMTLnJBXzkBvm_VfCeHJZohQqfT sokoto-oximeter "Sokoto · pulse oximeter"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "All five saved. Next:"
  echo "  git add $OUT"
  echo "  git commit -m 'Add oxygen site photographs'"
  echo "  git push"
else
  echo "Some downloads failed — see above. The page still works: any missing"
  echo "photo falls back to the Drive CDN, then to a tinted plate."
fi
