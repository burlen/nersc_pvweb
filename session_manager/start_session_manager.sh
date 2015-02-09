#!/bin/bash

if [[ $# -ne 2 ]]
then
    echo "error:" 1>&2
    echo "  usage:" 1>&2
    echo "    start_session_manager.sh pv_home nersc_pvweb_home nersc_host" 1>&2
    echo 1>&2
    exit 1
fi

pv_home=$1
nersc_pvweb_home=$2
sm_home=$nersc_pvweb_home/session_manager
nersc_host=$3

#nohup \

    $pv_home/bin/pvpython \
        $sm_home/nersc_pvweb_session_manager.py \
        -d $sm_home/$nersc_host.smconf \

#        > nohup2.out 2>&1 &
