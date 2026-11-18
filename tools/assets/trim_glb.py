"""Trim a GLB to what the game uses: keep only the named animations and the base-colour texture (other
material maps are dropped; the game bakes colours into vertices and never reads them), downscaled to
`size` px. Pass a PNG made by tools/assets/resize-texture.cjs as the 5th argument to use that instead of
ffmpeg for the first image (identical colours in the game). Keep the original in assets-src/models/originals/.
  python3 tools/assets/trim_glb.py in.glb out.glb Idle,Walk_InPlace,Run_InPlace,Attack,FallingBack 512 [base512.png]
(v4.31: zombieidle.glb 6.2 → 2.75 MB, verified with tools/browser/bakecheck.cjs)"""
import json, struct, sys, subprocess, tempfile, os
src, dst, keep, size = sys.argv[1], sys.argv[2], set(sys.argv[3].split(',')), int(sys.argv[4])
d = open(src, 'rb').read()
jl = struct.unpack_from('<I', d, 12)[0]
j = json.loads(d[20:20 + jl])
bo = 20 + jl + 8
bl = struct.unpack_from('<I', d, 20 + jl)[0]
bin_ = d[bo:bo + bl]

# animations to keep
j['animations'] = [a for a in j.get('animations', []) if a['name'] in keep]
missing = keep - {a['name'] for a in j['animations']}
assert not missing, missing

# textures: only base colour maps survive; other material maps go
used_tex = set()
for m in j['materials']:
    for k in ['normalTexture', 'occlusionTexture', 'emissiveTexture']:
        m.pop(k, None)
    pbr = m.get('pbrMetallicRoughness', {})
    pbr.pop('metallicRoughnessTexture', None)
    if 'baseColorTexture' in pbr: used_tex.add(pbr['baseColorTexture']['index'])
tex_map = {old: new for new, old in enumerate(sorted(used_tex))}
textures = [j['textures'][i] for i in sorted(used_tex)]
used_img = sorted({t['source'] for t in textures})
img_map = {old: new for new, old in enumerate(used_img)}
for t in textures: t['source'] = img_map[t['source']]
for m in j['materials']:
    pbr = m.get('pbrMetallicRoughness', {})
    if 'baseColorTexture' in pbr: pbr['baseColorTexture']['index'] = tex_map[pbr['baseColorTexture']['index']]
images = [j['images'][i] for i in used_img]
j['textures'] = textures

# accessors still referenced
used_acc = set()
for mesh in j['meshes']:
    for p in mesh['primitives']:
        used_acc.update(p['attributes'].values())
        if 'indices' in p: used_acc.add(p['indices'])
        for t in p.get('targets', []): used_acc.update(t.values())
for sk in j.get('skins', []):
    if 'inverseBindMatrices' in sk: used_acc.add(sk['inverseBindMatrices'])
for a in j['animations']:
    for s in a['samplers']: used_acc.update([s['input'], s['output']])
acc_list = sorted(used_acc)
acc_map = {old: new for new, old in enumerate(acc_list)}
accessors = [j['accessors'][i] for i in acc_list]

# rebuild the binary: used buffer views only; images replaced with downscaled PNGs
out = bytearray()
views = []
view_map = {}
def add_view(data, extra):
    while len(out) % 4: out.append(0)
    v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
    v.update(extra)
    out.extend(data)
    views.append(v)
    return len(views) - 1
for a in accessors:
    old = a['bufferView']
    if old not in view_map:
        v = j['bufferViews'][old]
        data = bin_[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        view_map[old] = add_view(data, {k: v[k] for k in ('byteStride', 'target') if k in v})
    a['bufferView'] = view_map[old]
tmp = tempfile.mkdtemp()
for i, im in enumerate(images):
    v = j['bufferViews'][im['bufferView']]
    png = bin_[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    pi, po = os.path.join(tmp, f'{i}.png'), os.path.join(tmp, f'{i}s.png')
    open(pi, 'wb').write(png)
    w, h = struct.unpack('>II', png[16:24])
    # a replacement made by the browser itself (same drawImage downscale the game's texture sampler does)
    if len(sys.argv) > 5 and i == 0:
        png = open(sys.argv[5], 'rb').read()
    elif w > size or h > size:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', pi, '-vf', f'scale={size}:{size}:flags=area', po], check=True)
        png = open(po, 'rb').read()
    im['bufferView'] = add_view(png, {})
j['images'] = images
j['accessors'] = accessors
for mesh in j['meshes']:
    for p in mesh['primitives']:
        p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
        if 'indices' in p: p['indices'] = acc_map[p['indices']]
        if 'targets' in p: p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
for sk in j.get('skins', []):
    if 'inverseBindMatrices' in sk: sk['inverseBindMatrices'] = acc_map[sk['inverseBindMatrices']]
for a in j['animations']:
    for s in a['samplers']: s['input'], s['output'] = acc_map[s['input']], acc_map[s['output']]
j['bufferViews'] = views
while len(out) % 4: out.append(0)
j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb)
print(f'{src}: {len(d)} -> {len(glb)} bytes; animations {[a["name"] for a in j["animations"]]}; images {len(images)}')
