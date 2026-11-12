#!/bin/sh
# Resizes ChatGPT's images to the exact sizes App Store Connect accepts.
# ChatGPT's downloads are never the exact size, so always run this before uploading.
#   sh size-for-upload.sh                      sizes everything in finished/
#   sh size-for-upload.sh ~/Downloads/x.png    sizes just the files you name
# Writes upload/6.9/ and upload/6.3/. See 02-chatgpt-prompts.md.
here="$(cd "$(dirname "$0")" && pwd)" || exit 1
if [ $# -eq 0 ]; then set -- "$here"/finished/*; fi

size() { # file, width, height, folder
  in_w=$(sips -g pixelWidth "$1" | awk '/pixelWidth/ {print $2}')
  in_h=$(sips -g pixelHeight "$1" | awk '/pixelHeight/ {print $2}')
  # Scale to cover the target, then trim whatever's left over from the middle.
  by_w=$(awk "BEGIN { print ($2 / $in_w >= $3 / $in_h) }")
  out="$here/upload/$4/$(basename "${1%.*}").jpg"
  if [ "$by_w" = 1 ]; then scale="--resampleWidth $2"; else scale="--resampleHeight $3"; fi
  # shellcheck disable=SC2086
  sips -s format jpeg -s formatOptions 95 $scale "$1" --out "$out" >/dev/null &&
    sips --cropToHeightWidth "$3" "$2" "$out" >/dev/null
  echo "$out  $(sips -g pixelWidth -g pixelHeight "$out" | awk '/pixel/ {print $2}' | paste -sd x -)"
}

mkdir -p "$here/upload/6.9" "$here/upload/6.3"
status=0
for file in "$@"; do
  [ -f "$file" ] || continue
  w=$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')
  h=$(sips -g pixelHeight "$file" | awk '/pixelHeight/ {print $2}')
  if ! awk "BEGIN { r = $h / $w; exit !(r >= 2.12 && r <= 2.23) }"; then
    echo "WRONG SHAPE, skipped: $file is $w x $h. Regenerate it at 1328 x 2880."
    status=1
    continue
  fi
  if [ "$w" -lt 1100 ]; then
    echo "Note: $(basename "$file") is only $w px wide, so it gets enlarged and may look slightly soft."
  fi
  size "$file" 1320 2868 6.9
  size "$file" 1206 2622 6.3
done
exit $status
