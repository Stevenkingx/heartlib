<p align="center">
    <picture>
        <source srcset="./assets/logo.png" media="(prefers-color-scheme: dark)">
        <img src="./assets/logo.png" width="30%">
    </picture>
    
</p>

<p align="center">
    <a href="https://heartmula.github.io/">Demo 🎶</a> &nbsp;|&nbsp; 📑 <a href="https://arxiv.org/pdf/2601.10547">Paper</a>
    <br>
    <a href="https://huggingface.co/HeartMuLa/HeartMuLa-oss-3B">HeartMuLa-oss-3B 🤗</a> &nbsp;|&nbsp; <a href="https://modelscope.cn/models/HeartMuLa/HeartMuLa-oss-3B">HeartMuLa-oss-3B <picture>
        <source srcset="./assets/badge.svg" media="(prefers-color-scheme: dark)">
        <img src="./assets/badge.svg" width="20px">
    </picture></a>
    
</p>

---
# HeartMuLa: A Family of Open Sourced Music Foundation Models

HeartMuLa is a family of open sourced music foundation models including: 
1. HeartMuLa: a music language model that generates music conditioned on lyrics and tags with multilingual support including but not limited to English, Chinese, Japanese, Korean and Spanish.
2. HeartCodec: a 12.5 hz music codec with high reconstruction fidelity;
3. HeartTranscriptor: a whisper-based model specifically tuned for lyrics transcription; Check [this page](./examples/README.md) for its usage.
4. HeartCLAP: an audio–text alignment model that establishes a unified embedding space for music descriptions and cross-modal retrieval.
---


Below shows the experiment result of our oss-3B version compared with other baselines.
<p align="center">
    <picture>
        <source srcset="./assets/exp.png" media="(prefers-color-scheme: dark)">
        <img src="./assets/exp.png" width="90%">
    </picture>
    
</p>

---

## 🔥 Highlight

Our latest internal version of HeartMuLa-7B achieves **comparable performance with Suno** in terms of musicality, fidelity and controllability. If you are interested, welcome to reach us out via heartmula.ai@gmail.com

## 📰 News

- 🚀 **14 Jan. 2026**  
  The official release of **HeartTranscriptor-oss** and the first **HeartMuLa-oss-3B** version along with our **HeartCodec-oss**.

---
## 🧭 TODOs

- ⏳ Release scripts for inference acceleration and streaming inference. The current inference speed is around RTF $\approx 1.0$.
- ⏳ Support **reference audio conditioning**, **fine-grained controllable music generation**, **hot song generation**.
- ⏳ Release the **HeartMuLa-oss-7B** version.
- ✅ Release inference code and pretrained checkpoints of  
  **HeartCodec-oss, HeartMuLa-oss-3B, and HeartTranscriptor-oss**.

---

## 🛠️ Local Deployment

### ⚙️ Environment Setup

We recommend using `python=3.10` for local deployment.

Clone this repo and install locally.

```
git clone https://github.com/HeartMuLa/heartlib.git
cd heartlib
pip install -e .
```

Download our pretrained checkpoints from huggingface or modelscope using the following command:

```
# if you are using huggingface
hf download --local-dir './ckpt' 'HeartMuLa/HeartMuLaGen'
hf download --local-dir './ckpt/HeartMuLa-oss-3B' 'HeartMuLa/HeartMuLa-oss-3B'
hf download --local-dir './ckpt/HeartCodec-oss' 'HeartMuLa/HeartCodec-oss'

# if you are using modelscope
modelscope download --model 'HeartMuLa/HeartMuLaGen' --local_dir './ckpt'
modelscope download --model 'HeartMuLa/HeartMuLa-oss-3B' --local_dir './ckpt/HeartMuLa-oss-3B'
modelscope download --model 'HeartMuLa/HeartCodec-oss' --local_dir './ckpt/HeartCodec-oss'
```

After downloading, the `./ckpt` subfolder should structure like this:
```
./ckpt/
├── HeartCodec-oss/
├── HeartMuLa-oss-3B/
├── gen_config.json
└── tokenizer.json
```


### ▶️ Example Usage

To generate music, run:

```
python ./examples/run_music_generation.py --model_path=./ckpt --version="3B"
```

By default this command will generate a piece of music conditioned on lyrics and tags provided in `./assets` folder. The output music will be saved at `./assets/output.mp3`.

All parameters:

- `--model_path` (required): Path to the pretrained model checkpoint
- `--lyrics`: Path to lyrics file (default: `./assets/lyrics.txt`)
- `--tags`: Path to tags file (default: `./assets/tags.txt`)
- `--save_path`: Output audio file path (default: `./assets/output.mp3`)
- `--max_audio_length_ms`: Maximum audio length in milliseconds (default: 240000)
- `--topk`: Top-k sampling parameter for generation (default: 50)
- `--temperature`: Sampling temperature for generation (default: 1.0)
- `--cfg_scale`: Classifier-free guidance scale (default: 1.5)
- `--version`: The version of HeartMuLa, choose between [`3B`, `7B`]. (default: `3B`) # `7B` version not released yet.

Recommended format of lyrics and tags:
```txt
[Intro]

[Verse]
The sun creeps in across the floor
I hear the traffic outside the door
The coffee pot begins to hiss
It is another morning just like this

[Prechorus]
The world keeps spinning round and round
Feet are planted on the ground
I find my rhythm in the sound

[Chorus]
Every day the light returns
Every day the fire burns
We keep on walking down this street
Moving to the same steady beat
It is the ordinary magic that we meet

[Verse]
The hours tick deeply into noon
Chasing shadows,chasing the moon
Work is done and the lights go low
Watching the city start to glow

[Bridge]
It is not always easy,not always bright
Sometimes we wrestle with the night
But we make it to the morning light

[Chorus]
Every day the light returns
Every day the fire burns
We keep on walking down this street
Moving to the same steady beat

[Outro]
Just another day
Every single day
```

Our different tags are comma-separated without spaces as illustrated below:
```txt
piano,happy,wedding,synthesizer,romantic
```

---

## 🌐 Web UI

HeartMuLa includes a web interface for easier music generation without using the command line.

### Features

- **User Authentication** - Register and login to keep your generations private and organized
- **Modern card-based UI** - Clean, modern interface with glass-morphism design
- **AI-assisted lyrics** - Generate lyrics, tags and title using OpenAI (optional)
- **Generation queue** - Queue multiple generations and track progress in real-time
- **History** - Browse, play, and download your past generations (per-user isolation)
- **Auto GPU detection** - Automatically detects NVIDIA (CUDA), AMD (ROCm), or CPU
- **Audio player** - Built-in player with download support
- **Auto-generated thumbnails** - AI-generated album art using DALL-E (optional)

### Quick Start

1. **Install dependencies and build the frontend:**
   ```bash
   ./install.sh
   ```
   The installer will:
   - Detect your GPU (NVIDIA/AMD/CPU)
   - Set up a Python virtual environment
   - Install PyTorch with appropriate GPU support
   - Install all dependencies
   - Build the web frontend
   - Optionally download model checkpoints

2. **Start the Web UI:**
   ```bash
   ./start.sh
   ```

3. **Open your browser** at http://localhost:5173

4. **Create an account** - Register with username, email and password to start generating music

### Database

The Web UI uses SQLite for data storage. The database is automatically created on first run at `web/data/heartmula.db` with the following tables:

- **users** - User accounts (id, username, email, password_hash, created_at)
- **generations** - Music generations linked to users (includes audio path, settings, etc.)

No manual database setup is required - migrations run automatically on startup.

### Start Script Options

```bash
./start.sh [OPTIONS]

Options:
  --model-path PATH    Path to model checkpoints (default: ./ckpt)
  --version VERSION    Model version: 3B or 1B (default: 3B)
  --fp16               Use float16 instead of bfloat16
  --dev                Run in development mode (hot reload)
  --backend-port PORT  Backend server port (default: 8000)
  --frontend-port PORT Frontend dev server port (default: 5173)
```

### Environment Variables

You can also configure via environment variables:
- `HEARTMULA_MODEL_PATH` - Path to model checkpoints
- `HEARTMULA_VERSION` - Model version (3B or 1B)
- `HEARTMULA_FP16` - Use float16 (true/false)
- `JWT_SECRET_KEY` - Secret key for JWT tokens (auto-generated if not set)
- `OPENAI_API_KEY` - OpenAI API key for AI lyrics and thumbnail generation (optional)

### API Endpoints

The backend exposes a REST API. Most endpoints require authentication via Bearer token.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/status` | GET | No | System status (GPU, model loaded) |
| `/api/auth/register` | POST | No | Create a new user account |
| `/api/auth/login` | POST | No | Login and get JWT token |
| `/api/auth/me` | GET | Yes | Get current user info |
| `/api/generate` | POST | Yes | Start a new generation |
| `/api/queue` | GET | Yes | Get queue status (user's items only) |
| `/api/queue/{id}` | DELETE | Yes | Cancel a generation (owner only) |
| `/api/history` | GET | Yes | List past generations (user's only) |
| `/api/history/{id}` | GET | Yes | Get generation details (owner only) |
| `/api/history/{id}` | DELETE | Yes | Delete a generation (owner only) |
| `/api/audio/{id}` | GET | No | Stream/download audio file |
| `/api/thumbnail/{id}` | GET | No | Get thumbnail image |
| `/api/ai/lyrics` | POST | Yes | Generate lyrics with AI (requires OpenAI) |
| `/api/ai/thumbnail` | POST | Yes | Generate thumbnail with AI (requires OpenAI) |
| `/ws/progress` | WebSocket | No | Real-time progress updates |

---

## 🙏 Acknowledgements

This repository is developed on the basis of [ConversationTTS](https://github.com/Audio-Foundation-Models/ConversationTTS). We thank the authors for their open source contributions.

## ⚖️ License & Ethics Statement

This repository is licensed under the
Creative Commons Attribution–NonCommercial 4.0 International License (CC BY-NC 4.0).

🔒 For non-commercial research and educational use only

🚫 Any commercial use is strictly prohibited

⚠️ Users are solely responsible for ensuring that generated content does not infringe any third-party copyrights

---

## 📚 Citation

```
@misc{yang2026heartmulafamilyopensourced,
      title={HeartMuLa: A Family of Open Sourced Music Foundation Models}, 
      author={Dongchao Yang and Yuxin Xie and Yuguo Yin and Zheyu Wang and Xiaoyu Yi and Gongxi Zhu and Xiaolong Weng and Zihan Xiong and Yingzhe Ma and Dading Cong and Jingliang Liu and Zihang Huang and Jinghan Ru and Rongjie Huang and Haoran Wan and Peixu Wang and Kuoxi Yu and Helin Wang and Liming Liang and Xianwei Zhuang and Yuanyuan Wang and Haohan Guo and Junjie Cao and Zeqian Ju and Songxiang Liu and Yuewen Cao and Heming Weng and Yuexian Zou},
      year={2026},
      eprint={2601.10547},
      archivePrefix={arXiv},
      primaryClass={cs.SD},
      url={https://arxiv.org/abs/2601.10547}, 
}
```

## 📬 Contact
If you are interested in HeartMuLa, feel free to reach us at heartmula.ai@gmail.com