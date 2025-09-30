import { describe, it, expect } from 'vitest';
import { ZipReader } from '../src/zip';

/**
 * Base64 encoded test.zip
 *
 * Tree structure:
 * .
 * ├── file1.txt (14 bytes, stored)
 * ├── file2.txt (21 bytes, stored)
 * └── file3.txt (21 bytes, deflated)
 *
 * File contents:
 * - file1.txt: "Hello, World!\n"
 * - file2.txt: "This is a test file.\n"
 * - file3.txt: "Line 1\nLine 2\nLine 3\n"
 */
const TEST_ZIP_BASE64 =
	'UEsDBAoAAAAAALiAPluEnui0DgAAAA4AAAAJABwAZmlsZTEudHh0VVQJAANLYtxoTGLcaHV4CwABBPUBAAAEFAAAAEhlbGxvLCBXb3JsZCEKUEsDBAoAAAAAALiAPlteuIPaFQAAABUAAAAJABwAZmlsZTIudHh0VVQJAANLYtxoTGLcaHV4CwABBPUBAAAEFAAAAFRoaXMgaXMgYSB0ZXN0IGZpbGUuClBLAwQUAAAACAC4gD5b26eDyRAAAAAVAAAACQAcAGZpbGUzLnR4dFVUCQADS2LcaExi3Gh1eAsAAQT1AQAABBQAAADzycxLVTDk8gFRRhDKmAsAUEsBAh4DCgAAAAAAuIA+W4Se6LQOAAAADgAAAAkAGAAAAAAAAQAAAKSBAAAAAGZpbGUxLnR4dFVUBQADS2LcaHV4CwABBPUBAAAEFAAAAFBLAQIeAwoAAAAAALiAPlteuIPaFQAAABUAAAAJABgAAAAAAAEAAACkgVEAAABmaWxlMi50eHRVVAUAA0ti3Gh1eAsAAQT1AQAABBQAAABQSwECHgMUAAAACAC4gD5b26eDyRAAAAAVAAAACQAYAAAAAAABAAAApIGpAAAAZmlsZTMudHh0VVQFAANLYtxodXgLAAEE9QEAAAQUAAAAUEsFBgAAAAADAAMA7QAAAPwAAAAAAA==';

/**
 * Base64 encoded test-nested.zip
 *
 * Tree structure:
 * .
 * └── subdir/
 *     └── nested.txt (20 bytes, stored)
 *
 * File contents:
 * - subdir/nested.txt: "Nested file content\n"
 */
const TEST_NESTED_ZIP_BASE64 =
	'UEsDBAoAAAAAAPaAPlsAAAAAAAAAAAAAAAAHABwAc3ViZGlyL1VUCQADv2LcaL9i3Gh1eAsAAQT1AQAABBQAAABQSwMECgAAAAAA9oA+W9HSoggUAAAAFAAAABEAHABzdWJkaXIvbmVzdGVkLnR4dFVUCQADv2LcaL9i3Gh1eAsAAQT1AQAABBQAAABOZXN0ZWQgZmlsZSBjb250ZW50ClBLAQIeAwoAAAAAAPaAPlsAAAAAAAAAAAAAAAAHABgAAAAAAAAAEADtQQAAAABzdWJkaXIvVVQFAAO/YtxodXgLAAEE9QEAAAQUAAAAUEsBAh4DCgAAAAAA9oA+W9HSoggUAAAAFAAAABEAGAAAAAAAAQAAAKSBQQAAAHN1YmRpci9uZXN0ZWQudHh0VVQFAAO/YtxodXgLAAEE9QEAAAQUAAAAUEsFBgAAAAACAAIApAAAAKAAAAAAAA==';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}
	return bytes.buffer;
}

describe('ZipReader', () => {
	describe('basic zip file', () => {
		it('should read file list from test.zip', async () => {
			const zipData = base64ToArrayBuffer(TEST_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const files = zipReader.getFiles();
			expect(files.length).toBe(3);

			const filenames = files.map((f) => f.filename).sort();
			expect(filenames).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);
		});

		it('should extract file1.txt content', async () => {
			const zipData = base64ToArrayBuffer(TEST_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const stream = zipReader.extractFile('file1.txt');
			expect(stream).not.toBeNull();

			if (stream) {
				const reader = stream.getReader();
				const decoder = new TextDecoder();
				let text = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					text += decoder.decode(value, { stream: true });
				}
				text += decoder.decode();

				expect(text).toBe('Hello, World!\n');
			}
		});

		it('should extract file2.txt content', async () => {
			const zipData = base64ToArrayBuffer(TEST_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const stream = zipReader.extractFile('file2.txt');
			expect(stream).not.toBeNull();

			if (stream) {
				const reader = stream.getReader();
				const decoder = new TextDecoder();
				let text = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					text += decoder.decode(value, { stream: true });
				}
				text += decoder.decode();

				expect(text).toBe('This is a test file.\n');
			}
		});

		it('should extract file3.txt content with multiple lines', async () => {
			const zipData = base64ToArrayBuffer(TEST_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const stream = zipReader.extractFile('file3.txt');
			expect(stream).not.toBeNull();

			if (stream) {
				const reader = stream.getReader();
				const decoder = new TextDecoder();
				let text = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					text += decoder.decode(value, { stream: true });
				}
				text += decoder.decode();

				expect(text).toBe('Line 1\nLine 2\nLine 3\n');
			}
		});

		it('should return null for non-existent file', async () => {
			const zipData = base64ToArrayBuffer(TEST_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const stream = zipReader.extractFile('nonexistent.txt');
			expect(stream).toBeNull();
		});

		it('should have correct file metadata', async () => {
			const zipData = base64ToArrayBuffer(TEST_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const file1 = zipReader.getFiles().find((f) => f.filename === 'file1.txt');
			expect(file1).toBeDefined();
			expect(file1?.encrypted).toBe(false);
			expect(file1?.uncompressedSize).toBe(14);
			expect(file1?.compressionMethod).toBe(0); // stored

			const file3 = zipReader.getFiles().find((f) => f.filename === 'file3.txt');
			expect(file3).toBeDefined();
			expect(file3?.encrypted).toBe(false);
			expect(file3?.uncompressedSize).toBe(21);
			expect(file3?.compressionMethod).toBe(8); // deflated
		});
	});

	describe('nested zip file', () => {
		it('should read nested directory structure', async () => {
			const zipData = base64ToArrayBuffer(TEST_NESTED_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const files = zipReader.getFiles();
			expect(files.length).toBe(2);

			const filenames = files.map((f) => f.filename).sort();
			expect(filenames).toEqual(['subdir/', 'subdir/nested.txt']);
		});

		it('should extract nested file content', async () => {
			const zipData = base64ToArrayBuffer(TEST_NESTED_ZIP_BASE64);
			const zipReader = new ZipReader(zipData);

			const stream = zipReader.extractFile('subdir/nested.txt');
			expect(stream).not.toBeNull();

			if (stream) {
				const reader = stream.getReader();
				const decoder = new TextDecoder();
				let text = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					text += decoder.decode(value, { stream: true });
				}
				text += decoder.decode();

				expect(text).toBe('Nested file content\n');
			}
		});
	});
});
