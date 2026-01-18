from heartlib import HeartMuLaGenPipeline
import argparse
import torch


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", type=str, required=True)
    parser.add_argument("--version", type=str, default="3B")
    parser.add_argument("--lyrics", type=str, default="./assets/lyrics.txt")
    parser.add_argument("--tags", type=str, default="./assets/tags.txt")
    parser.add_argument("--save_path", type=str, default="./assets/output.mp3")

    parser.add_argument("--max_audio_length_ms", type=int, default=240_000)
    parser.add_argument("--topk", type=int, default=50)
    parser.add_argument("--temperature", type=float, default=1.0)
    parser.add_argument("--cfg_scale", type=float, default=1.5)
    parser.add_argument("--fp16", action="store_true", help="Use float16 instead of bfloat16")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    dtype = torch.float16 if args.fp16 else torch.bfloat16

    pipe = HeartMuLaGenPipeline.from_pretrained(
        args.model_path,
        device=torch.device("cuda"),
        dtype=dtype,
        version=args.version,
    )
    with torch.no_grad():
        pipe(
            {
                "lyrics": args.lyrics,
                "tags": args.tags,
            },
            max_audio_length_ms=args.max_audio_length_ms,
            save_path=args.save_path,
            topk=args.topk,
            temperature=args.temperature,
            cfg_scale=args.cfg_scale,
        )
    save_path = args.save_path.replace('.mp3', '.wav') if args.save_path.endswith('.mp3') else args.save_path
    print(f"Generated music saved to {save_path}")
