"""Original, reproducible Morrow Two blockout. Run with Blender 5.2 --background --python.

All dimensions are metres. Authoring coordinates below are the game's X east,
Y up, Z south; to_blender converts them to Blender's Z-up coordinate system.
The conceptual plan supplies relationships, not dimensions. No external assets.
"""
import bpy
import json
import math
import random
from pathlib import Path
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/source'
MODELS = ROOT / 'public/assets/models'
TEXTURES = ROOT / 'public/assets/textures'
for folder in (SOURCE, MODELS, TEXTURES):
    folder.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(27)
rng = np.random.default_rng(27)
groups = {}
colliders = []
surfaces = []
pieces = []
materials = {}
lights = []

def to_blender(p):
    return (p[0], -p[2], p[1])

def material(name, color, pattern='plaster', emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .93
    bsdf.inputs['Metallic'].default_value = 0
    if pattern:
        n = 128
        yy, xx = np.mgrid[0:n, 0:n]
        noise = rng.normal(0, .055, (n,n))
        low = np.repeat(np.repeat(rng.uniform(-.07,.07,(8,8)),16,0),16,1)
        shade = 1 + noise + low
        if pattern == 'brick':
            mortar = (yy % 16 < 2) | ((xx + ((yy//16)%2)*32) % 64 < 2)
            shade[mortar] = .58
            shade += ((yy % 16) / 16) * .035
        elif pattern == 'tile':
            shade[(xx % 32 < 2) | (yy % 32 < 2)] = .52
            shade += np.where(((xx//32 + yy//32)%2)==0, .06, -.03)
        elif pattern == 'wood':
            shade += .12*np.sin(xx*.19 + np.sin(yy*.03))
            shade[xx % 32 < 1] = .48
        elif pattern == 'metal':
            shade += np.sin(xx*.8)*.035
            shade[(yy > 115) & (noise > .03)] = .4
        elif pattern == 'asphalt':
            shade += rng.normal(0,.11,(n,n))
        elif pattern == 'carpet':
            shade += .06*((xx + yy)%2)
        else:
            shade[(yy<9) & (low<0)] *= .72
        pixels = np.ones((n,n,4), dtype=np.float32)
        pixels[:,:,:3] = np.clip(shade[:,:,None]*np.asarray(color),0,1)
        img = bpy.data.images.new(name + '-128px', width=n, height=n)
        img.pixels.foreach_set(pixels.ravel())
        img.filepath_raw = str(TEXTURES / (name + '.png'))
        img.file_format = 'PNG'
        img.save()
        img.pack()
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.interpolation = 'Closest'
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = (*color,1)
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color,1)
        bsdf.inputs['Emission Strength'].default_value = emission
    materials[name] = mat
    groups[name] = {'vertices': [], 'faces': [], 'uvs': []}
    return name

CONCRETE = material('weathered-concrete', (.43,.43,.39))
BEIGE = material('warm-plaster', (.67,.65,.55))
GREEN = material('institutional-green', (.27,.36,.30))
BRICK = material('soot-brick', (.36,.28,.23), 'brick')
TILE = material('worn-terrazzo', (.40,.43,.38), 'tile')
WOOD = material('old-wood', (.37,.25,.16), 'wood')
METAL = material('oxidized-steel', (.22,.25,.24), 'metal')
DARK = material('rubber-and-shadow', (.08,.09,.085), 'carpet')
BLUE = material('stair-blue', (.18,.34,.43), 'metal')
RED = material('stair-red', (.48,.21,.15), 'metal')
OCHRE = material('faded-ochre', (.56,.43,.21))
CREAM = material('sign-cream', (.81,.78,.65), None)
GLASS = material('window-night', (.14,.23,.26), None)
WARM = material('window-warm', (.55,.41,.23), None, .28)
LIGHT = material('fluorescent-glow', (.74,.82,.66), None, 1.2)
PAPER = material('paper', (.63,.60,.49))
ASPHALT = material('asphalt', (.19,.20,.19), 'asphalt')
CARPET = material('apartment-carpet', (.31,.28,.23), 'carpet')

def add_mesh(mat, vertices, faces, uvs=None):
    g = groups[mat]
    offset = len(g['vertices'])
    g['vertices'].extend(vertices)
    g['faces'].extend([tuple(offset+i for i in face) for face in faces])
    if uvs is None:
        uvs = [[(0,0),(1,0),(1,1),(0,1)][:len(face)] for face in faces]
    g['uvs'].extend(uvs)

def collider(name, x,y,z,w,h,d):
    colliders.append({'name':name,'min':[x-w/2,y-h/2,z-d/2], 'max':[x+w/2,y+h/2,z+d/2]})

def box(name, x,y,z,w,h,d,mat,solid=False,yaw=0):
    vertices=[]
    co, si=math.cos(yaw),math.sin(yaw)
    for dx,dy,dz in [(-1,-1,-1),(1,-1,-1),(1,-1,1),(-1,-1,1),(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1)]:
        a,b=dx*w/2,dz*d/2
        vertices.append(to_blender((x+a*co-b*si,y+dy*h/2,z+a*si+b*co)))
    # Game-to-Blender preserves handedness; these are outward faces.
    faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7),(0,3,7,4),(1,5,6,2)]
    sizes=[(w,d),(w,d),(w,h),(w,h),(d,h),(d,h)]
    uv=[[(0,0),(a/2,0),(a/2,b/2),(0,b/2)] for a,b in sizes]
    add_mesh(mat,vertices,faces,uv)
    pieces.append({'name':name,'position':[x,y,z],'size':[w,h,d],'material':mat,'yaw':yaw})
    if solid or 'ceiling' in name:
        collider(name,x,y,z,w,h,d)

def wall(name,x,z,w,d,y=0,height=3.4):
    box(name,x,y+height/2,z,w,height,d,BEIGE,True)
    # Paint bands overlay the flat wall faces, with worn 128px textures.
    box(name+'-paint',x,y+.69,z,w+.008,1.36,d+.008,GREEN)
    box(name+'-skirting',x,y+.07,z,w+.016,.13,d+.016,DARK)
    box(name+'-trim',x,y+1.39,z,w+.014,.065,d+.014,CONCRETE)

def floor(name,x0,x1,z0,z1,y=0,mat=TILE):
    box('floor-'+name,(x0+x1)/2,y-.12,(z0+z1)/2,x1-x0,.24,z1-z0,mat,True)
    surfaces.append({'name':name,'minX':x0,'maxX':x1,'minZ':z0,'maxZ':z1,'y':y})

def text(name,string,x,y,z,size=.34,mat=CREAM,facing='south'):
    curve=bpy.data.curves.new(name,'FONT')
    curve.body=string
    curve.size=size
    curve.align_x='CENTER'
    curve.align_y='CENTER'
    curve.extrude=.001
    curve.resolution_u=1
    ob=bpy.data.objects.new(name,curve)
    bpy.context.collection.objects.link(ob)
    ob.location=to_blender((x,y,z))
    ob.rotation_euler=(math.pi/2,0,{'south':0,'north':math.pi,'west':-math.pi/2,'east':math.pi/2}[facing])
    mesh=bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    verts=[tuple(ob.matrix_world@v.co) for v in mesh.vertices]
    faces=[tuple(p.vertices) for p in mesh.polygons]
    add_mesh(mat,verts,faces,[[(0,0)]*len(f) for f in faces])
    bpy.data.objects.remove(ob,do_unlink=True)
    bpy.data.meshes.remove(mesh)

def sign(name,label,x,y,z,w=2,h=.65,mat=DARK,size=.28,facing='south'):
    box(name+'-back',x,y,z,w,h,.06,mat)
    text(name,label,x,y,z+(.036 if facing=='south' else -.036),size,CREAM,facing)

def door_frame(name,x,z,y=0,w=2.2):
    for side in (-1,1):
        box(name+'-jamb',x+side*(w/2+.06),y+1.25,z,.12,2.5,.25,METAL)
    box(name+'-lintel',x,y+2.52,z,w+.24,.14,.25,METAL)

def closed_door(name,x,z,label,y=0,mat=WOOD):
    box(name,x,y+1.2,z,1.24,2.4,.09,mat)
    for side in (-1,1):
        box(name+'-frame',x+side*.66,y+1.24,z,.08,2.48,.18,METAL)
    box(name+'-frame-top',x,y+2.45,z,1.4,.08,.18,METAL)
    box(name+'-handle',x+.43,y+1.0,z+.08,.18,.045,.06,CREAM)
    sign(name+'-label',label,x,y+2.78,z+.06,1.45,.35,DARK,.16)

def fixture(name,x,y,z,w=1.2):
    box(name+'-housing',x,y,z,w,.12,.27,METAL)
    box(name+'-tube',x,y-.072,z,w-.10,.028,.15,LIGHT)
    lights.append({'name':name,'position':[x,y-.24,z],'color':[.80,.85,.68],'intensity':.55,'range':6})

def rod(name,a,b,r=.027,mat=METAL):
    a,b=Vector(to_blender(a)),Vector(to_blender(b))
    direction=(b-a).normalized()
    u=direction.cross(Vector((1,0,0)))
    if u.length<.1: u=direction.cross(Vector((0,0,1)))
    u.normalize()
    v=direction.cross(u).normalized()
    vertices=[]
    for end in (a,b):
        for i in range(6):
            vertices.append(tuple(end+r*(u*math.cos(i*math.tau/6)+v*math.sin(i*math.tau/6))))
    faces=[tuple(range(5,-1,-1)),tuple(range(6,12))]
    faces += [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]
    add_mesh(mat,vertices,faces,[[(0,0)]*len(f) for f in faces])

# Exterior court and approach. Physical shell keeps the 13-storey skyline.
floor('south-court',-24,24,16,29,0,CONCRETE)
floor('north-service-court',-24,24,-30,-16,0,ASPHALT)
floor('west-side-path',-24,-15,-16,16,0,CONCRETE)
floor('east-side-path',15,24,-16,16,0,ASPHALT)
box('site-ground',0,-.38,0,150,.3,190,ASPHALT)
for x in (-15,15):
    wall('outer-side',x,0,.36,32,0,6.8)
for z,name in ((16,'main'),(-16,'service')):
    for x in (-8.2,8.2):
        wall(name+'-facade',x,z,13.6,.36,0,6.8)
    wall(name+'-header',0,z,2.8,.36,2.65,4.15)
    door_frame(name,0,z,w=2.8)
box('south-canopy',0,3.3,17.0,8.4,.32,2.5,CONCRETE)
sign('morrow-two-name','MORROW TWO',0,3.8,16.23,8.2,.80,DARK,.60)
sign('bell-ward','BELL WARD  /  MORROW EXTENSION',0,2.93,18.28,5.8,.31,GREEN,.19)
sign('service-exit-sign','SERVICE  /  REAR EXIT',0,2.9,-16.25,4,.5,BLUE,.25,'north')
for x in (-2.4,2.4):
    box('entrance-light',x,2.5,16.26,.24,.56,.19,LIGHT)
    box('entry-bollard',x, .53,18.3,.22,1.06,.22,METAL,True)
for z in (23,-21):
    for x in (-13,13):
        box('court-lamp-post',x,2.7,z,.13,5.4,.13,METAL,True)
        box('court-lamp',x,5.32,z,.6,.18,.6,LIGHT)

# Ground circulation is deliberately discontinuous beneath the ramps.
floor('lobby',-14.8,14.8,5.1,15.85)
floor('south-threshold',-1.39,1.39,15.7,16.2)
floor('service-hall-east',8.15,14.8,-13,5.1)
floor('service-hall-north',-3.0,14.8,-15.85,-9)
floor('rear-entry',-2.9,2.9,-16.2,-13)
floor('east-bottom-landing',4.1,8.2,5,7)
floor('west-bottom-landing',-8.2,-4.1,5,7)
box('lobby-ceiling',0,3.29,10.45,29.6,.20,10.5,CONCRETE)
box('service-hall-ceiling',11.5,3.29,-2.2,6.7,.20,14.6,CONCRETE)
box('rear-ceiling',5.9,3.29,-12.5,17.8,.20,6.65,CONCRETE)

# Core and symmetric stairs flank it. Movement is a 10m smooth ramp under 24 visual treads.
wall('elevator-core',0,0,6,10,0,6.8)
for side in (-1,1):
    sx=6*side
    label='A' if side<0 else 'B'
    mat=RED if side<0 else BLUE
    for wx in (sx-1.95,sx+1.95):
        wall('stair-'+label+'-enclosure',wx,0,.25,10.1,0,6.8)
    surfaces.append({'name':'stair-'+label,'minX':sx-1.82,'maxX':sx+1.82,'minZ':-5,'maxZ':5,'y':3.4,'rise':-3.4})
    for i in range(24):
        z=5-(i+.5)*10/24
        y=(i+1)*3.4/24
        box('stair-'+label+'-tread-'+str(i),sx,y/2-.03,z,3.65,y+.06,10/24,CONCRETE)
        box('stair-'+label+'-nosing-'+str(i),sx,y+.004,z+10/48-.035,3.63,.015,.07,CREAM)
    for edge in (-1,1):
        rx=sx+edge*1.65
        rod('stair-'+label+'-handrail',(rx,1.0,5),(rx,4.4,-5),.035,mat)
        for i in range(0,25,6):
            z=5-i*10/24
            y=i*3.4/24
            rod('stair-'+label+'-post',(rx,y,z),(rx,y+1,z),.025,mat)
    box('stair-'+label+'-entry-band',sx,2.87,5.10,3.66,.59,.18,mat)
    sign('stair-'+label+'-entrance','STAIR '+label+'  /  02',sx,2.87,5.21,3.2,.4,mat,.30)
    sign('stair-'+label+'-upper','STAIR '+label+'  /  01',sx,6.15,-5.21,3.2,.4,mat,.29,'north')
    fixture('stair-'+label+'-light',sx,5.95,-1)
    # Painted floor stripe remains readable from the lobby and the top landing.
    box('stair-'+label+'-floor-stripe',sx,.008,6.4,2.4,.014,.38,mat)

# Elevator fronts: disabled, spatially central, visible from the lobby choice point.
for x in (-1.45,1.45):
    box('elevator-surround',x,1.3,5.08,2.32,2.6,.15,METAL)
    box('elevator-door',x,1.25,5.18,2.06,2.45,.06,CONCRETE)
    box('elevator-seam',x,1.25,5.225,.035,2.45,.025,DARK)
    sign('elevator-closed','OUT OF SERVICE',x,1.65,5.23,1.75,.43,RED,.18)
sign('elevator-title','LIFTS  1 / 2',0,2.98,5.22,4.1,.42,DARK,.25)

# Lobby side rooms are shell-only. Their doors communicate ordinary residential use.
wall('management-divider',-10,11,.24,8)
wall('package-divider',10,11,.24,8)
closed_door('management-door',-12.4,7.08,'MANAGEMENT')
closed_door('package-door',12.25,7.08,'PACKAGES')
wall('management-front',-12.4,7,4.8,.22)
wall('package-front',12.4,7,4.8,.22)
wall('ground-west-room-front',-11.5,5,6.8,.28)
closed_door('community-door',-11.5,5.19,'COMMUNITY ROOM')
wall('laundry-inner',8.05,-5.0,.24,10.0)
closed_door('laundry-door',14.05,-8.82,'LAUNDRY',0,GREEN)
wall('laundry-rear',14.05,-9,1.6,.26)
wall('rear-maintenance-front',-1.5,-9,3.2,.24)
closed_door('maintenance-door',-1.5,-8.8,'MAINTENANCE',0,METAL)
sign('rear-wayfinding','REAR SERVICE  >',10.8,2.65,5.3,3.1,.5,BLUE,.23)
sign('lobby-neighborhood','MORROW EXTENSION',-5,2.4,15.76,4.5,.55,GREEN,.29,'north')

# Mailboxes, bench, notices, doormat, bins and everyday clutter.
for i in range(12):
    x=-7+(i%4)*.58
    y=1.0+(i//4)*.38
    box('mailbox',x,y,14.75,.52,.33,.38,METAL)
    box('mail-slot',x,y+.05,14.545,.30,.024,.016,DARK)
    box('mail-label',x,y-.07,14.542,.12,.048,.018,CREAM)
box('lobby-bench-seat',4.5,.48,13.8,3.0,.17,.68,WOOD,True)
box('lobby-bench-back',4.5,.93,14.1,3.0,.74,.13,WOOD)
for x in (3.35,5.65): box('bench-leg',x,.21,13.8,.12,.42,.52,METAL)
box('entrance-mat',0,.011,14,3.0,.018,1.6,DARK)
box('noticeboard',-8.8,1.7,13.3,.09,1.25,2.1,WOOD)
for i in range(6):
    box('notice-paper',-8.73,1.5+(i//3)*.45,12.65+(i%3)*.6,.03,.37,.45,PAPER)
box('lobby-rubbish-bin',7.7,.4,14.5,.55,.8,.55,GREEN,True)
for x,z in ((0,10),(-6,8),(6,8),(10.8,-2),(5,-12)):
    fixture('ground-practical',x,3.12,z)

# Residential corridor and apartment. Width 4m allows a shoulder camera and reversing.
floor('level2-north-corridor',-12.8,13,-9,-5,3.4)
wall('level2-west-end',-13,-7,.25,4.25,3.4,3.4)
wall('level2-east-end',13.2,-7,.25,4.25,3.4,3.4)
wall('corridor-south-left',-10.5,-5,5.0,.24,3.4,3.4)
wall('corridor-south-center',0,-5,8.0,.24,3.4,3.4)
wall('corridor-south-right',10.6,-5,5.3,.24,3.4,3.4)
wall('corridor-north-left',-4.1,-9,18.0,.25,3.4,3.4)
wall('corridor-north-right',10.15,-9,6.1,.25,3.4,3.4)
wall('apartment204-header',6,-9,2.2,.25,5.98,.82)
door_frame('apartment204',6,-9,3.4,2.2)
sign('apartment204-number','204',6,6.36,-8.84,1.5,.44,OCHRE,.30)
for x,label in ((-10.7,'201'),(-6.5,'202'),(-1.5,'203'),(10.3,'205')):
    closed_door('apartment-'+label,x,-8.82,label,3.4)
for x,label in ((-10.5,'210'),(0,'209'),(10.5,'208')):
    # Double-loaded corridor doors on opposite wall.
    box('south-unit-door',x,4.60,-5.16,1.25,2.4,.08,WOOD)
    sign('south-unit-'+label,label,x,6.18,-5.23,1.4,.35,DARK,.2,'north')
box('corridor-ceiling',0,6.7,-7,26.5,.20,4.3,CONCRETE)
for x in (-9,-1,8): fixture('corridor-light',x,6.55,-7)
sign('corridor-wayfinding','02    RESIDENTIAL',-2.5,6.24,-8.8,4,.40,GREEN,.24)
box('corridor-runner',0,3.408,-7,23,.013,1.25,CARPET)
box('corridor-bag',-11.6,3.7,-8.28,.62,.6,.52,DARK,True)
box('corridor-parcel',-10.8,3.68,-8.24,.55,.56,.48,OCHRE,True)

# Apartment 204, 11 x 6 metres with compact kitchen and living-room furniture.
floor('apartment204',2,13,-15.85,-9,3.4,CARPET)
wall('apartment204-west',2,-12.4,.24,6.8,3.4,3.4)
wall('apartment204-east',13.15,-12.4,.24,6.8,3.4,3.4)
box('apartment204-ceiling',7.5,6.69,-12.4,11,.20,6.8,BEIGE)
box('apartment-window',7.5,5.2,-15.78,4.8,1.65,.06,GLASS)
for x in (5.1,7.5,9.9): box('apartment-window-frame',x,5.2,-15.70,.08,1.85,.14,WOOD)
for y in (4.28,6.12): box('apartment-window-frame',7.5,y,-15.70,4.95,.08,.14,WOOD)
box('couch-base',3.2,3.73,-12.7,1.28,.64,2.7,GREEN,True)
box('couch-back',2.70,4.18,-12.7,.27,1.00,2.7,GREEN)
for z in (-13.93,-11.47): box('couch-arm',3.2,4.06,z,1.3,.65,.24,GREEN)
box('coffee-table',5.3,3.9,-12.7,1.6,.17,1.0,WOOD,True)
for x in (4.72,5.88):
    for z in (-13.04,-12.36): box('table-leg',x,3.65,z,.09,.5,.09,METAL)
box('television-stand',6.6,3.7,-15.0,2.1,.6,.62,WOOD,True)
box('crt-television',6.6,4.32,-15,.82,.7,.55,DARK)
box('crt-screen',6.6,4.35,-14.714,.69,.51,.035,GLASS)
box('kitchen-counter',11.8,3.9,-14.6,2.0,1.0,1.3,GREEN,True)
box('countertop',11.8,4.43,-14.6,2.14,.10,1.42,CONCRETE)
box('kitchen-cupboard',11.8,5.72,-15.3,2.05,1.0,.58,WOOD)
box('sink',11.3,4.49,-14.6,.67,.024,.55,METAL)
box('fridge',12.1,4.35,-10.1,1.0,1.9,.9,BEIGE,True)
box('fridge-handle',11.76,4.45,-9.625,.05,.42,.07,METAL)
box('ledger-desk',10.0,4.20,-12,1.8,.15,.85,WOOD,True)
for x in (9.28,10.72):
    for z in (-12.31,-11.69): box('desk-leg',x,3.82,z,.08,.84,.08,METAL)
for i in range(3): box('desk-papers',9.5+i*.16,4.285+i*.002,-11.95,.31,.014,.40,PAPER,yaw=.12*i)
box('apartment-light-housing',7.8,6.51,-12.1,.48,.18,.48,DARK)
box('apartment-light',7.8,6.39,-12.1,.35,.04,.35,WARM)
lights.append({'name':'apartment-warm-practical','position':[7.8,6.15,-12.1],'color':[1,.76,.47],'intensity':1.0,'range':7})

# Exterior upper shell: 11 unplayable levels plus roof above the two-floor encounter.
box('upper-tower-shell',0,25.55,0,30,37.5,32,CONCRETE)
for story in range(2,13):
    y=story*3.4+1.8
    box('floor-stringcourse',0,story*3.4+.05,0,30.36,.20,32.36,CONCRETE)
    for x in range(-12,13,4):
        for z in (-16.04,16.04):
            mat=WARM if (story*7+x)%11<2 else GLASS
            box('tower-window',x,y,z,1.9,1.75,.08,mat)
            box('window-sill',x,y-.91,z,2.07,.12,.32,CONCRETE)
            box('window-mullion',x,y,z+(.046 if z>0 else -.046),.045,1.74,.035,METAL)
    for z in (-12,-6,0,6,12):
        for x in (-15.045,15.045):
            box('side-window',x,y,z,.07,1.75,1.9,GLASS)
box('tower-roof-cap',0,44.4,0,31,.35,33,METAL)
box('roof-stair-head',-6,46.0,-2,5,3.0,6,CONCRETE)
for x in (-11,11): box('roof-vent',x,45.3,6,1.4,1.6,1.4,METAL)

def neighbor(name,z):
    box(name,0,22.1,z,30,44.2,29,BRICK)
    for story in range(13):
        y=story*3.4+1.9
        box(name+'-band',0,story*3.4+.15,z,30.3,.19,29.3,CONCRETE)
        for x in range(-12,13,4):
            for zz in (z-14.55,z+14.55):
                box(name+'-window',x,y,zz,1.85,1.65,.06,GLASS)
    sign(name+'-name',name.upper(),0,4.2,z+14.7,9,.85,DARK,.65)
neighbor('Morrow One',-64)
neighbor('Morrow Three',64)

# Eastern service-industrial edge and the Split Stack landmark, south of its yard.
box('repair-yard-workshop',42,4.1,-9,19,8.2,40,BRICK)
box('repair-yard-roof',42,8.34,-9,20,.23,41,METAL)
sign('repair-yard-name','BELL WARD REPAIRS',42,6.5,11.7,15,1.6,DARK,.86)
for z in (-23,-13,-3,7):
    box('workshop-window',32.4,4.5,z,.08,2.0,5,GLASS)
for z in range(-30,21,4):
    box('yard-fence-post',27,1.25,z,.10,2.5,.10,METAL)
    for y in (.45,1.25,2.05): rod('yard-rail',(27,y,z),(27,y,z+4),.027,METAL)
for z in (14,17):
    rod('split-stack', (37,0,z), (37,32,z), 1.35, BRICK)
    rod('split-stack-rim', (37,31.5,z), (37,32.2,z), 1.55, METAL)
box('stack-base',37,1.0,15.5,7,2,7,CONCRETE)
for x,z in ((-11,-22),(12,-24)):
    box('service-dumpster',x,.72,z,2.8,1.4,1.5,GREEN,True)
    box('dumpster-lid',x,1.48,z,2.95,.12,1.65,DARK)
for x in (-8,-4,4,8): box('parking-paint',x,.012,-24,.08,.015,5,CREAM)

# Readable courtyard boundary keeps this encounter from becoming a world simulation.
for x in (-24,24): collider('encounter-boundary',x,2,0,.3,4,60)
for z in (-30,29): collider('encounter-boundary',0,2,z,48,4,.3)

# Export one merged static mesh per material, retaining the source pieces as metadata.
for mat,g in groups.items():
    if not g['vertices']: continue
    mesh=bpy.data.meshes.new(mat+'-mesh')
    mesh.from_pydata(g['vertices'],[],g['faces'])
    mesh.materials.append(materials[mat])
    mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for polygon,coords in zip(mesh.polygons,g['uvs']):
        for li,coord in zip(polygon.loop_indices,coords): uv.data[li].uv=coord
    ob=bpy.data.objects.new('Morrow-'+mat,mesh)
    bpy.context.collection.objects.link(ob)
    ob['authored_units']='metres'
    ob['purpose']='Merged static architecture; rebuild from scripts/build-morrow-level.py'
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene['encounter_dimensions']='30 x 32m; level rise 3.4m; corridor 4m; stair clear width 3.65m; 204 door 2.2m'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'morrow-two-blockout.blend'))
bpy.ops.export_scene.gltf(filepath=str(MODELS/'morrow-level.glb'),export_format='GLB',export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
data={
    'version':1,'units':'metres','north':[0,0,-1],
    'colliders':colliders,'surfaces':surfaces,'lights':lights,
    'door':{'id':'apartment204','center':[6,4.61,-9],'size':[2.16,2.42,.16]},
    'spawn':[0,0,21],'ledger':[10,4.38,-12],'exit':[0,0,-20],
    'markers':{'lobby':[0,0,10],'stairA':[-6,0,5.8],'stairATop':[-6,3.4,-6.8],'corridor':[0,3.4,-7],'apartment':[6,3.4,-10.5],'stairB':[6,3.4,-6.8],'stairBBottom':[6,0,6],'serviceTurn':[10.8,0,6],'serviceHall':[10.8,0,-12],'rearDoor':[0,0,-15]},
    'dimensions':{'towerWidth':30,'towerDepth':32,'storeyHeight':3.4,'corridorWidth':4,'door204ClearWidth':2.2,'stairsClearWidth':3.65,'stairRun':10,'visualTreads':24}
}
(ROOT/'src/level-data.json').write_text(json.dumps(data,indent=2)+'\n')
(SOURCE/'morrow-two-pieces.json').write_text(json.dumps(pieces,indent=2)+'\n')
print('MORROW EXPORT COMPLETE',len(pieces),'pieces',len(colliders),'colliders',len(surfaces),'surfaces')
