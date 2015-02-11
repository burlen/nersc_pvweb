#!/bin/bash

if [[ $# -ne 1 ]]
then
    echo "Error: required key file name missing." 1>&2
    exit 1
fi

key=$1
key_file=$HOME/.ssh/authorized_keys

if [[ ! -e $key || ! -e $key.pub ]]
then
    ssh-keygen -q -t rsa -f $key -N ""
    chmod 600 $key.pub
    cat $key.pub >> $key_file
fi
