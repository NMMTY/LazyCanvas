import { deflateSync } from "node:zlib";

/**
 * APNG Encoder that works directly with Uint8ClampedArray (ImageData)
 * Much faster than encoding each frame to PNG separately
 */
export class APNGEncoder {
  private frames: Uint8ClampedArray[] = [];
  private width: number;
  private height: number;
  private fps: number;

  constructor(width: number, height: number, fps: number = 30) {
    this.width = width;
    this.height = height;
    this.fps = fps;
  }

  /**
   * Add a frame from ImageData
   */
  public addFrame(imageData: Uint8ClampedArray) {
    if (imageData.length !== this.width * this.height * 4) {
      throw new Error(
        `Invalid ImageData size. Expected ${this.width * this.height * 4}, got ${imageData.length}`,
      );
    }
    this.frames.push(imageData);
    return this;
  }

  public addFrames(...imageDatas: Uint8ClampedArray[]) {
    for (const imageData of imageDatas) {
      this.addFrame(imageData);
    }
    return this;
  }

  /**
   * Encode all frames to APNG buffer
   */
  public encode(): Buffer {
    if (this.frames.length === 0) {
      throw new Error("No frames to encode");
    }

    const chunks: Buffer[] = [];

    // PNG signature
    chunks.push(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    // IHDR chunk
    chunks.push(this.createIHDR());

    // acTL chunk (animation control)
    chunks.push(this.createACTL());

    // Add all frames with proper sequence numbering
    let sequenceNumber = 0;
    for (let i = 0; i < this.frames.length; i++) {
      chunks.push(...this.createFrame(i, sequenceNumber));
      // First frame: fcTL (0) + IDAT = 1 chunk with sequence
      // Other frames: fcTL (n) + fdAT (n+1) = 2 chunks with sequences
      sequenceNumber += i === 0 ? 1 : 2;
    }

    // IEND chunk
    chunks.push(this.createIEND());

    return Buffer.concat(chunks);
  }

  /**
   * Create IHDR chunk (image header)
   */
  private createIHDR(): Buffer {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(this.width, 0);
    data.writeUInt32BE(this.height, 4);
    data[8] = 8; // bit depth
    data[9] = 6; // color type: RGBA
    data[10] = 0; // compression method
    data[11] = 0; // filter method
    data[12] = 0; // interlace method

    return this.createChunk("IHDR", data);
  }

  /**
   * Create acTL chunk (animation control)
   */
  private createACTL(): Buffer {
    const data = Buffer.alloc(8);
    data.writeUInt32BE(this.frames.length, 0); // num_frames
    data.writeUInt32BE(0, 4); // num_plays (0 = infinite)

    return this.createChunk("acTL", data);
  }

  /**
   * Create frame chunks (fcTL + fdAT or IDAT)
   * @param frameIndex - Index of the frame (0-based)
   * @param sequenceNumber - Global sequence number for fcTL/fdAT chunks
   */
  private createFrame(frameIndex: number, sequenceNumber: number): Buffer[] {
    const chunks: Buffer[] = [];

    // fcTL chunk (frame control) - always comes first
    const fctl = Buffer.alloc(26);
    fctl.writeUInt32BE(sequenceNumber, 0); // sequence_number
    fctl.writeUInt32BE(this.width, 4); // width
    fctl.writeUInt32BE(this.height, 8); // height
    fctl.writeUInt32BE(0, 12); // x_offset
    fctl.writeUInt32BE(0, 16); // y_offset

    // Frame delay (delay_num / delay_den seconds)
    const delayNum = 1;
    const delayDen = this.fps;
    fctl.writeUInt16BE(delayNum, 20);
    fctl.writeUInt16BE(delayDen, 22);

    fctl[24] = 0; // dispose_op: APNG_DISPOSE_OP_NONE
    fctl[25] = 0; // blend_op: APNG_BLEND_OP_SOURCE

    chunks.push(this.createChunk("fcTL", fctl));

    // Compress frame data
    const imageData = this.frames[frameIndex];
    const compressed = this.compressImageData(imageData);

    // First frame uses IDAT (no sequence number), subsequent frames use fdAT
    if (frameIndex === 0) {
      chunks.push(this.createChunk("IDAT", compressed));
    } else {
      // fdAT includes sequence number (sequenceNumber + 1 for the data chunk)
      const fdatData = Buffer.alloc(4 + compressed.length);
      fdatData.writeUInt32BE(sequenceNumber + 1, 0);
      compressed.copy(fdatData, 4);
      chunks.push(this.createChunk("fdAT", fdatData));
    }

    return chunks;
  }

  /**
   * Compress ImageData using PNG filter and zlib
   */
  private compressImageData(imageData: Uint8ClampedArray): Buffer {
    const bytesPerPixel = 4; // RGBA
    const stride = this.width * bytesPerPixel;
    const filtered = Buffer.alloc(imageData.length + this.height);

    // Apply PNG filter type 0 (None) to each scanline
    for (let y = 0; y < this.height; y++) {
      const offset = y * stride;
      const filteredOffset = y * (stride + 1);

      filtered[filteredOffset] = 0; // Filter type: None
      imageData.subarray(offset, offset + stride).forEach((byte, i) => {
        filtered[filteredOffset + 1 + i] = byte;
      });
    }

    // Compress with zlib
    return deflateSync(filtered, { level: 6 });
  }

  /**
   * Create IEND chunk
   */
  private createIEND(): Buffer {
    return this.createChunk("IEND", Buffer.alloc(0));
  }

  /**
   * Create a PNG chunk with length, type, data, and CRC
   */
  private createChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);

    const typeBuffer = Buffer.from(type, "ascii");
    const crc = this.crc32(Buffer.concat([typeBuffer, data]));
    const crcBuffer = Buffer.alloc(4);
    crcBuffer.writeUInt32BE(crc, 0);

    return Buffer.concat([length, typeBuffer, data, crcBuffer]);
  }

  /**
   * Calculate CRC32 checksum
   */
  private crc32(data: Buffer): number {
    let crc = 0xffffffff;

    for (let i = 0; i < data.length; i++) {
      crc = this.crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  /**
   * CRC32 lookup table
   */
  private crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c;
    }
    return table;
  })();

  /**
   * Get number of frames
   */
  public getFrameCount(): number {
    return this.frames.length;
  }

  /**
   * Clear all frames
   */
  public clear(): void {
    this.frames = [];
  }
}

export default APNGEncoder;

/**
 * Helper function to create APNG from ImageData array
 */
export function createAPNG(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  fps: number = 30,
): Buffer {
  const encoder = new APNGEncoder(width, height, fps);

  for (const frame of frames) {
    encoder.addFrame(frame);
  }

  return encoder.encode();
}
