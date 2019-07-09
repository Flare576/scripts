#!/bin/sh
zoom="$HOME/.zoomus"
LOGINITEMS=$(osascript -e 'tell application "System Events" to get the name of every login item')
if [[ $LOGINITEMS =~ "ZoomOpener" ]]; then
  echo "Removing ZoomOpener from startup items"
  osascript -e 'tell application "System Events" to delete login item "ZoomOpener"' 
else
  echo "Zoom process not listed in startup"
fi

if [ -d "$zoom" ]; then
  echo "Deleting $zoom"
  rm -rf $zoom
elif [ -s "$zoom" ]; then
  echo "Found a non-empty file where $zoom folder should be; to be safe, not altering file and aborting process"
  exit 1;
fi

PROCESSES=$(ps aux | grep zoom | wc -l)
if [ $PROCESSES -gt 1 ]; then
  echo "Killing zoom process"
  killall -9 ZoomOpener
else
  echo "Zoom process not running, nothing to kill"
fi

if [ ! -f "$zoom" ]; then
  echo "Replacing $zoom with dummy file to prevent future creation"
  touch -f $zoom
elif [ ! -s "$zoom" ]; then
  echo "Dummy $zoom file already present; You probably ran the script twice, no big deal."
fi

echo "Setting Zoom to default to video off"
defaults write $HOME/Library/Preferences/us.zoom.config.plist ZDisableVideo 1

echo "You're a little safer now"
