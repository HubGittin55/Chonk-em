#!/usr/bin/env python3
"""CHONK'EM sprite factory — ComfyUI Qwen Image 2.1, turbo recipe (8 steps).

Fast recipe from owner's Downloads workflows: euler_ancestral + beta/simple,
CFG 1.6/1.5, 8/7 steps, viggle-turbo LoRA. Chained image-edit for style
consistency. Magenta chroma background for clean alpha keying.

Run: ~/ComfyUI/venv/bin/python tools/gen_sprites.py cats"""
import json, os, shutil, subprocess, sys, time, urllib.request

SERVER = 'http://localhost:8188'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(REPO, 'assets', 'raw')
OUT = os.path.join(REPO, 'assets')
INPUT_DIR = os.path.expanduser('~/ComfyUI/input')
os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True); os.makedirs(INPUT_DIR, exist_ok=True)

LORA = 'qwen-img21/Qwen-Image-2.1-viggle-turbo-v0.3-6step-lora-r256.safetensors'
NEG = ('basic, simple, 3D, duplicated limbs, duplicated legs, six legs, more than four legs, '
       'too many eyes, multiple heads, skinny, thin, small, tiny, frail, '
       'background scenery, gradient background, shadow on the background, photorealistic, text, watermark, multiple cats')

def queue(graph):
    req = urllib.request.Request(SERVER + '/prompt',
        data=json.dumps({'prompt': graph}).encode(), headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req, timeout=30))['prompt_id']
    except urllib.error.HTTPError as e:
        sys.exit('QUEUE 400: ' + e.read().decode()[:1200])
    for _ in range(240):
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{SERVER}/history/{pid}', timeout=10))
        if pid in h:
            outs = h[pid].get('outputs', {})
            for o in outs.values():
                if o.get('images'):
                    img = o['images'][0]
                    return (img.get('subfolder', ''), img['filename'])
            sys.exit('generation failed: ' + json.dumps(h[pid])[:400])
    sys.exit('generation timeout')

def fetch(subfolder, filename, dest):
    req = f'{SERVER}/view?filename={filename}&subfolder={subfolder}&type=output'
    urllib.request.urlretrieve(req, dest)

def base_graph(steps, cfg, scheduler, lora_strength):
    g = {
      '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'qwen_image_2.1_int8_convrot.safetensors', 'weight_dtype': 'default'}},
      '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3-vl-8b-int8_convrot.safetensors', 'type': 'qwen_image'}},
      '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'qwen_image_2.1_vae_bf16.safetensors'}},
      '10': {'class_type': 'LoraLoader', 'inputs': {'model': ['1', 0], 'clip': ['2', 0],
              'lora_name': LORA, 'strength_model': lora_strength, 'strength_clip': lora_strength}},
      '6': {'class_type': 'KSampler', 'inputs': {'model': ['10', 0], 'steps': steps, 'cfg': cfg,
              'sampler_name': 'euler_ancestral', 'scheduler': scheduler, 'denoise': 1.0}},
      '7': {'class_type': 'VAEDecode', 'inputs': {'samples': ['6', 0], 'vae': ['3', 0]}},
      '8': {'class_type': 'SaveImage', 'inputs': {'images': ['7', 0], 'filename_prefix': 'chonkem/gen'}},
    }
    return g

def t2i(prompt, seed):
    g = base_graph(8, 1.6, 'beta', 0.9)
    g['4'] = {'class_type': 'TextEncodeQwenImage21', 'inputs': {
        'clip': ['10', 1], 'prompt': prompt, 'negative_prompt': NEG, 'resolution': 1024}}
    g['5'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': 1024, 'height': 1024, 'batch_size': 1}}
    g['6']['inputs'].update({'seed': seed, 'positive': ['4', 0], 'negative': ['4', 1], 'latent_image': ['5', 0]})
    return queue(g)

def edit(image_in, prompt, seed):
    g = base_graph(7, 1.5, 'simple', 1.0)
    g['9'] = {'class_type': 'LoadImage', 'inputs': {'image': image_in, 'upload_image': 'image'}}
    g['4'] = {'class_type': 'TextEncodeQwenImage21', 'inputs': {
        'clip': ['10', 1], 'prompt': prompt, 'negative_prompt': NEG, 'resolution': 1024, 'images': [['9', 0]]}}
    g['5'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': 1024, 'height': 1024, 'batch_size': 1}}
    g['6']['inputs'].update({'seed': seed, 'positive': ['4', 0], 'negative': ['4', 1], 'latent_image': ['5', 0]})
    return queue(g)

def prep(raw, out, height):
    subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'sprite_prep.py'), raw, out,
                    '--height', str(height)], check=True)

# ---------------------------------------------------------------------------
# CAT CHONK LADDER — 9 stages: 5 lb base + 10/20/.../80 lb, AoT bold linework
# ---------------------------------------------------------------------------
AOT = ('anime illustration in the Attack on Titan animation style with bold dark linework, '
       'gritty muted cel shading, gray tabby cat with dark stripes and pale underbelly, '
       'yellow eyes, full body side view facing left, standing on all four feet, '
       'isolated on solid pure magenta background, no scenery, no gradient, no ground shadow')

def cats():
    ladder('cat', 'gray tabby cat with dark stripes and pale underbelly', 5)

VARIETIES = {
  'orange': 'an orange ginger tabby cat with classic mackerel stripes, warm amber fur, cream underbelly, green eyes',
  'tuxedo': 'a black and white tuxedo cat, glossy black fur on back and head, white chest, belly, paws and muzzle, yellow-green eyes',
  'calico': 'a calico cat with patches of black, orange and white fur, pink nose, green eyes',
}

def ladder(var, desc, start_lb):
    """8-stage chonk ladder: 10/20/.../80 lb. t2i base at 10 lb, reinforced edit chain up."""
    weights = [lb for lb in [5,10,20,30,40,50,60,70,80] if lb >= start_lb]
    prev = None
    for lb in weights:
        aot = (f'anime illustration in the Attack on Titan animation style with bold dark linework, '
               f'gritty muted cel shading, {desc}, full body side view facing left, standing on all four feet, '
               f'isolated on solid pure magenta background, no scenery, no gradient, no ground shadow')
        if lb <= 10:
            body = ('a scrawny underfed cat, thin bony frame, visible ribs' if lb == 5 else
                    'a slightly plump healthy cat with a small round belly')
            out = t2i(f'Game asset sprite. {body}, {aot}', seed=4000 + lb + hash(var) % 900)
        else:
            extra = ('the most enormous chonker imaginable, a mountain of blubber, body wider than tall. ' if lb == 80 else '')
            prompt = (f'Game asset sprite. Make this cat MUCH fatter and heavier: twice as obese as the input cat, '
                      f'{lb} pounds of blubber, the massive corpulent belly dominates the composition and has several fat rolls, '
                      f'the belly sags and pools toward the ground, thick double chin and jowls, head and legs are even smaller by comparison, '
                      f'stubby little legs straining under the enormous weight. {extra}'
                      'Keep EXACTLY the same Attack on Titan bold-linework anime style, line weight, fur colors and markings, '
                      'side-view pose facing left, solid magenta background. EXACTLY four legs, two front two back.')
            out = edit(f'chonkem_{var}_w{prev}.png', prompt, seed=4000 + lb + hash(var) % 900)
        sub, fname = out
        raw = os.path.join(RAW, f'{var}_w{lb}.png')
        fetch(sub, fname, raw)
        shutil.copy(raw, os.path.join(INPUT_DIR, f'chonkem_{var}_w{lb}.png'))
        prep(raw, os.path.join(OUT, f'{var}_w{lb}.png'), 512)
        print(f'{var} {lb}lb done')
        prev = lb
    print(f'{var.upper()} LADDER DONE')

# ---------------------------------------------------------------------------
# PROPS — barrels (base + 9 content variants), bowl, yarn, shooter cat, kitchen bg
# ---------------------------------------------------------------------------
BARREL_BASE = ('Game asset sprite. A round wooden barrel seen straight from the front, iron hoops, '
  'wood grain, bold dark Attack on Titan anime linework, gritty cel shading, its round lid burst open with contents popping out toward the viewer, '
  'centered, isolated on solid pure magenta background, no scenery, no gradient, no ground shadow')
BARREL_VARIANTS = {
  'kibble':   'golden kibble pellets spilling out of the barrel',
  'salmon':   'a big pink salmon fillet bursting out of the barrel',
  'tuna':     'a plump blue tuna fish bursting out of the barrel',
  'broccoli': 'a huge green broccoli head bursting out of the barrel',
  'celery':   'long green celery stalks bursting out of the barrel',
  'multi':    'a glowing golden star radiating light beams out of the barrel',
  'wide':     'a golden bridge arch emblem glowing out of the barrel',
  'slow':     'an antique pocket clock with glowing hands bursting out of the barrel',
  'magnet':   'a red horseshoe magnet crackling with blue sparks bursting out of the barrel',
}

def props():
    out = t2i(BARREL_BASE, seed=5001)
    fetch(*out, 'assets/raw/barrel_base.png')
    shutil.copy('assets/raw/barrel_base.png', os.path.expanduser('~/ComfyUI/input/chonkem_barrel.png'))
    print('barrel base done')
    for i, (key, desc) in enumerate(BARREL_VARIANTS.items()):
        prompt = (f'Game asset sprite. Keep the exact same round wooden barrel, same Attack on Titan bold linework, same iron hoops, same size, same front view, same solid magenta background. '
                  f'Change ONLY the contents: {desc}. Keep EXACTLY the same barrel shape and style.')
        out = edit('chonkem_barrel.png', prompt, seed=5100 + i)
        fetch(*out, f'assets/raw/barrel_{key}.png')
        shutil.copy(f'assets/raw/barrel_{key}.png', os.path.expanduser(f'~/ComfyUI/input/chonkem_barrel_{key}.png'))
        prep(f'assets/raw/barrel_{key}.png', f'assets/barrel_{key}.png', 64)
        print(f'barrel {key} done')
    jobs = [
      ('bowl', 'Game asset sprite. A wide shallow ceramic cat food bowl, teal glazed ceramic with a thick rim, bold dark Attack on Titan anime linework, gritty cel shading, front three-quarter view, isolated on solid pure magenta background, no scenery, no gradient, no shadow'),
      ('yarn', 'Game asset sprite. A round ball of warm orange yarn with a loose trailing strand, bold dark Attack on Titan anime linework, gritty cel shading, isolated on solid pure magenta background, no scenery, no gradient, no shadow'),
      ('shooter', 'Game asset sprite. A scrawny gray tabby cat crouched behind a small wooden cannon barrel, pushing the cannon, side view facing left, determined anime face, bold dark Attack on Titan linework, gritty cel shading, isolated on solid pure magenta background, no scenery, no gradient, no ground shadow'),
    ]
    heights = {'bowl': 110, 'yarn': 30, 'shooter': 120}
    for key, prompt in jobs:
        out = t2i(prompt, seed=5200 + len(key))
        fetch(*out, f'assets/raw/{key}.png')
        prep(f'assets/raw/{key}.png', f'assets/{key}.png', heights[key])
        print(f'{key} done')
    # Kitchen background: full-scene portrait, no chroma keying
    g = base_graph(8, 1.6, 'beta', 0.9)
    g['4'] = {'class_type': 'TextEncodeQwenImage21', 'inputs': {
        'clip': ['10', 1],
        'prompt': 'Anime background art in the Attack on Titan animation style with bold dark linework and gritty warm cel shading: a cozy kitchen interior seen straight on, warm pastel walls, a big window with golden sunbeam on the left, wooden floorboards, a counter with jars on the right, low ceiling, empty center floor area, painterly, high detail, no characters, no text',
        'negative_prompt': 'people, cats, characters, text, watermark, photo, 3D render', 'resolution': 1024}}
    g['5'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': 1024, 'height': 1536, 'batch_size': 1}}
    g['6']['inputs'].update({'seed': 5300, 'positive': ['4', 0], 'negative': ['4', 1], 'latent_image': ['5', 0]})
    out = queue(g)
    fetch(*out, 'assets/raw/kitchen_bg.png')
    from PIL import Image
    im = Image.open('assets/raw/kitchen_bg.png').convert('RGB')
    im.thumbnail((600, 900))
    im.save('assets/kitchen_bg.png')
    print('kitchen bg done')
    print('PROPS DONE')

if __name__ == '__main__':
    job = sys.argv[1] if len(sys.argv) > 1 else 'cats'
    if job == 'cats': cats()
    elif job == 'props': props()
    elif job in VARIETIES: ladder(job, VARIETIES[job], 10)
    else: sys.exit(f'unknown job: {job}')
