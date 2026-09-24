import bpy
from mathutils import Vector
from pathlib import Path
root=Path.cwd()
bpy.ops.wm.open_mainfile(filepath=str(root/'art/source/morrow-two-blockout.blend'))
s=bpy.context.scene
s.render.engine='CYCLES'
s.cycles.samples=12
s.render.resolution_x=960
s.render.resolution_y=540
s.render.resolution_percentage=100
s.world.use_nodes=True
s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.4,.45,.5,1)
s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.6
lamp=bpy.data.lights.new('Preview key','SUN');lamp.energy=1.5
ob=bpy.data.objects.new('Preview key',lamp);bpy.context.collection.objects.link(ob);ob.rotation_euler=(.65,-.4,-.6)
for xyz in [(0,-10,2.8),(-6,1,5.5),(6,1,5.5),(0,7,6.3),(8,12,6.2)]:
 lamp=bpy.data.lights.new('Preview fill','AREA');lamp.energy=110;lamp.shape='DISK';lamp.size=4
 ob=bpy.data.objects.new('Preview fill',lamp);bpy.context.collection.objects.link(ob);ob.location=xyz
camd=bpy.data.cameras.new('Preview');cam=bpy.data.objects.new('Preview',camd);bpy.context.collection.objects.link(cam);s.camera=cam;camd.lens=28
for name,pos,target in [('south',(0,-23,2),(0,-5,2.5)),('lobby',(0,-12,1.9),(0,-2,1.9)),('corridor',(-10,7,5.1),(8,7,5.1))]:
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(root/('art/source/blockout-preview-'+name+'.png'));bpy.ops.render.render(write_still=True)
