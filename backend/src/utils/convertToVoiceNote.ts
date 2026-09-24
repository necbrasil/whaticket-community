import { spawn } from "child_process";

// WhatsApp only plays voice notes (ptt) encoded as OGG/Opus, while the panel
// records MP3. Needs the ffmpeg binary (installed in the Docker image).
const convertToVoiceNote = (input: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const ffmpeg = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      "pipe:0",
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "48k",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "ogg",
      "pipe:1"
    ]);

    const chunks: Buffer[] = [];
    let stderr = "";

    ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", code => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      }
    });

    // ffmpeg may exit before reading all input (EPIPE); "close" reports it
    ffmpeg.stdin.on("error", () => undefined);
    ffmpeg.stdin.end(input);
  });

export default convertToVoiceNote;
