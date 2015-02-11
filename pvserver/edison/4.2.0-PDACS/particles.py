r"""
    This module is a VTK Web server application.
    The following command line illustrate how to use it::

        $ vtkpython .../vtk_web_cone.py

    Any VTK Web executable script come with a set of standard arguments that
    can be overriden if need be::
        --host localhost
             Interface on which the HTTP server will listen on.

        --port 8080
             Port number on which the HTTP server will listen to.

        --content /path-to-web-content/
             Directory that you want to server as static web content.
             By default, this variable is empty which mean that we rely on another server
             to deliver the static content and the current process only focus on the
             WebSocket connectivity of clients.

        --authKey vtk-secret
             Secret key that should be provided by the client to allow it to make any
             WebSocket communication. The client will assume if none is given that the
             server expect "vtk-secret" as secret key.
"""

# import to process args
import sys
import os

# import paraview modules.
from paraview import servermanager, vtk
from paraview.simple import *
from paraview.web import wamp      as pv_wamp
from paraview.web import protocols as pv_protocols

from vtk.web import server

# import annotations
from autobahn.wamp import exportRpc

try:
    import argparse
except ImportError:
    # since  Python 2.6 and earlier don't have argparse, we simply provide
    # the source for the same as _argparse and we use it instead.
    import _argparse as argparse

# =============================================================================
# Create custom File Opener class to handle clients requests
# =============================================================================

class _WebCone(pv_wamp.PVServerProtocol):

    # Application configuration
    view    = None
    authKey = "vtkweb-secret"
    fileName = None

    def initialize(self):
        global renderer, renderWindow, renderWindowInteractor, cone, mapper, actor

        # Bring used components
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebMouseHandler())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPort())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPortImageDelivery())
        self.registerVtkWebProtocol(pv_protocols.ParaViewWebViewPortGeometryDelivery())

        # Update authentication key to use
        self.updateSecret(_WebCone.authKey)

        # Create default pipeline (Only once for all the session)
        if not _WebCone.view:
            m000_ = GenericIOReader( FileName=self.fileName )

            m000_.xAxis = 'x'
            m000_.yAxis = 'y'
            m000_.zAxis = 'z'
            m000_.PointArrayStatus = ['vx', 'vy', 'vz', 'id', 'fof_halo_tag']

            self.view = GetRenderView()
            DataRepresentation1 = Show()
            DataRepresentation1.ScaleFactor = 12.799999237060547
            DataRepresentation1.ScalarOpacityUnitDistance = 1.7320512506334491
            DataRepresentation1.SelectionPointFieldDataArrayName = 'fof_halo_tag'
            DataRepresentation1.EdgeColor = [0.0, 0.0, 0.50000762951094835]

            self.view.CenterOfRotation = [63.999996662139893, 63.999996185302734, 63.999996185302734]

            Calculator1 = Calculator()

            self.view.CameraPosition = [63.999996662139893, 63.999996185302734, 492.29631710692331]
            self.view.CameraFocalPoint = [63.999996662139893, 63.999996185302734, 63.999996185302734]
            self.view.CameraClippingRange = [296.65336530365192, 595.04075617962826]
            self.view.CameraParallelScale = 110.85124480185661

            DataRepresentation2 = Show()
            DataRepresentation2.ScaleFactor = 12.799999237060547
            DataRepresentation2.ScalarOpacityUnitDistance = 1.7320512506334491
            DataRepresentation2.SelectionPointFieldDataArrayName = 'fof_halo_tag'
            DataRepresentation2.EdgeColor = [0.0, 0.0, 0.50000762951094835]

            DataRepresentation1.Visibility = 0

            Calculator1.Function = 'iHat*vx + jHat*vy + kHat*vz'
            Calculator1.ResultArrayName = 'velocity'

            self.view.Background2 = [0.0, 0.0, 0.16470588235294117]
            self.view.Background = [0.0, 0.0, 0.0]
            self.view.CenterAxesVisibility = 0

            a3_velocity_PVLookupTable = GetLookupTableForArray( "velocity", 3, RGBPoints=[22.220290592721472, 0.27843099999999998, 0.27843099999999998, 0.85882400000000003, 2772.329145661583, 0.0, 0.0, 0.36078399999999999, 5503.2064702754178, 0.0, 1.0, 1.0, 8272.5468557993063, 0.0, 0.50196099999999999, 0.0, 11003.42418041314, 1.0, 1.0, 0.0, 13753.533035482002, 1.0, 0.38039200000000001, 0.0, 16503.641890550865, 0.41960799999999998, 0.0, 0.0, 19253.750745619727, 0.87843099999999996, 0.30196099999999998, 0.30196099999999998], VectorMode='Magnitude', NanColor=[1.0, 1.0, 0.0], ColorSpace='RGB', ScalarRangeInitialized=1.0 )
            a3_velocity_PiecewiseFunction = CreatePiecewiseFunction( Points=[22.220290592721472, 0.0, 0.5, 0.0, 19253.750745619727, 1.0, 0.5, 0.0] )
            ScalarBarWidgetRepresentation1 = CreateScalarBar( ComponentTitle='Magnitude', Title='velocity', Enabled=1, LabelFontSize=8, TitleFontSize=8 )
            ScalarBarWidgetRepresentation1.LookupTable = a3_velocity_PVLookupTable
            self.view.Representations.append(ScalarBarWidgetRepresentation1)

            DataRepresentation2.ScalarOpacityFunction = a3_velocity_PiecewiseFunction
            DataRepresentation2.ColorArrayName = ('POINT_DATA', 'velocity')
            DataRepresentation2.PointSize = 1.0
            DataRepresentation2.LookupTable = a3_velocity_PVLookupTable

            a3_velocity_PVLookupTable.ScalarOpacityFunction = a3_velocity_PiecewiseFunction

            Render()

            # Fix lookup table range
            data = Calculator1.GetPointDataInformation()
            (minValue, maxValue) = data.GetArray('velocity').GetRange(-1)
            rgbPoints = a3_velocity_PVLookupTable.RGBPoints
            rgbPointsMod = []
            for i in range(8):
                alpha = i / 7.0
                rgbPointsMod.append((1 - alpha) * minValue + alpha * maxValue)
                rgbPointsMod.append(rgbPoints[4*i + 1])
                rgbPointsMod.append(rgbPoints[4*i + 2])
                rgbPointsMod.append(rgbPoints[4*i + 3])
            a3_velocity_PVLookupTable.RGBPoints = rgbPointsMod

            Render()

# =============================================================================
# Main: Parse args and start server
# =============================================================================

if __name__ == "__main__":
    # Create argument parser
    parser = argparse.ArgumentParser(description="VTK/Web Cone web-application")

    # Add default arguments
    server.add_arguments(parser)
    parser.add_argument("--fileName")

    # Exctract arguments
    args = parser.parse_args()

    # Configure our current application
    _WebCone.authKey = args.authKey
    _WebCone.fileName = args.fileName

    # Start server
    server.start_webserver(options=args, protocol=_WebCone)
