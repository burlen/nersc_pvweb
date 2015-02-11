#!/bin/bash

if [[ $# -ne  1 ]]
then
    echo '{"status":"ERROR"}'
    echo 'bad number of arguments' >&2
fi

JID=$1
JERF=$HOME/$JID.ER

echo "JID=$JID" >2&
echo "JERF=$JERF" >2&

if [[ ! -e $JERF ]]
then
    echo '{"status":"ERROR"}'
    echo 'job output not found' >&2
else
    #cat $JERF | grep -q "Client connected."
    cat $JERF | grep -q "Starting factory"
    ready=$?
    if [[ "$ready" == "0" ]]
    then
        echo '{"status":"READY"}'
    else
        echo '{"status":"BUSY"}'
    fi

fi

