export class RingBuffer {
  private buf: string[] = [];
  constructor(private readonly capacity: number) {}

  push(line: string): void {
    this.buf.push(line);
    if (this.buf.length > this.capacity) this.buf.shift();
  }

  toArray(): string[] {
    return [...this.buf];
  }

  lastErrorMatching(re: RegExp): string | null {
    for (let i = this.buf.length - 1; i >= 0; i--) {
      if (re.test(this.buf[i]!)) return this.buf[i]!;
    }
    return null;
  }
}
