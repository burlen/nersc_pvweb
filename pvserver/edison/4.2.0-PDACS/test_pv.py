
from paraview.simple import *

#ReverseConnect('11111')
Connect('11111')

c = Cone()
c.Resolution = 128
Hide(c)

p = ProcessIdScalars()
r = Show(p)
a = p.PointData.GetArray('ProcessId')
r.ColorArrayName = 'ProcessId'
AssignLookupTable(a,'Cool to Warm')
Render()

#SaveScreenshot('/usr/common/graphics/ParaView/4.2.0-PDACS/data/test.png')
SaveScreenshot('test.png')
