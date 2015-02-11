#!/bin/bash

if [ $# != 6 ]
then
  echo "Usage: start_pvserver.sh NCPUS WALLTIME ACCOUNT PORT"
  echo
  echo "  NCPUS     - number of processes in mutiple of 16."
  echo "  NCPUS_PER_SOCKET - number of processes per socket. 2 sockets per node."
  echo "  WALLTIME  - wall time in HH:MM:SS format."
  echo "  ACCOUNT   - account name to run the job against."
  echo "  QUEUE     - the queue to use."
  echo "  PORT      - the port number of the server side tunnel."
  echo
  echo "assumes a reverse tunel is set up on localhost to the remote site."
  echo
  sleep 1d
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
  echo
  echo "ERROR: NIM Failed to lookup your account. If you know"
  echo "       your accounts please set one manually in the"
  echo "       connection dialog. Your default will be used."
  echo
#  sleep 1d
else
  ACCOUNTS=`/usr/common/usg/bin/getnim -U $USER | cut -d" " -f1 | tr '\n' ' '`
fi
QUEUE=$5
PORT=$6
LOGIN_HOST=`/bin/hostname`
let LOGIN_PORT=$PORT+1

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

module swap PrgEnv-intel PrgEnv-gnu/5.2.40
module swap PrgEnv-gnu PrgEnv-gnu/5.2.40
module load python/2.7.5
#module load mesa/9.2.2-llvmpipe-dso

PV_LD_LIBRARY_PATH=$PV_HOME/lib:$PV_HOME/lib/paraview-$PV_VER_SHORT:$PV_HOME/lib/system-libs:$LLVM_HOME/lib:$MESA_HOME/lib:$GLU_HOME/lib/:/usr/common/usg/python/2.7.5/lib
PV_PATH=$PV_HOME/bin:$NCAT_HOME/bin:$LLVM_HOME/bin

echo '=============================================================='
echo '   ___               _   ___                ____   ___   ___  '
echo '  / _ \___ ________ | | / (_)__ _    ______/ / /  |_  | / _ \ '
echo ' / ___/ _ `/ __/ _ `/ |/ / / -_) |/|/ /___/_  _/ / __/_/ // / '
echo '/_/   \_,_/_/  \_,_/|___/_/\__/|__,__/     /_/(_)____(_)___/  '
echo '=============================================================='
echo 'PDACS'
echo "Please be patient, it may take some time for the job to pass through the queue."
echo "KEEP THIS TERMINAL OPEN WHILE USING PARAVIEW"
echo
echo "Setting environment..."
#echo "LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
#echo "PATH=$PATH"
echo "ACCOUNTS=$ACCOUNTS"
echo "ACCOUNT=$ACCOUNT"
echo "NCPUS=$NCPUS"
echo "NCPUS_PER_SOCKET=$NCPUS_PER_SOCKET"
echo "NCPUS_PER_NODE=$NCPUS_PER_NODE"
echo "NNODES=$NNODES"
echo "MEM=$MEM\GB"
echo "RENDER_THREADS=$RENDER_THREADS"
echo "WALLTIME=$WALLTIME"
echo "PORT=$PORT"
echo "ACCOUNT=$ACCOUNT"
echo "QUEUE=$QUEUE"
echo "LOGIN_HOST=$LOGIN_HOST"
echo "LOGIN_PORT=$LOGIN_PORT"
echo "LINK_TYPE=shared"

$NCAT_HOME/bin/ncat -l $LOGIIN_HOST $LOGIN_PORT --sh-exec="$NCAT_HOME/bin/ncat localhost $PORT" &

echo "Starting ParaView via qsub..."

# pass these to the script
export PV_HOME
export PV_LD_LIBRARY_PATH
export PV_PATH
export PV_NCAT_PATH=$NCAT_HOME/bin
export PV_PORT=$PORT
export PV_NCPUS=$NCPUS
export PV_NCPUS_PER_SOCKET=$NCPUS_PER_SOCKET
export PV_RENDER_THREADS=$RENDER_THREADS
export PV_LOGIN_HOST=$LOGIN_HOST
export PV_LOGIN_PORT=$LOGIN_PORT
JID=`qsub -V -N PV-$PV_VER_FULL-PDACS-$PORT -A "$ACCOUNT" -q "$QUEUE" -l mppwidth=$NCPUS -l mppnppn=$NCPUS_PER_NODE -l walltime=$WALLTIME $PV_HOME/start_pvserver.qsub`
ERRNO=$?
if [ $ERRNO == 0 ]
then
echo "Job submitted succesfully."
else
echo "ERROR $ERRNO: in job submission."
fi

# monitor the batch system and provide
# a simple UI for probing job status
JIDNO=`echo $JID | cut -d. -f1`
JERRF=~/PV-$PV_VER_FULL-$PORT.e$JIDNO
/usr/common/graphics/ParaView/batchsysmon.sh $JID $JERRF
