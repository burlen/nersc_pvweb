var nersc_pvweb_ui = nersc_pvweb_ui || {

    /**
    @function initialize_event_handlers
    Setup the event handlers that update the UI as
    jobs are created, submitted, and destroyed.
    */
    initialize : function() {
        nersc_pvweb.set_on_job_ready(nersc_pvweb_ui.on_job_ready)
        nersc_pvweb.set_on_job_status(nersc_pvweb_ui.on_job_status)
        nersc_pvweb.set_on_job_queued(nersc_pvweb_ui.on_job_queued)
        nersc_pvweb.set_on_job_canceled(nersc_pvweb_ui.on_job_canceled)
        nersc_pvweb.set_on_session_created(nersc_pvweb_ui.on_session_created)
        nersc_pvweb.set_on_job_monitor_error(nersc_pvweb_ui.on_job_monitor_error)
    },

    /**
    @function set_web_app
    set the application to launch when jobs are up and running.
    @param url - path relative to web root of html app
    */
    set_web_app : function (url) {
        nersc_pvweb_ui.web_app_url = url
    },

    /**
    @function create_submit_form
    creates a table containing job submission form and inserts it into
    the passed elements inner html.
    @param {Object} container - tag into which the table is inserted
    */
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

        $('#submit_job').click(nersc_pvweb_ui.submit_job)
    },

    // --------------------------------------------------------
    create_job_table : function (container) {
        console.log('create_job_table')
        job_table = $('<table>', {class : 'nersc_pvweb_job_table', id : 'nersc_pvweb_job_table'})
        job_table.append(
            '<tr><th>Id</th><th class="wide">Description</th><th>Status</th><th>Action</th></tr>')
        container.append(job_table);
    },

    // --------------------------------------------------------
    on_session_created : function(session_md) {
        // add a row in the job management table
        $('#nersc_pvweb_job_table').append(
            '<tr id="row_' + session_md.uid + '">'
            + '<td id="job_' + session_md.uid + '"> <b>' + session_md.uid + '</b></td>'
            + '<td id="desc_' + session_md.uid + '">' + session_md.job_params.hpc_resource
            + ' ' + session_md.job_params.num_cores + ' cores '+ session_md.job_params.walltime + '</td>'
            + '<td id="stat_' + session_md.uid + '"><img class="nersc_pvweb_busy_icon" alt="..."/></td>'
            + '<td id="act_' + session_md.uid + '" valign="center">'
            + '<button class="nersc_pvweb_button" id="del_' + session_md.uid + '">Delete</button><br>'
            + '<button class="nersc_pvweb_button" id="con_' + session_md.uid + '">Connect</button><br>'
            + '<button class="nersc_pvweb_button" id="log_' + session_md.uid + '">Log</button>'
            + '</td>'
            + '</tr>')

        // hook up handlers and disble buttons
        $('#con_' + uid).click(nersc_pvweb_ui.connect_to_session(session_md))
        $('#con_' + uid).attr('disabled', 'disabled')

        $('#del_' + uid).click(nersc_pvweb.delete_job_and_session(session_md))
        $('#del_' + uid).attr('disabled', 'disabled')

        $('#log_' + uid).click(nersc_pvweb.load_log(session_md))
        $('#log_' + uid).attr('disabled', 'disabled')
    },

    // --------------------------------------------------------
    on_job_status : function(session_md, stat_code) {
        console.log('on_job_status')
        $('#stat_' + session_md.uid).html('<b>' + stat + '</b>')
    },

    // --------------------------------------------------------
    on_job_ready : function(session_md) {
        console.log('on_job_ready')
        // enable
        $('#con_' + session_md.uid).removeAttr('disabled')
        // connect to the server
        nersc_pvweb_ui.connect_to_session(session_md)()
    },

    // --------------------------------------------------------
    on_job_canceled : function(session_md) {
        console.log('on_job_canceled')
        // disable
        $('#con_' + session_md.uid).attr('disabled', 'disabled')
        $('#del_' + session_md.uid).attr('disabled', 'disabled')
        // enable
        $('#log_' + session_md.uid).removeAttr('disabled')
    },

    // --------------------------------------------------------
    on_job_queued : function(session_md) {
        console.log('on_job_queued')
        // disable
        $('#con_' + session_md.uid).attr('disabled', 'disabled')
        $('#log_' + session_md.uid).attr('disabled', 'disabled')
        // enable
        $('#del_' + session_md.uid).removeAttr('disabled')
    },

    // --------------------------------------------------------
    on_job_monitor_error : function(session_md) {
        console.log('on_job_monitor_error')
        // disable buttons
        $('#con_' + session_md.uid).attr('disabled', 'disabled')
        $('#del_' + session_md.uid).attr('disabled', 'disabled')
    },

    // --------------------------------------------------------
    connect_to_session : function (session_md) {
        return function() {
            console.log('connect_to_session')
            console.log(session_md)
            var url = nersc_pvweb_ui.web_app_url + '?sessionURL=' + encodeURIComponent(session_md.session.sessionURL)
            console.log(url)
            //debugger
            window.open(url,'_blank')
        }
    },

    // --------------------------------------------------------
    get_job_parameters : function() {

        job_params = {
            'hpc_resource' : $('#hpc_resource').val(),
            'num_cores' : $('#cores').val(),
            'cores_per_socket' : $('#cores_per_socket').val(),
            'walltime' : $('#walltime').val(),
            'account' : $('#account').val(),
            'queue' : $('#queue').val(),
            'data_file' : $('#data_file').val()
        }

        return job_params
    },

    // --------------------------------------------------------
    submit_job : function () {
        console.log('submit_job')
        job_params = nersc_pvweb_ui.get_job_parameters()
        nersc_pvweb.launch_job(job_params);
        return false;
    },

    // --------------------------------------------------------
    web_app_url : 'apps/view_file.html',
}
