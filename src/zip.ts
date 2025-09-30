interface ZipFileInfo {
	filename: string;
	encrypted: boolean;
	compressedSize: number;
	uncompressedSize: number;
	compressionMethod: number;
	crc32: number;
	lastModified: Date;
	offset: number;
}

export class ZipReader {
	private dataView: DataView;
	private files: ZipFileInfo[] = [];

	constructor(arrayBuffer: ArrayBuffer) {
		this.dataView = new DataView(arrayBuffer);
		this.parse();
	}

	private parse(): void {
		// Find End of Central Directory Record (EOCD)
		const eocdOffset = this.findEOCD();
		if (eocdOffset === -1) {
			throw new Error('Not a valid ZIP file: EOCD not found');
		}

		// Read EOCD to get central directory location
		const centralDirSize = this.dataView.getUint32(eocdOffset + 12, true);
		const centralDirOffset = this.dataView.getUint32(eocdOffset + 16, true);
		const numEntries = this.dataView.getUint16(eocdOffset + 10, true);

		// Parse central directory entries
		let offset = centralDirOffset;
		for (let i = 0; i < numEntries; i++) {
			const signature = this.dataView.getUint32(offset, true);
			if (signature !== 0x02014b50) {
				throw new Error('Invalid central directory signature');
			}

			const fileInfo = this.parseCentralDirectoryEntry(offset);
			this.files.push(fileInfo);

			// Move to next entry
			const filenameLen = this.dataView.getUint16(offset + 28, true);
			const extraLen = this.dataView.getUint16(offset + 30, true);
			const commentLen = this.dataView.getUint16(offset + 32, true);
			offset += 46 + filenameLen + extraLen + commentLen;
		}
	}

	private findEOCD(): number {
		// EOCD signature: 0x06054b50
		// Search from end of file backwards (EOCD is typically at the end)
		const maxCommentSize = 65535;
		const searchStart = Math.max(0, this.dataView.byteLength - maxCommentSize - 22);

		for (let i = this.dataView.byteLength - 22; i >= searchStart; i--) {
			if (this.dataView.getUint32(i, true) === 0x06054b50) {
				return i;
			}
		}
		return -1;
	}

	private parseCentralDirectoryEntry(offset: number): ZipFileInfo {
		const versionNeeded = this.dataView.getUint16(offset + 6, true);
		const generalPurpose = this.dataView.getUint16(offset + 8, true);
		const compressionMethod = this.dataView.getUint16(offset + 10, true);
		const lastModTime = this.dataView.getUint16(offset + 12, true);
		const lastModDate = this.dataView.getUint16(offset + 14, true);
		const crc32 = this.dataView.getUint32(offset + 16, true);
		const compressedSize = this.dataView.getUint32(offset + 20, true);
		const uncompressedSize = this.dataView.getUint32(offset + 24, true);
		const filenameLen = this.dataView.getUint16(offset + 28, true);
		const localHeaderOffset = this.dataView.getUint32(offset + 42, true);

		// Read filename
		const filenameBytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + offset + 46, filenameLen);
		const filename = new TextDecoder().decode(filenameBytes);

		// Check if encrypted (bit 0 of general purpose flag)
		const encrypted = (generalPurpose & 0x0001) !== 0;

		// Convert DOS date/time to JavaScript Date
		const lastModified = this.dosDateTimeToDate(lastModDate, lastModTime);

		return {
			filename,
			encrypted,
			compressedSize,
			uncompressedSize,
			compressionMethod,
			crc32,
			lastModified,
			offset: localHeaderOffset,
		};
	}

	private dosDateTimeToDate(dosDate: number, dosTime: number): Date {
		const year = ((dosDate >> 9) & 0x7f) + 1980;
		const month = ((dosDate >> 5) & 0x0f) - 1;
		const day = dosDate & 0x1f;
		const hour = (dosTime >> 11) & 0x1f;
		const minute = (dosTime >> 5) & 0x3f;
		const second = (dosTime & 0x1f) * 2;

		return new Date(year, month, day, hour, minute, second);
	}

	private getCompressionMethodName(method: number): string {
		const methods: { [key: number]: string } = {
			0: 'Stored',
			8: 'Deflated',
			12: 'BZIP2',
			14: 'LZMA',
			93: 'Zstandard',
			95: 'XZ',
			97: 'WavPack',
			98: 'PPMd',
		};
		return methods[method] || `Unknown (${method})`;
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hour = String(date.getHours()).padStart(2, '0');
		const minute = String(date.getMinutes()).padStart(2, '0');
		const second = String(date.getSeconds()).padStart(2, '0');
		return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
	}

	private formatCRC32(crc: number): string {
		return crc.toString(16).padStart(8, '0');
	}

	public getFiles(): ZipFileInfo[] {
		return this.files;
	}

	public extractFile(filename: string): ReadableStream<Uint8Array> | null {
		const fileInfo = this.files.find((f) => f.filename === filename);
		if (!fileInfo) {
			return null;
		}

		// Read local file header to get actual data offset
		const localHeaderOffset = fileInfo.offset;
		const signature = this.dataView.getUint32(localHeaderOffset, true);
		if (signature !== 0x04034b50) {
			throw new Error('Invalid local file header signature');
		}

		const filenameLen = this.dataView.getUint16(localHeaderOffset + 26, true);
		const extraLen = this.dataView.getUint16(localHeaderOffset + 28, true);
		const dataOffset = localHeaderOffset + 30 + filenameLen + extraLen;

		// Extract compressed data
		const compressedData = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + dataOffset, fileInfo.compressedSize);

		// Create stream based on compression method
		if (fileInfo.compressionMethod === 0) {
			// Stored (no compression) - return stream of uncompressed data
			return new ReadableStream({
				start(controller) {
					controller.enqueue(compressedData);
					controller.close();
				},
			});
		} else if (fileInfo.compressionMethod === 8) {
			// Deflate compression - return decompressed stream
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(compressedData);
					controller.close();
				},
			});

			return stream.pipeThrough(new DecompressionStream('deflate-raw'));
		} else {
			throw new Error(`Unsupported compression method: ${fileInfo.compressionMethod}`);
		}
	}
}
