#!/bin/bash

pv_home=/usr/common/graphics/ParaView/4.2.0
nersc_pvweb_home=/usr/common/graphics/ParaView/PDACS/www/nersc_pvweb/
sm_home=$nersc_pvweb_home/session_manager
nersc_host=portal-auth

$sm_home/start_session_manager.sh $pv_home $nersc_pvweb_home $nersc_host
