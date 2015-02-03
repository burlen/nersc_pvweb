var nersc_pvweb = nersc_pvweb || {

    // --------------------------------------------------------
    web_host : 'portal-auth.nersc.gov',
    set_web_host : function (fqdn) {
        nersc_pvweb.web_host = fqdn
    },

    // --------------------------------------------------------
    pv_home : '/usr/common/graphics/ParaView/',
    set_paraview_home : function (path) {
        nersc_pvweb.pv_home = path
    },

    // --------------------------------------------------------
    pv_ver_full : '4.2.0-PDACS',
    set_paraview_version : function (ver) {
        nersc_pvweb.pv_ver_full = ver
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
    log_callback : function (message) {
        return function (data) {
            console.log(message)
        }
    },

    web_app_url : 'apps/view_file.html',
    set_web_app_url : function (url) {
        nersc_pvweb.web_app_url = url
    },

    // --------------------------------------------------------
    error_callback : function (message) {
        return function (data) {
            console.error(message)
            console.error(data)
            alert(message)
        }
    },

    // --------------------------------------------------------
    delete_job : function (host, jid) {
        console.log('delete_job')
        $.newt_ajax({
            url : '/queue/' + host +'/' +jid,
            type : 'DELETE',
            success : nersc_pvweb.log_callback('deleted job ' + jid),
            error : nersc_pvweb.error_callback('failed to delete ' + jid)
        })
    },

    // --------------------------------------------------------
    delete_session : function (sid) {
        console.log('delete_session')
        $.ajax({
            url : '/paraview',
            data : {'action': 'delete', 'id' : sid},
            type : 'GET',
            success : nersc_pvweb.log_callback('deleted session ' + sid),
            error : nersc_pvweb.error_callback('failed to delete session' + sid)
        })
    },

    // --------------------------------------------------------
    delete_job_and_session : function (session_md) {
        return function() {
            console.log('delete_job_and_session')
            nersc_pvweb.delete_job(session_md.hpc_resource, session_md.jid)
            nersc_pvweb.delete_session(session_md.sid)
            // diable buttons
            $('#con_' + session_md.uid).attr('disabled', 'disabled')
            $('#del_' + session_md.uid).attr('disabled', 'disabled')
        }
    },

    // --------------------------------------------------------
    connect_to_session : function (session_md) {
        return function() {
            console.log('connect_to_session')
            console.log(session_md)
            var url = nersc_pvweb.web_app_url + '?sessionURL=' + encodeURIComponent(session_md.session_obj.sessionURL)
            window.open(url,'_blank')
        }
    },

    // --------------------------------------------------------
    active_user : null,
    set_active_user : function(uname) {
        console.log('set_active_user')
        nersc_pvweb.active_user = uname
    },

    // --------------------------------------------------------
    view_log : function(session_md) {
        return function() {

            // call the remote server ready script
            var cmd = 'cat $HOME/PVWEB-'
                + nersc_pvweb.pv_ver_full + '.e' + session_md.jid.split('.')[0]

            console.log(cmd)

            cmd = encodeURI(cmd);

            $.newt_ajax({
                url : '/command/' + session_md.hpc_resource,
                data : {'executable': cmd, loginenv : true},
                type : 'POST',
                success : function(data) {
                    console.log('view_log:success')
                    console.log(data)

                    if (data.error == "") {
                        win = window.open('_blank')
                        win.document.open()
                        win.document.write(''
                           + '<head><title> PVWeb Log ' + session_md.jid + '</title></head>'
                           + '<pre>' + data.output + '</pre>')
                        win.document.close()
                    }
                    else {
                        nersc_pvweb.error_callback('failed to cat log')(session_md)
                    }
                },
                error : function (data) {
                    nersc_pvweb.error_callback('failed to exec cat')(session_md)
                }
            })
        }
    },

    // --------------------------------------------------------
    get_user_create_session_submit_job : function() {
        console.log('get_user_create_session_submit_job')

        $.newt_ajax({
            url : '/login/',
            type : 'GET',
            success : nersc_pvweb.create_session_submit_job,
            error : nersc_pvweb.error_callback('failed to get_active_user')
        })
    },

    // --------------------------------------------------------
    create_session_submit_job : function (auth_data) {

        console.log('create_session_submit_job')
        console.log(auth_data)

        if (!auth_data['auth']) {
            nersc_pvweb.error_callback('user has not been authenticated')(auth_data)
            return
        }

        $.ajax({
            url : '/paraview',
            data : {'action': 'create', 'user' : auth_data['username']},
            type : 'GET',
            success : nersc_pvweb.submit_job,
            error : nersc_pvweb.error_callback('failed to create session')
        })
    },

    // --------------------------------------------------------
    set_session_lifetime : function (session_md) {

        console.log('set_session_lifetime')
        console.log(session_md)

        $.ajax({
            url : '/paraview',
            data : {'action': 'set_lifetime', 'id' : session_md.sid, 'lifetime' : session_md.walltime},
            type : 'GET',
            success : function() { console.log('set_session_lifetime:success') } ,
            error : nersc_pvweb.error_callback('failed to set session lifetime')
        })
    },

    // --------------------------------------------------------
    get_server_ready : function (session_md) {
        return function () {
            console.log('get_server_ready')

            // call the remote server ready script
            var cmd = '/bin/bash -l'
                 + ' ' + nersc_pvweb.pv_home
                 + '/' + nersc_pvweb.pv_ver_full + '/pvweb_server_ready.sh'
                 + ' ' + session_md.jid;

            console.log(cmd)

            cmd = encodeURI(cmd);

            $.newt_ajax({
                url : '/command/' + session_md.hpc_resource,
                data : {'executable': cmd},
                type : 'POST',
                success : function(data) {
                    console.log('get_server_ready:success')
                    console.log(data)
                    res = JSON.parse(data.output);
                    if ((res.status == 'READY') && (data.error == '')) {
                        // server is up and running and waiting for
                        // connections
                        // connect to the server (and allow user to connect manually)
                        nersc_pvweb.connect_to_session(session_md)()
                        $('#con_' + session_md.uid).removeAttr('disabled')
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
                        nersc_pvweb.error_callback('server failed to start')(session_md)
                    }
                    else {
                        // some other error
                        // restart the job mointor
                        nersc_pvweb.monitor_job(session_md)()
                        nersc_pvweb.error_callback('unknown erorr' + data.error)(session_md)

                    }
                },
                error : function (data) {
                    nersc_pvweb.delete_job_and_session(session_md)
                    nersc_pvweb.error_callback('failed to exec pvweb_server_ready')(session_md)
                }
            })
        }
    },

    // --------------------------------------------------------
    job_id : 0,
    submit_job : function (session) {

        sobj = JSON.parse(session)

        console.log('submit_job')
        console.log(sobj)

        // add a row in the job management table
        uid = ++nersc_pvweb.job_id

        nersc_pvweb.job_table.append('<tr id="row_' + uid + '">'
            + '<td id="job_' + uid + '"> <b>' + uid + '</b></td>'
            + '<td id="desc_' + uid + '">' + $('#hpc_resource').val() + ' ' + $('#cores').val() + ' cores '+ $('#walltime').val() + '</td>'
            + '<td id="stat_' + uid + '"><img class="nersc_pvweb_busy_icon" alt="..."/></td>'
            + '<td id="act_' + uid + '" valign="center">'
            + '<button class="nersc_pvweb_button" id="del_' + uid + '">Delete</button>'
            + '<button class="nersc_pvweb_button" id="con_' + uid + '">Connect</button>'
            + '<button class="nersc_pvweb_button" id="log_' + uid + '">Log</button>'
            + '</td>'
            + '</tr>')

        session_md = {
            'session_obj' : sobj,
            'hpc_resource' : $('#hpc_resource').val(),
            'sid' : sobj.id,
            'uid' : uid,
            'walltime' : nersc_pvweb.walltime_seconds($('#walltime').val())
        }

        $('#con_' + uid).click(nersc_pvweb.connect_to_session(session_md))
        $('#con_' + uid).attr('disabled', 'disabled')

        $('#del_' + uid).click(nersc_pvweb.delete_job_and_session(session_md))
        $('#del_' + uid).attr('disabled', 'disabled')

        $('#log_' + uid).click(nersc_pvweb.view_log(session_md))
        $('#log_' + uid).attr('disabled', 'disabled')

        // call the launcher script on edison
        var cmd = '/bin/bash -l'
             + ' ' + nersc_pvweb.pv_home
             + '/' + nersc_pvweb.pv_ver_full + '/start_pvweb.sh'
             + ' ' + $('#cores').val()
             + ' ' + $('#cores_per_socket').val()
             + ' ' + $('#walltime').val()
             + ' ' + $('#account').val()
             + ' ' + $('#queue').val()
             + ' ' + $('#data_file').val()
             + ' ' + nersc_pvweb.web_host
             + ' ' + sobj.port;

        console.log(cmd)

        cmd = encodeURI(cmd);

        $.newt_ajax({
            url : '/command/' + $('#hpc_resource').val(),
            data : {'executable': cmd},
            type : 'POST',
            success : function (data) {
                console.log('submit_job:success')
                console.log(data)
                res = JSON.parse(data.output);
                if ((res.status == 'OK') && (data.error == '')) {
                    // job is successfuly submitted
                    // wait until the job is running
                    session_md.jid = res.jid
                    session_md.ready = false
                    nersc_pvweb.monitor_job(session_md)()
                    console.log(res.jid + ' submitted')
                }
                else {
                    nersc_pvweb.delete_session(session_md.sid)
                    nersc_pvweb.error_callback('failed to submit')(session_md)
                }
            },
            error : function (data) {
                nersc_pvweb.delete_session(sobj.id)
                nersc_pvweb.error_callback('failed to submit job')(sobj)
            }
        })
    },

    // --------------------------------------------------------
    monitor_job : function(session_md) {
        return function() {
            console.log('monitor_job')
            console.log(session_md)

            $.newt_ajax({
                url : '/queue/' + session_md.hpc_resource + '/' + session_md.jid,
                type: 'GET',
                success: function(data) {
                    // display job status
                    console.log('job ' + session_md.jid + ' status ' + data.status)
                    console.log(session_md)

                    $('#stat_' + session_md.uid).html('<b>' + data.status + '</b>')

                    if (data.status == 'R') {
                        // R -  job is running.
                        console.log('running :' + session_md)
                        if (session_md.ready) {
                            // enable buttons
                            $('#con_' + session_md.uid).removeAttr('disabled')
                            $('#del_' + session_md.uid).removeAttr('disabled')
                        }
                        else {
                            // wait until pvserver is up and it's
                            // safe to connect
                            // enable buttons
                            $('#del_' + session_md.uid).removeAttr('disabled')
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
                        nersc_pvweb.delete_session(session_md.sid)
                        // disable buttons
                        $('#con_' + session_md.uid).attr('disabled', 'disabled')
                        $('#del_' + session_md.uid).attr('disabled', 'disabled')
                        // enable buttons
                        $('#log_' + session_md.uid).removeAttr('disabled')
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
                        // enable delete button
                        $('#con_' + session_md.uid).attr('disabled', 'disabled')
                        $('#del_' + session_md.uid).removeAttr('disabled')
                    }
                    // continue to monitor the job
                    setTimeout(nersc_pvweb.monitor_job(session_md), 10000);
                },
                error: function (data) {
                    // delete job
                    nersc_pvweb.delete_job(session_md.hpc_ressource, session_md.jid)
                    nersc_pvweb.delete_session(session_md.sid)
                    // disable buttons
                    $('#con_' + session_md.uid).attr('disabled', 'disabled')
                    $('#del_' + session_md.uid).attr('disabled', 'disabled')
                    // report error
                    nersc_pvweb.error_callback('qstat failed')(data)
                }
            });
        }
    },

    // --------------------------------------------------------
    wait_for_pvserver : function(session_md) {
        console.log('wait_for_pvserver')

    },

    // --------------------------------------------------------
    submit_job_form_reaction : function () {
        console.log('submit_job_form_reaction')
        nersc_pvweb.get_user_create_session_submit_job();
        return false;
    },

    // --------------------------------------------------------
    submit_form_id : null,
    create_submit_form : function (container) {
        console.log('create_submit_form')

        container.html('<table class="nersc_pvweb_job_form">'
            + '<th colspan="2">Create Job</th>'
            // system
            + '<tr><td class="nersc_pvweb_job_form_label"> System: </td>'
            + '<td><select id="hpc_resource" name="hpc_resource" value="edison">'
            + '<option value="edison">Edison</option></select></td></tr>'
            // num cores
            + '<tr><td class="nersc_pvweb_job_form_label"> Number of Cores: </td>'
            + '<td><input id="cores" name="cores" type="number" min="1" max="60" value="8"/></td></tr>'
            // cores per socket
            + '<tr><td class="nersc_pvweb_job_form_label"> Cores per Socket: </td>'
            + '<td><input id="cores_per_socket" name="cores_per_socket" type="number" min="1" max="12" value="8"/></td></tr>'
            // walltime
            + '<tr><td class="nersc_pvweb_job_form_label"> Walltime: </td>'
            + '<td><input id="walltime" name="walltime" type="text" value="00:30:00"/></td></tr>'
            // account
            + '<tr><td class="nersc_pvweb_job_form_label"> Account: </td>'
            + '<td><input id="account" name="account" type="text" value="mpccc"/></td></tr>'
            // queue
            + '<tr><td class="nersc_pvweb_job_form_label"> Queue: </td>'
            + '<td><select id="queue" name="queue" value="debug">'
            + '<option value="debug">debug</option>'
            + '<option value="premium">premium</option>'
            +  '</select></td></tr>'
            // file
            /*+ '<tr><td class="nersc_pvweb_job_form_label"> File: </td>'
            + '<td><input id="data_file" name="data_file" type="text" value=""/></td></tr>'*/
            // submit
            + '<tr><th colspan="2"><button class="nersc_pvweb_button" id="submit_job">Submit</button></th></tr>'
            + '</table>')

        $('#submit_job').click(nersc_pvweb.submit_job_form_reaction)
    },

    // --------------------------------------------------------
    status_area : null,
    set_status_area : function (parent) {
        nersc_pvweb.status_area = parent
    },

    // --------------------------------------------------------
    clear_job_status : function () {
        //nersc_pvweb.status_area.text('')
    },

    // --------------------------------------------------------
    update_job_status : function (message) {
        console.log(message)
        nersc_pvweb.status_area.append(message)
    },

    // --------------------------------------------------------
    job_table : null,
    set_job_table : function (cont) {
        nersc_pvweb.job_table = $('<table>', {class : 'nersc_pvweb_job_table'})
        nersc_pvweb.job_table.append(
            '<tr><th>Id</th><th class="wide">Description</th><th>Status</th><th>Action</th></tr>')
        cont.append(nersc_pvweb.job_table);
    },

}
