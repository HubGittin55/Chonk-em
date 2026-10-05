#!/usr/bin/env python3
"""Generate the CHONK'EM main-cat sprite stages via ComfyUI Qwen Image 2.1.
Stage 0 via t2i; stages 1-4 chained through image-edit for style consistency.
Run: ~/ComfyUI/venv/bin/python tools/gen_sprites.py"""
import json, os, shutil, subprocess, sys, time, urllib.request

SERVER = 'http://localhost:8188'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(REPO, 'assets', 'raw')
OUT = os.path.join(REPO, 'assets')
INPUT_DIR = os.path.expanduser('~/ComfyUI/input')
os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True); os.makedirs(INPUT_DIR, exist_ok=True)

STYLE = ('clean thick cartoon outline, flat vector sticker illustration, vibrant warm colors, '
         'side view facing left, sitting, green eyes, pink nose, isolated on solid pure magenta background, '
         'no scenery, no gradient, no ground shadow, cut-out sticker style')
NEG = 'background scenery, gradient background, shadow on the background, photorealistic, text, watermark, multiple cats'

def queue(graph):
    req = urllib.request.Request(SERVER + '/prompt',
        data=json.dumps({'prompt': graph}).encode(), headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req, timeout=30))['prompt_id']
    except urllib.error.HTTPError as e:
        sys.exit('QUEUE 400: ' + e.read().decode()[:1200])
    for _ in range(240):
        time.sleep(5)
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

def base_graph(model_nodes):
    return {
      '1': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'qwen_image_2.1_int8_convrot.safetensors', 'weight_dtype': 'default'}},
      '2': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3-vl-8b-int8_convrot.safetensors', 'type': 'qwen_image'}},
      '3': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'qwen_image_2.1_vae_bf16.safetensors'}},
      '6': {'class_type': 'KSampler', 'inputs': {'model': ['1', 0], 'steps': 25, 'cfg': 2.0,
              'sampler_name': 'euler', 'scheduler': 'simple', 'denoise': 1.0}},
      '7': {'class_type': 'VAEDecode', 'inputs': {'samples': ['6', 0], 'vae': ['3', 0]}},
      '8': {'class_type': 'SaveImage', 'inputs': {'images': ['7', 0], 'filename_prefix': 'chonkem/gen'}},
    }

def t2i(prompt, seed):
    g = base_graph(None)
    g['4'] = {'class_type': 'TextEncodeQwenImage21', 'inputs': {
        'clip': ['2', 0], 'prompt': prompt, 'negative_prompt': NEG, 'resolution': 1024}}
    g['5'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': 1024, 'height': 1024, 'batch_size': 1}}
    g['6']['inputs'].update({'seed': seed, 'positive': ['4', 0], 'negative': ['4', 1], 'latent_image': ['5', 0]})
    return queue(g)

def edit(image_in, prompt, seed):
    g = base_graph(None)
    g['9'] = {'class_type': 'LoadImage', 'inputs': {'image': image_in, 'upload_image': 'image'}}
    g['4'] = {'class_type': 'TextEncodeQwenImage21', 'inputs': {
        'clip': ['2', 0], 'prompt': prompt, 'negative_prompt': NEG, 'resolution': 1024, 'images': [['9', 0]]}}
    g['5'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': 1024, 'height': 1024, 'batch_size': 1}}
    g['6']['inputs'].update({'seed': seed, 'positive': ['4', 0], 'negative': ['4', 1], 'latent_image': ['5', 0]})
    return queue(g)

CHONK = [
  'scrawny skinny orange tabby cat, thin bony body, small',
  'slightly chubby orange tabby cat, small belly',
  'chonky orange tabby cat, round belly, thick body',
  'very fat orange tabby cat, huge saggy belly, heavy jowls, thick legs',
  'glorious absolute-unit orange tabby cat, enormous round loaf body, massive belly pooling on the ground, double chin jowls, tiny legs',
]
EDIT_PROMPT = ('Make this cat chonkier: noticeably fatter and rounder than the input, one step heavier. '
  'Keep EXACTLY the same art style, line weight, colors, pose, facing direction, camera angle, and solid magenta background. '
  'Same cat, same sticker illustration, just one chonk-stage fatter.')

stages = int(sys.argv[1]) if len(sys.argv) > 1 else 5
prev = None
for i in range(stages):
    if i == 0:
        out = t2i(f'Game asset sprite of a {CHONK[0]} cat sitting, full body, {STYLE}', seed=1000)
    else:
        out = edit(f'chonkem_stage{prev}.png', f'Game asset sprite. {EDIT_PROMPT}', seed=1100 + i)
    sub, fname = out
    raw = os.path.join(RAW, f'cat_stage{i}.png')
    fetch(sub, fname, raw)
    shutil.copy(raw, os.path.join(INPUT_DIR, f'chonkem_stage{i}.png'))
    subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'sprite_prep.py'), raw,
                    os.path.join(OUT, f'cat_stage{i}.png'), '--height', '420'], check=True)
    print(f'stage {i} done')
    prev = i
print('ALL STAGES DONE')
