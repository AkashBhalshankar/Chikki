export interface AudioTask {
  chunkId: number;
  text: string;
  audioBlobUrl: string;
}

export class VoiceQueue {
  private queue: AudioTask[] = [];
  private isPlaying = false;
  private currentAudio: HTMLAudioElement | null = null;
  private onChunkStart?: (chunkId: number, text: string) => void;
  private onQueueEmpty?: () => void;

  constructor(
    onChunkStart?: (chunkId: number, text: string) => void,
    onQueueEmpty?: () => void
  ) {
    this.onChunkStart = onChunkStart;
    this.onQueueEmpty = onQueueEmpty;
  }

  public enqueue(task: AudioTask) {
    this.queue.push(task);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      if (this.onQueueEmpty) {
        this.onQueueEmpty();
      }
      return;
    }

    this.isPlaying = true;
    const task = this.queue.shift()!;
    this.currentAudio = new Audio(task.audioBlobUrl);

    if (this.onChunkStart) {
      this.onChunkStart(task.chunkId, task.text);
    }

    this.currentAudio.onended = () => {
      URL.revokeObjectURL(task.audioBlobUrl);
      this.playNext();
    };

    this.currentAudio.onerror = () => {
      this.playNext();
    };

    this.currentAudio.play().catch(() => {
      this.playNext();
    });
  }

  public interrupt() {
    this.queue = [];
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }
}