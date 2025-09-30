import { ZipReader } from './zip';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Please POST a file', { status: 405 });
		}

		const formData = await request.formData();
		const file = formData.get('file');

		if (!file || !(file instanceof File)) {
			return new Response('No file uploaded', { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const zipReader = new ZipReader(arrayBuffer);

		console.log(`\nProcessing zip file: ${file.name}`);
		console.log(`Total entries: ${zipReader.getFiles().length}\n`);

		// Extract and log contents of each file
		for (const fileInfo of zipReader.getFiles()) {
			console.log(`\n=== ${fileInfo.filename} ===`);
			try {
				const stream = await zipReader.extractFile(fileInfo.filename);
				if (stream) {
					// Read stream to text
					const reader = stream.getReader();
					const decoder = new TextDecoder();
					let text = '';

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						text += decoder.decode(value, { stream: true });
					}
					text += decoder.decode(); // Flush decoder

					console.log(text);
				} else {
					console.log('File not found');
				}
			} catch (error) {
				console.log(`Error extracting file: ${error}`);
			}
		}

		return new Response(`Processed ${zipReader.getFiles().length} entries from ${file.name}`, {
			headers: { 'Content-Type': 'text/plain' },
		});
	},
} satisfies ExportedHandler<Env>;
