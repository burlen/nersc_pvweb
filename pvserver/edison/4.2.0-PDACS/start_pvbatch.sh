#!/bin/bash

if [ $# != 7 ]
then
  echo "Usage: start_pvbatch.sh NCPUS WALLTIME ACCOUNT QUEUE SCRIPT"
  echo
  echo "  NCPUS     - number of processes in mutiple of 24."
  echo "  NCPUS_PER_SOCKET - number of processes per socket. 4 sockets per node."
  echo "  RENDER_THREADS - number of threads to use during rendring."
  echo "  WALLTIME  - wall time in HH:MM:SS format."
  echo "  ACCOUNT   - account name to run the job against."
  echo "  QUEUE     - the queue to use."
  echo "  SCRIPT    - full path to the batch script to exec."
  echo
  exit -1
fi

NCPUS=$1
NCPUS_PER_SOCKET=$2
NCPUS_PER_NODE=`echo 2*$NCPUS_PER_SOCKET | bc`
NNODES=`echo $NCPUS/$NCPUS_PER_NODE | bc`
(( NNODES = NNODES<1 ? 1 : $NNODES ))
MEM=`echo 64*$NNODES | bc`
RENDER_THREADS=$3
(( RENDER_THREADS = RENDER_THREADS<1 ? 1 : $RENDER_THREADS ))
WALLTIME=$4
ACCOUNT=$5
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
QUEUE=$6
SCRIPT=$7

# note: mesa  maxes out at 16
# 12 physical cores per socket, 24 with hyperthread
RENDER_THREADS=`echo 24/$NCPUS_PER_SOCKET`
(( RENDER_THREADS = RENDER_THREADS<1 ? 1 : $RENDER_THREADS ))
(( RENDER_THREADS = RENDER_THREADS>16 ? 16 : $RENDER_THREADS ))

PV_VER_SHORT=4.2
PV_VER_FULL=4.2.0
PV_HOME=/usr/common/graphics/ParaView/$PV_VER_FULL/
MESA_HOME=/usr/common/graphics/mesa/9.2.2/llvmpipe/shared/
GLU_HOME=/usr/common/graphics/glu/9.0.0/shared/
NCAT_HOME=/usr/common/graphics/ParaView/nmap-6.25

module swap PrgEnv-intel PrgEnv-gnu/5.2.25
module load python/2.7.5

PV_LD_LIBRARY_PATH=$PV_HOME/lib:$PV_HOME/lib/paraview-$PV_VER_SHORT:$PV_HOME/lib/system-libs:$MESA_HOME/lib:$GLU_HOME/lib/:/usr/common/usg/python/2.7.5/lib
PV_PATH=$PV_HOME/bin:$NCAT_HOME/bin:$LLVM_HOME/bin

echo '=========================================================='
echo '             __        __      __       ____   ___   ___  '
echo '   ___ _  __/ /  ___ _/ /_____/ /  ____/ / /  |_  | / _ \ '
echo '  / _ \ |/ / _ \/ _ `/ __/ __/ _ \/___/_  _/ / __/_/ // / '
echo ' / .__/___/_.__/\_,_/\__/\__/_//_/     /_/(_)____(_)___/  '
echo '/_/                                                       '
echo '=========================================================='
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

echo "Starting ParaView via qsub..."

# pass these to the script
export PV_HOME
export PV_LD_LIBRARY_PATH
export PV_PATH
export PV_NCPUS=$NCPUS
export PV_NCPUS_PER_SOCKET=$NCPUS_PER_SOCKET
export PV_RENDER_THREADS=$RENDER_THREADS
export PV_BATCH_SCRIPT=$SCRIPT
JID=`qsub -V -N PV-$PV_VER_FULL-batch -A "$ACCOUNT" -q "$QUEUE" -l mppwidth=$NCPUS -l mppnppn=$NCPUS_PER_NODE -l walltime=$WALLTIME $PV_HOME/start_pvbatch.qsub`
ERRNO=$?
if [ $ERRNO == 0 ]
then
  echo "Job submitted succesfully."
  qstat $JID
else
  echo "ERROR $ERRNO: in job submission."
fi
