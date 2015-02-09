#!/bin/bash

pv_home=/var/www/ParaView/4.2.0
nersc_pvweb_home=/var/www/ParaView/www/nersc_pvweb
sm_home=$nersc_pvweb_home/session_manager
nersc_host=missmarple

$sm_home/start_session_manager.sh $pv_home $nersc_pvweb_home $nersc_host
