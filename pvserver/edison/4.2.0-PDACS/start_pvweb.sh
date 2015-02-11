#!/bin/bash

if [ $# != 8 ]
then
  echo "Usage: start_pvserver.sh NCPUS WALLTIME ACCOUNT PORT"
  echo
  echo "  NCPUS     - number of processes in mutiple of 16."
  echo "  NCPUS_PER_SOCKET - number of processes per socket. 2 sockets per node."
  echo "  WALLTIME  - wall time in HH:MM:SS format."
  echo "  ACCOUNT   - account name to run the job against."
  echo "  QUEUE     - the queue to use."
  echo "  DATA_FILE - path to file to open."
  echo "  WEB_HOST  - host to connect back to."
  echo "  WEB_PORT  - port number on the web host to target."
  echo
  echo "assumes a reverse tunel is set up on localhost to the remote site."
  echo
fi

NCPUS=$1
NCPUS_PER_SOCKET=$2
NCPUS_PER_NODE=`echo 2*$NCPUS_PER_SOCKET | bc`
NNODES=`echo $NCPUS/$NCPUS_PER_NODE | bc`
(( NNODES = NNODES<1 ? 1 : $NNODES ))
MEM=`echo 64*$NNODES | bc`
WALLTIME=$3
ACCOUNT=$4
if [[ "$ACCOUNT" == "default" ]]
then
  ACCOUNT=`/usr/common/usg/bin/getnim -U $USER -D | cut -d" " -f1`
fi
if [[ -z "$ACCOUNT" ]]
then
  echo '{"status":"ERROR", "jid":""}'
  echo "ERROR: NIM failed to lookup account" 1>&2
  exit 1
else
  ACCOUNTS=`/usr/common/usg/bin/getnim -U $USER | cut -d" " -f1 | tr '\n' ' '`
fi
QUEUE=$5
DATA_FILE=$6
WEB_HOST=$7
WEB_PORT=$8
LOGIN_HOST=`/bin/hostname`
let SERVER_PORT=$WEB_PORT+100

# note: mesa  maxes out at 16
# 12 physical cores per socket, 24 with hyperthread
RENDER_THREADS=`echo 24/$NCPUS_PER_SOCKET`
(( RENDER_THREADS = RENDER_THREADS<1 ? 1 : $RENDER_THREADS ))
(( RENDER_THREADS = RENDER_THREADS>16 ? 16 : $RENDER_THREADS ))

PV_VER_SHORT=4.2
PV_VER_FULL=4.2.0
PV_HOME=/usr/common/graphics/ParaView/$PV_VER_FULL-PDACS/
MESA_HOME=/usr/common/graphics/mesa/10.4.3/llvmpipe/shared/
LLVM_HOME=/usr/common/graphics/llvm/3.6/shared/
GLU_HOME=/usr/common/graphics/glu/9.0.0/shared/
NCAT_HOME=/usr/common/graphics/ParaView/nmap-6.25

module swap PrgEnv-intel PrgEnv-gnu/5.2.25
module swap PrgEnv-gnu PrgEnv-gnu/5.2.25
module load python/2.7.5
#module load mesa/9.2.2-llvmpipe-dso

# setup for key based auth
WEB_KEY=$HOME/.ssh/pvweb_key
$PV_HOME/pvweb_key_based_auth.sh $WEB_KEY
if [[ ! -e  "$WEB_KEY" ]]
then
    echo '{"status":"ERROR", "jid":""}'
    echo "ERROR: Key-based authentication is not set up"
    exit 1
fi

PV_LD_LIBRARY_PATH=$PV_HOME/lib:$PV_HOME/lib/paraview-$PV_VER_SHORT:$PV_HOME/lib/system-libs:$LLVM_HOME/lib:$MESA_HOME/lib:$GLU_HOME/lib/:/usr/common/usg/python/2.7.5/lib
PV_PATH=$PV_HOME/bin:$NCAT_HOME/bin:$LLVM_HOME/bin

export PV_HOME
export PV_LD_LIBRARY_PATH
export PV_PATH
export PV_NCAT_PATH=$NCAT_HOME/bin
export PV_PORT=$PORT
export PV_NCPUS=$NCPUS
export PV_NCPUS_PER_SOCKET=$NCPUS_PER_SOCKET
export PV_RENDER_THREADS=$RENDER_THREADS
export PV_WEB_HOST=$WEB_HOST
export PV_WEB_PORT=$WEB_PORT
export PV_WEB_KEY=$WEB_KEY
export PV_SERVER_PORT=$SERVER_PORT
export PV_DATA_FILE=$DATA_FILE

JID=`qsub -V -N PVWEB-$PV_VER_FULL-PDACS -A "$ACCOUNT" -q "$QUEUE" -l mppwidth=$NCPUS -l mppnppn=$NCPUS_PER_NODE -l walltime=$WALLTIME $PV_HOME/start_pvweb.qsub`
ERRNO=$?
if [[ $ERRNO -ne 0 ]]
then
    echo '{"status":"ERROR", "jid":""}'
    echo "ERROR: qsub failed" 1>&2
    exit 1
fi
echo '{"status":"OK", "jid":"'$JID'"}'
