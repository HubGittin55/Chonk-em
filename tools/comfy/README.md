# ComfyUI asset pipeline (Qwen Image 2.1)

Server: http://localhost:8188 (GPU1 / RTX 3090). Models at /mnt/ComUI:
`qwen_image_2.1_int8_convrot` (unet) + `qwen3vl_8b_int8_convrot` (PE/clip) + `qwen_image_2.1_vae_bf16`.

- `qwen-t2i.workflow.json` — text → image (PE prompt-rewriting built in)
- `qwen-image-edit.workflow.json` — image edit: background removal, restyle, "make it chonkier" (up to 10 input images)

Both are litegraph workflows with subgraphs — open in the ComfyUI UI, or drive via the
comfy-mcp MCP server in pi (`generate_image`, `enqueue_workflow`, `get_image`).

Sprite conventions for CHONK'EM:
- 1024x1024 source, flat chroma background (magenta #ff00ff) for clean alpha extraction
- Output PNGs land in `assets/` named `<part>_<variant>.png` (e.g. `cat_body_chonk3.png`)
- Game loads via drawImage with vector-draw fallback if the asset 404s (see TASKS.md asset-pipeline)

NOTE: requires ComfyUI core with TextEncodeQwenImage21 (post-v0.36 master).
