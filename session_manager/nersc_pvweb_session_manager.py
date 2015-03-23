#!/usr/bin/env python

# run as follows:
# /var/www/ParaView/4.2.0/bin/pvpython ./nersc_tunnel_launcher.py -d /var/www/ParaView/launcher.json &

import json
import logging
import os
import string
import subprocess
import sys
import time
import uuid
import inspect

from random import choice

from twisted.internet import reactor, defer
from twisted.internet.task import deferLater
from twisted.internet.defer import CancelledError
from twisted.python import log
from twisted.web import server, resource, http
from twisted.web.resource import Resource
from twisted.web.server import NOT_DONE_YET
from twisted.web.static import File

from vtk.web import upload

try:
    import argparse
except ImportError:
    import _argparse as argparse

sample_config_file = """
"""


# -----------------------------------------------------------------------------
def generatePassword():
    return ''.join(choice(string.letters + string.digits) for _ in xrange(16))

# -----------------------------------------------------------------------------
def validateKeySet(obj, expected_keys, object_name):
    all_key_found = True
    for key in expected_keys:
        if not obj.has_key(key):
            print "ERROR: %s is missing %s key." % (object_name, key)
            all_key_found = False
    return all_key_found

# -----------------------------------------------------------------------------
def replaceVariables(template_str, variable_list):
    for key_pair in variable_list:
        item_template = string.Template(template_str)
        template_str = item_template.safe_substitute(key_pair)

    if "$" in template_str:
        logging.error("Some properties could not be resolved: " + template_str)

    return template_str

# -----------------------------------------------------------------------------
def replaceList(template_list, variable_list):
    result_list = []
    for s in template_list:
        result_list.append(replaceVariables(s, variable_list))
    return result_list

# -----------------------------------------------------------------------------
def filterResponse(obj, public_keys):
    public_keys.extend(['id', 'sessionURL', 'sessionManagerURL'])
    filtered_output = {}
    for field in obj:
        if field in public_keys:
            filtered_output[field] = obj[field]

    sys.stderr.write('filtered_otuput=%s'%(filtered_output))

    return filtered_output

# -----------------------------------------------------------------------------
def extractSessionId(request):
    path = request.path.split('/')
    if len(path) < 3:
       return None
    return str(path[2])

# =============================================================================
class SessionManager(object):
    """
    This class maintains a list of active session meta-data
    indexed by session id. It can create new session by aquiring
    resources (host and port) from the resource manager and
    initialize the session meta-data.
    """
    # -------------------------------------------------------------------------
    def __init__(self, config, mapping):
        self.sessions = {}
        self.config = config
        self.resources = ResourceManager(config["resources"])
        self.mapping = mapping
        sys.stderr.write('config=%s\n'%(config))

    # -------------------------------------------------------------------------
    def createSession(self, options):
        # Assign resource to session
        host, port = self.resources.getNextResource()
        if host:
            # generate session id
            session_id = str(uuid.uuid1())

            # confiogure the session meta-data
            options['id'] = session_id
            options['host'] = host
            options['port'] = port
            options['expires'] = 24*60*60

            if not options.has_key('secret'):
                options['secret'] = generatePassword()

            options['sessionURL'] = replaceVariables( \
                self.config['configuration']['sessionURL'], \
                [options, self.config['properties']])

            if self.config.has_key('sessionData') :
                for key in self.config['sessionData'] :
                    options[key] = replaceVariables( \
                        self.config['sessionData'][key], \
                        [options, self.config['properties']])

            # add to active sessions
            self.sessions[session_id] = options

            # update the map file used by apache mod_rewrite
            self.mapping.update(self.sessions)

            return options

        return None

    # -------------------------------------------------------------------------
    def deleteExpiredSessions(self):
        # find and remove expired sessions
        for session_id in self.sessions.keys():
            session = self.sessions[session_id]
            if session.has_key('expires') \
                and (int(time.time()) > int(session['expires'])):
                    sys.stderr.write('deleted expired session %s'%(session_id))
                    del self.sessions[session_id]
        return

    # -------------------------------------------------------------------------
    def deleteSession(self, session_id):
        # release the resources
        host = self.sessions[session_id]['host']
        port = self.sessions[session_id]['port']
        self.resources.freeResource(host, port)

        # remove from actrive session
        del self.sessions[session_id]

        # update the map file used by apache mod_rewrite
        self.mapping.update(self.sessions)

    # -------------------------------------------------------------------------
    def getSession(self, session_id):
        return self.sessions.get(session_id)

    # -------------------------------------------------------------------------
    def getSessionIds(self, filt={}):
        if not filt:
            # no filter provided, return all
            return self.sessions.keys()
        # filter provided, return only the sessions
        # that contain matches
        sessions = []
        for sk in self.sessions.keys():
            mismatch = False
            for fk in filt.keys():
                if (not fk in self.sessions[sk]) \
                  or (not filt[fk] == self.sessions[sk][fk]):
                    mismatch = True
                    break
            if not mismatch:
                sessions.append(sk)
        return sessions



# =============================================================================
class ProxyMappingManager(object):

    def update(sessions):
        pass

class ProxyMappingManagerTXT(ProxyMappingManager):

    def __init__(self, file_path, pattern="%s %s:%d\n"):
        self.file_path = file_path
        self.pattern = pattern

    def update(self, sessions):
        with open(self.file_path, "w") as map_file:
            for id in sessions:
                map_file.write(self.pattern % (id, sessions[id]['host'], sessions[id]['port']))

# =============================================================================
class ResourceManager(object):
    """
    Class that provides methods to keep track on available resources (host/port)
    """
    def __init__(self, resourceList):
        self.resources = {}
        for resource in resourceList:
            host = resource['host']
            portList = range(resource['port_range'][0],resource['port_range'][1]+1)
            if self.resources.has_key(host):
                self.resources[host]['available'].extend(portList)
            else:
                self.resources[host] = { 'available': portList, 'used': []}

    def getNextResource(self):
        """
        Return a (host, port) pair if any available otherwise will return None
        """
        # find host with max availibility
        winner = None
        availibilityCount = 0
        for host in self.resources:
            if availibilityCount < len(self.resources[host]['available']):
                availibilityCount = len(self.resources[host]['available'])
                winner = host

        if winner:
            port = self.resources[winner]['available'].pop()
            self.resources[winner]['used'].append(port)
            return (winner, port)

        return (None, None)

    def freeResource(self, host, port):
        """
        Free a previously reserved resource
        """
        if self.resources.has_key(host) and port in self.resources[host]['used']:
            self.resources[host]['used'].remove(port)
            self.resources[host]['available'].append(port)



# ------------------------------------------------------------------------------
def name(obj):
    return type(obj).__name__

# ------------------------------------------------------------------------------
def handle_http_error(request, message):
    request.setResponseCode(http.BAD_REQUEST)

    stack = inspect.stack()
    caller_class = name(stack[1][0].f_locals["self"].__class__)
    caller_method = stack[1][0].f_code.co_name

    msg = 'Error %s %s\n %s'%(caller_class, caller_method, message)
    logging.error(msg)
    return json.dumps({'error': msg})

# ===========================================================================
class ConnectionBroker(resource.Resource, object):
    """
    This class will broker the connection between the already launched
    and running pvserver/web app over the previously assigned port. The
    input to various http requests is the session id retruned by the
    ConnectionFactory.
    """
    def __init__(self, options, config):
        super(ConnectionBroker, self).__init__()
        self._options = options
        self._config = config
        self.time_to_wait = int(config['configuration']['timeout'])
        self.field_filter = config['configuration']['fields']
        self.session_manager = SessionManager( \
            config, ProxyMappingManagerTXT(config['configuration']['proxy_file']))

    # ------------------------------------------------------------------------
    def getChild(self, path, request):
        return self

    # ------------------------------------------------------------------------
    def __del__(self):
        logging.warning("SessionConnect going offline")

    # ------------------------------------------------------------------------
    def render_POST(self, request):

        # TODO - we're not using this
        sys.stderr.write('===================KITWARE CODE')

        sys.stderr.write('render_POST\n')
        sys.stderr.write('reaquest=%s\n'%(request))

        #  extract the session id.
        session_id = request.args.get('id')
        if not session_id:
           return handle_http_error(request, 'no session id was found')

        # lookup the session
        session = self.session_manager.getSession(session_id)
        if not session:
            handle_http_error(request, 'no session for id'%(session_id))

        # we rely ont he fact that the process is already running
        # launched via NEWT api. this request WON'T occur before then.
        # the only thing to do then is pass back the session info that
        # will allow the connection to proceed
        request.setResponseCode(http.OK)
        return json.dumps(filterResponse(session, self.field_filter))


    # -------------------------------------------------------------------------
    def render_GET(self, request):

        sys.stderr.write('render_GET\n')
        sys.stderr.write('request=%s\n'%(request))

        # inject cross origin headers
        request.setHeader('Access-Control-Allow-Origin', '*')
        request.setHeader('Access-Control-Allow-Methods', 'GET')
        request.setHeader('Access-Control-Allow-Headers', 'x-prototype-version,x-requested-with')
        request.setHeader('Access-Control-Max-Age', 2520) # 42 hours

        # nersc specific, respond to some actions
        # get the action
        if ('action' in request.args):
            action = request.args.get('action')[0]
            if not action:
                return handle_http_error(request, 'missing action=[create, get, delete, delete_all, list]')

            if action == 'create':
                # user name must also be provided
                user = request.args.get('user')[0]
                if not user:
                    return handle_http_error(request, '"create" requires field "user"')

                # reclaim expired sessions
                self.session_manager.deleteExpiredSessions()

                # Create new session
                opts = {'user' : user }
                session = self.session_manager.createSession(opts)

                # No resource available
                if not session:
                    request.setResponseCode(http.SERVICE_UNAVAILABLE)
                    return json.dumps({'error' : 'failed to create a session'})

                # Return session meta-data
                request.setResponseCode(http.OK)
                return json.dumps(filterResponse(session, self.field_filter))

            elif action == 'set_lifetime':
                # extract the session id.
                session_id = request.args.get('id')[0]
                sys.stderr.write('set_lifetime id=%s\n'%(session_id))

                # lookup the session
                if not session_id:
                    return handle_http_error(request, 'no session session_id was found')

                session = self.session_manager.getSession(session_id)
                if not session:
                    handle_http_error(request, 'no session for id %s'%(session_id))

                # extract lifetime
                now = time.time()
                lifetime = request.args.get('lifetime')[0]
                if not lifetime:
                    handle_http_error(request, '"set_lifetime" requires field "lifetime"')


                session['expires'] = int(now) + int(lifetime) + int(60*60)

                sys.stderr.write('now=%d'%(now))
                sys.stderr.write('lifetime=%s'%(lifetime))
                sys.stderr.write('expires=%d'%(session['expires']))

                # Return session meta-data
                request.setResponseCode(http.OK)
                return json.dumps({'error':None})


            elif action == 'delete':
                #  extract the session id.
                session_id = request.args.get('id')[0]

                sys.stderr.write('delete id=%s\n'%(session_id))

                # lookup the session
                if not session_id:
                    return handle_http_error(request, 'no session session_id was found')

                session = self.session_manager.getSession(session_id)
                if not session:
                    # session could be deleted by the web app and later by the
                    # browser or vise versa, only one will succeeed. the other
                    # is harmless
                    # handle_http_error(request, 'no session for id %s'%(session_id))
                    return json.dumps({'error':None,'status':'no session for id %s'%(session_id)})

                # Remove session
                self.session_manager.deleteSession(session_id)

                request.setResponseCode(http.OK)
                return json.dumps({'error':None})

            elif action == 'delete_all':
                session_ids = self.session_manager.getSessionIds()

                for session_id in session_ids:
                     self.session_manager.deleteSession(session_id)

                # Return session meta-data
                request.setResponseCode(http.OK)
                return json.dumps( {'ids' : session_ids} )

            elif action == 'get':
                #  extract the session id.
                session_id = request.args.get('id')[0]

                sys.stderr.write('get id=%s\n'%(session_id))

                # lookup the session
                if not session_id:
                    return handle_http_error(request, 'no session session_id was found')

                session = self.session_manager.getSession(session_id)
                if not session:
                    handle_http_error(request, 'no session for id %s'%(session_id))

                # Return session meta-data
                request.setResponseCode(http.OK)
                return json.dumps(filterResponse(session, self.field_filter))

            elif action == 'list':
                filt = {}
                # user name if provided, is used as a filter
                user = request.args.get('user',[''])[0]
                if user:
                    filt['user'] = user

                session_ids = self.session_manager.getSessionIds(filt)

                # Return session meta-data
                request.setResponseCode(http.OK)
                return json.dumps( {'ids' : session_ids} )

            else:
                return handle_http_error(request, 'unsupported action %s'%(action))

        # TODO - remove
        # the original repsonses
        else:
            sys.stderr.write('===================KITWARE CODE')

            id = extractSessionId(request)

            if not id:
               message = "id not provided in GET request"
               logging.error(message)
               request.setResponseCode(http.BAD_REQUEST)
               return json.dumps({"error":message})

            logging.info("GET request received for id: %s" % id)

            session = self.session_manager.getSession(id)
            if not session:
               message = "No session with id: %s" % id
               logging.error(message)
               request.setResponseCode(http.NOT_FOUND)
               return json.dumps({"error":message})

            # Return session meta-data
            request.setResponseCode(http.OK)
            return json.dumps(filterResponse(session, self.field_filter))


    # -------------------------------------------------------------------------
    def render_DELETE(self, request):

        sys.stderr.write('render_DELETE\n')
        sys.stderr.write('reaquest=%s\n'%(request))

        # inject cross origin headers
        request.setHeader('Access-Control-Allow-Origin', '*')
        request.setHeader('Access-Control-Allow-Methods', 'GET')
        request.setHeader('Access-Control-Allow-Headers', 'x-prototype-version,x-requested-with')
        request.setHeader('Access-Control-Max-Age', 2520) # 42 hours

        session_id = extractSessionId(request)

        logging.info("DELETE request received for id: %s" % session_id)
        sys.stderr.write('id=%s\n'%(id))

        if not session_id:
            return handle_http_error(request, 'no session session_id was found')

        session = self.session_manager.getSession(session_id)
        if not session:
            handle_http_error(request, 'no session for id %s'%(session_id))

        # Remove session
        self.session_manager.deleteSession(session_id)

        logging.info('Deleted session with id: %s'%(session_id))

        request.setResponseCode(http.OK)
        return session


# -----------------------------------------------------------------------------
def startWebServer(options, config):
    # Extract properties from config
    log_dir  = str(config["configuration"]["log_dir"])
    content  = str(config["configuration"]["content"])
    endpoint = str(config["configuration"]["endpoint"])
    host     = str(config["configuration"]["host"])
    port     = int(config["configuration"]["port"])

    # Setup logging
    logFileName = log_dir + os.sep + "nersc_pvweb_session_manager.log"
    formatting = '%(asctime)s:%(levelname)s:%(name)s:%(message)s'
    logging.basicConfig(level=logging.DEBUG, filename=logFileName, filemode='w', format=formatting)
    observer = log.PythonLoggingObserver()
    observer.start()
    if options.debug:
        console = logging.StreamHandler(sys.stderr)
        console.setLevel(logging.INFO)
        formatter = logging.Formatter(formatting)
        console.setFormatter(formatter)
        logging.getLogger('').addHandler(console)

    # Initialize web resource
    web_resource = resource.Resource()

    # Attach launcher
    web_resource.putChild(endpoint, ConnectionBroker(options, config))

    site = server.Site(web_resource)
    reactor.listenTCP(port, site, interface=host)
    reactor.run()

# -----------------------------------------------------------------------------
def parse_config(options):
    # Read values from the configuration file
    try:
        config = json.loads(open(options.config[0]).read())
    except:
        message = "ERROR: Unable to read config file.\n"
        message += str(sys.exc_info()[1]) + "\n" + str(sys.exc_info()[2])
        print message
        print sample_config_file
        sys.exit(2)

    expected_keys = ["configuration", "apps", "properties", "resources"]
    if not validateKeySet(config, expected_keys, "Config file"):
        print sample_config_file
        sys.exit(2)

    expected_keys = ["endpoint", "host", "port", "proxy_file", "sessionURL", "timeout", "log_dir", "fields"]
    if not validateKeySet(config["configuration"], expected_keys, "file.configuration"):
        print sample_config_file
        sys.exit(2)

    if not config["configuration"].has_key("content"):
        config["configuration"]["content"] = ""

    return config

# -----------------------------------------------------------------------------
def add_arguments(parser):
#   -d, --debug
#   -t, --proxyFileType  Type of proxy file (txt, dbm)
    parser.add_argument("config", type=str,  nargs=1,
        help="configuration file for the launcher")
    parser.add_argument("-d", "--debug",
        help="log debugging messages to stdout",
        action="store_true")

    return parser

# -----------------------------------------------------------------------------
def start(argv=None,
         description="VTKWeb Launcher"):
    parser = argparse.ArgumentParser(description=description)
    add_arguments(parser)
    args = parser.parse_args(argv)
    config = parse_config(args)


    startWebServer(args, config)

# -----------------------------------------------------------------------------
if __name__ == "__main__":
    start()
