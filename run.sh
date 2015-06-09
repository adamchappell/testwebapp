#!/bin/sh

trap true HUP

while true ; do
        ./testserver.js RGraph.* index.html excanvas.js >/dev/null 2>&1
        sleep 15
done

