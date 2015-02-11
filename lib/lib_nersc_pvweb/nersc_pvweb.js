var nersc_pvweb = nersc_pvweb || {
    /**
    @typedef session_data
    @type {Object}
    @property {string} port - port number that is the target of the web socket
    @property {string} host - hostname that is the target of the web socket (localhost)
    @property {string} id - session id, key for all tranmsaactions with the session manager
    @property {string} sessionURL - url to connect with
    */

    /**
    @typedef session_metadata
    @type {object}
    @property {session_object} session - data retruned from the session_manager
    @property {job_parameters} job_params - data describing the job
    @property {string} job_id - batch queue job id
    @property {number} uid - unique (to this page) identifier
    @property {boolean} ready - true when safe to connect
    */

    /**
    @typedef job_parameters
    @type {object}
    @property {string} hpc_resource - one of NERSC's system names (eg edison)
    @property {string} num_cores - number of cores to run the job with
    @property {string} cores_per_socket - cores per socket describes layout and determins number of compute nodes
    @property {string} walltime - max job run time in hh:mm:ss format
    @property {string} count - account to charge compute time to
    @property {string} queue - queue to submit the job in
    @property {string} data_file - file name to load in paraview on startup
    */

    /**
    @function launch_job
    launches a new ParaView web job described by the passed in
    paramters.
    @param {job_parameters} job_params - description of the job
    */
    launch_job : function(job_params) {
        nersc_pvweb.get_user_create_session_submit_job(job_params)
    },


    /**
    @function set_web_host
    sets the fully qualified domain name of the apache web server. by default
    set to portal-auth.nersc.gov
    @param {string} fqdn - fully quallified domain name of the apache server
    */
    set_web_host : function (fqdn) {
        nersc_pvweb.web_host = fqdn
    },

    /**
    @function set_paraview_prefix
    sets the path to the paraview installs on the given system.
    @param sys_name - NERSC system name eg 'edison'
    @param path - path to ParaView installs
    */
    set_paraview_prefix : function(sys_name, path) {
        nersc_pvweb.pv_paths[sys_name] = path
    },

    /**
    @function set_paraview_version
    sets the version of paraview to use.
    @param ver - version of ParaView to use.
    */
    set_paraview_version : function (ver) {
        nersc_pvweb.pv_ver_full = ver
    },

    /**
    @function set_on_load_log
    set the callback used for on_load_log event
    @param {on_load_log} f - function to handle the event
    */
    set_on_load_log : function(f) {
        nersc_pvweb.on_load_log = f
    },

    /**
    @function set_on_job_monitor_error
    set the event handler for job monitor_error events.
    @param {on_job_monitor_error} f - callback to handle the event
    */
    set_on_job_monitor_error : function(f) {
        nersc_pvweb.on_job_monitor_error = f
    },

    /**
    @function set_on_job_queued
    set the event handler for job queued events.
    @param {on_job_queued} f - callback to handle the event
    */
    set_on_job_queued : function(f) {
        nersc_pvweb.on_job_queued = f
    },

    /**
    @function set_on_job_canceled
    set the event handler for job canceled events.
    @param {on_job_canceled} f - callback to handle the event
    */
    set_on_job_canceled : function(f) {
        nersc_pvweb.on_job_canceled = f
    },

    /**
    @function set_on_job_ready
    set the event handler for job ready events.
    @param {on_job_ready} f - callback to handle the event
    */
    set_on_job_ready : function(f) {
        nersc_pvweb.on_job_ready = f
    },

    /**
    @function set_on_job_status
    set the event handler for job status update events.
    @param {on_job_status} f - callback to handle the event
    */
    set_on_job_status : function(f) {
        nersc_pvweb.on_job_status = f
    },

    /**
    @function set_on_session_created
    set the session created event handler.
    @param {on_session_created} f - function to handle the event
    @see on_session_created
    */
    set_on_session_created : function(f) {
        nersc_pvweb.on_session_created = f
    },

    /**
    @callback on_session_created
    session creation event handler. the default implemntation
    does nothing.
    @param {session_metadata} session_md - session metadata.
    @see set_on_session_created
    */
    on_session_created : function(session_md) {
    },


    /**
    @callback on_job_status
    event handler for job status updates.
    @param {session_metadata} session_md - session metadata
    @param {string} stat_code - status code returned from qstat
    @see set_on_job_status
    */
    on_job_status : function(session_md, stat_code) {
    },

    /**
    @callback on_job_ready
    event handler for 'job ready' state. at this point the
    job is running and is ready to connect to.
    @param {session_metadata} session_md - session metadata
    @see set_on_job_ready
    */
    on_job_ready : function(session_md) {
    },


    /**
    @callback on_job_canceled
    event handler for 'job canceled' state. at this point the
    job has ended and browser resources need to be cleaned up.
    @param {session_metadata} session_md - session metadata
    @see set_on_job_canceled
    */
    on_job_canceled : function(session_md) {
    },

    /**
    @callback on_job_queued
    event handler for 'job queued' state.
    @param {session_metadata} session_md - session metadata
    @see set_on_job_queued
    */
    on_job_queued : function(session_md) {
    },

    /**
    @callback on_job_monitor_error
    event handler for a job monitor error. this is called when
    we can no longer reach NERSC systems and obtain job status.
    @param {session_metadata} session_md - session metadata
    @see set_on_job_monitor_error
    */
    on_job_monitor_error : function(session_md) {
    },

    /**
    @callback on_load_log
    event handler for load_log. The default implementation opens
    a tab and displays the log data.
    @param {session_metadata} session_md - session metadata
    @param {string} log_str - contents of the job run log
    @see set_on_load_log
    */
    on_load_log : function(session_md, log_str) {
        win = window.open('_blank')
        win.document.open()
        win.document.write(''
            + '<head><title> PVWeb Log ' + session_md.job_id + '</title>'
            + '<style>pre {'
            + 'width: 100%; max-width: 600px;'
            + 'white-space: pre-wrap;'
            + '}</style></head>'
            + '<h1>Log for ' + session_md.job_id + '</h1>'
            + '<h2>Session Metadata</h2>'
            + '<hr>'
            + '<pre>' + JSON.stringify(session_md) + '</pre>'
            + '<h2>Log</h2>'
            + '<hr>'
            + '<pre>' + log_str + '</pre>')
        win.document.close()
    },

    // --------------------------------------------------------
    walltime_seconds : function(walltime) {
        console.log('walltime_seconds')
        var toks = walltime.split(":")
        var i = toks.length
        var t = 0
        var p = 0
        for (i = toks.length; i > 0; --i) {
            t += toks[i-1]*Math.pow(60, p)
            p += 1
        }
        console.log(walltime + ' -> ' + t)
        return t
    },

    // --------------------------------------------------------
    delete_job : function (host, jid) {
        console.log('delete_job')
        $.newt_ajax({
            url : '/queue/' + host +'/' +jid,
            type : 'DELETE',
            success : nersc_pvweb.log('deleted job ' + jid),
            error : nersc_pvweb.error('failed to delete ' + jid)
        })
    },

    // --------------------------------------------------------
    delete_session : function (sid) {
        console.log('delete_session')
        $.ajax({
            url : '/paraview',
            data : {'action': 'delete', 'id' : sid},
            type : 'GET',
            success : nersc_pvweb.log('deleted session ' + sid),
            error : nersc_pvweb.error('failed to delete session' + sid)
        })
    },

    // --------------------------------------------------------
    delete_job_and_session : function (session_md) {
        return function() {
            console.log('delete_job_and_session')
            nersc_pvweb.delete_job(session_md.job_params.hpc_resource, session_md.job_id)
            nersc_pvweb.delete_session(session_md.session.id)
            // diable buttons
            $('#con_' + session_md.uid).attr('disabled', 'disabled')
            $('#del_' + session_md.uid).attr('disabled', 'disabled')
        }
    },

    // --------------------------------------------------------
    load_log : function(session_md) {
        return function() {

            // call the remote server ready script
            var cmd = 'cat $HOME/PVWEB-'
                + nersc_pvweb.pv_ver_full + '.e' + session_md.job_id.split('.')[0]

            console.log(cmd)

            cmd = encodeURI(cmd);

            $.newt_ajax({
                url : '/command/' + session_md.job_params.hpc_resource,
                data : {'executable': cmd, loginenv : true},
                type : 'POST',
                success : function(data) {
                    console.log('load_log:success')
                    console.log(data)

                    if (data.error == "") {
                        // fire event handler
                        nersc_pvweb.on_load_log(session_md, data.output)
                    }
                    else {
                        nersc_pvweb.error('failed to cat log')(session_md)
                    }
                },
                error : function (data) {
                    nersc_pvweb.error('failed to exec cat')(session_md)
                }
            })
        }
    },

    // --------------------------------------------------------
    get_user_create_session_submit_job : function(job_params) {
        console.log('get_user_create_session_submit_job')

        $.newt_ajax({
            url : '/login/',
            type : 'GET',
            success : nersc_pvweb.create_session_submit_job(job_params),
            error : nersc_pvweb.error('failed to get_active_user')
        })
    },

    // --------------------------------------------------------
    create_session_submit_job : function(job_params) {
        return function (auth_data) {

            console.log('create_session_submit_job')
            console.log(auth_data)

            if (!auth_data['auth']) {
                nersc_pvweb.error('user has not been authenticated')(auth_data)
                return
            }

            $.ajax({
                url : '/paraview',
                data : {'action': 'create', 'user' : auth_data['username']},
                type : 'GET',
                success : nersc_pvweb.submit_job(job_params),
                error : nersc_pvweb.error('failed to create session')
            })
        }
    },

    // --------------------------------------------------------
    set_session_lifetime : function (session_md) {

        console.log('set_session_lifetime')
        console.log(session_md)

        walltime_s = nersc_pvweb.walltime_seconds(session_md.job_params.walltime)

        $.ajax({
            url : '/paraview',
            data : {'action': 'set_lifetime', 'id' : session_md.session.id, 'lifetime' : walltime_s},
            type : 'GET',
            success : function() { console.log('set_session_lifetime:success') } ,
            error : nersc_pvweb.error('failed to set session lifetime')
        })
    },

    // --------------------------------------------------------
    get_server_ready : function (session_md) {
        return function () {
            console.log('get_server_ready')

            // call the remote server ready script
            var cmd = '/bin/bash -l'
                 + ' ' + nersc_pvweb.pv_paths[session_md.job_params.hpc_resource]
                 + '/' + nersc_pvweb.pv_ver_full + '/pvweb_server_ready.sh'
                 + ' ' + session_md.job_id;

            console.log(cmd)

            cmd = encodeURI(cmd);

            $.newt_ajax({
                url : '/command/' + session_md.job_params.hpc_resource,
                data : {'executable': cmd},
                type : 'POST',
                success : function(data) {
                    console.log('get_server_ready:success')
                    console.log(data)
                    res = JSON.parse(data.output);
                    if ((res.status == 'READY') && (data.error == '')) {
                        // server is up and running and waiting for
                        // connections
                        // fire event
                        nersc_pvweb.on_job_ready(session_md)
                        // set session lifetime
                        nersc_pvweb.set_session_lifetime(session_md)
                        // restart the job mointor
                        session_md.ready = true
                        nersc_pvweb.monitor_job(session_md)()
                    }
                    else
                    if ((res.status == 'BUSY') && (data.error == '')) {
                        // server is still starting up, check back later
                        setTimeout(nersc_pvweb.get_server_ready(session_md), 10000);
                    }
                    else
                    if ((res.status == 'ERROR') && (data.error == '')) {
                        // job died
                        // restart the job mointor
                        nersc_pvweb.monitor_job(session_md)()
                        nersc_pvweb.error('server failed to start')(session_md)
                    }
                    else {
                        // some other error
                        // restart the job mointor
                        nersc_pvweb.monitor_job(session_md)()
                        nersc_pvweb.error('unknown erorr' + data.error)(session_md)

                    }
                },
                error : function (data) {
                    nersc_pvweb.delete_job_and_session(session_md)
                    nersc_pvweb.error('failed to exec pvweb_server_ready')(session_md)
                }
            })
        }
    },

    // --------------------------------------------------------
    job_id : 0,
    submit_job : function(job_params) {
        return function (session_str) {

            session = JSON.parse(session_str)

            console.log('submit_job')
            console.log(session)

            // get the next unique id
            uid = ++nersc_pvweb.job_id

            // create session metadata
            session_md = {
                'session' : session,
                'job_params' : job_params,
                'job_id' : '',
                'uid' : uid,
                'ready' : false
            }

            // trigger the session hook
            nersc_pvweb.on_session_created(session_md)

            // call the launcher script on edison
            var cmd = '/bin/bash -l'
                 + ' ' + nersc_pvweb.pv_paths[job_params.hpc_resource]
                 + '/' + nersc_pvweb.pv_ver_full + '/start_pvweb.sh'
                 + ' ' + job_params.num_cores
                 + ' ' + job_params.cores_per_socket
                 + ' ' + job_params.walltime
                 + ' ' + job_params.account
                 + ' ' + job_params.queue
                 + ' ' + job_params.data_file
                 + ' ' + nersc_pvweb.web_host
                 + ' ' + session.port;

            console.log(cmd)

            cmd = encodeURI(cmd);

            $.newt_ajax({
                url : '/command/' + job_params.hpc_resource,
                data : {'executable': cmd},
                type : 'POST',
                success : function (data) {
                    console.log('submit_job:success')
                    console.log(data)
                    res = JSON.parse(data.output);
                    if ((res.status == 'OK') && (data.error == '')) {
                        // job is successfuly submitted
                        // wait until the job is running
                        session_md.job_id = res.jid
                        session_md.ready = false
                        nersc_pvweb.monitor_job(session_md)()
                        console.log(res.jid + ' submitted')
                    }
                    else {
                        nersc_pvweb.delete_session(session_md.session.id)
                        nersc_pvweb.error('failed to submit')(session_md)
                    }
                },
                error : function (data) {
                    nersc_pvweb.delete_session(session.id)
                    nersc_pvweb.error('failed to submit job')(session)
                }
            })
        }
    },

    // --------------------------------------------------------
    monitor_job : function(session_md) {
        return function() {
            console.log('monitor_job')
            console.log(session_md)

            $.newt_ajax({
                url : '/queue/' + session_md.job_params.hpc_resource + '/' + session_md.job_id,
                type: 'GET',
                success: function(data) {
                    // display job status
                    console.log('job ' + session_md.job_id + ' status ' + data.status)
                    console.log(session_md)

                    $('#stat_' + session_md.uid).html('<b>' + data.status + '</b>')

                    if (data.status == 'R') {
                        // R -  job is running.
                        console.log('running :' + session_md)
                        if (! session_md.ready) {
                            // running but not yet ready for connect
                            // wait until pvserver is up and it's
                            // safe to connect
                            // event handler
                            nersc_pvweb.get_server_ready(session_md)()
                            return
                        }
                    }
                    else
                    if ( (data.status == 'E') || (data.status == 'C')) {
                        // C -  Job is completed after having run/
                        // E -  Job is exiting after having run.
                        console.log('canceled :' + session_md)
                        // delete the session
                        nersc_pvweb.delete_session(session_md.session.id)
                        // event handler
                        nersc_pvweb.on_job_canceled(session_md)
                        // stop monitoring the job
                        return
                    }
                    else {
                        // H -  Job is held.
                        // Q -  job is queued, eligible to run or routed.
                        // T -  job is being moved to new location.
                        // W -  job is waiting for its execution time
                        // S -  (Unicos only) job is suspend.
                        // job is queued wait some more
                        nersc_pvweb.on_job_queued(session_md)
                    }
                    // continue to monitor the job
                    setTimeout(nersc_pvweb.monitor_job(session_md), 10000);
                },
                error: function (data) {
                    // delete job
                    nersc_pvweb.delete_job(session_md.hpc_ressource, session_md.job_id)
                    nersc_pvweb.delete_session(session_md.session.id)
                    // event handler
                    nersc_pvweb.on_job_monitor_error(session_md)
                    // report error
                    nersc_pvweb.error('qstat failed')(data)
                }
            });
        }
    },

    // --------------------------------------------------------
    log : function (message) {
        return function (data) {
            console.log(message)
        }
    },

    // --------------------------------------------------------
    error : function (message) {
        return function (data) {
            console.error(message)
            console.error(data)
            alert(message)
        }
    },

    // --------------------------------------------------------
    web_host : 'portal-auth.nersc.gov',
    pv_paths : {'edison' : '/usr/common/graphics/ParaView/'},
    pv_ver_full : '4.2.0-PDACS',
}
