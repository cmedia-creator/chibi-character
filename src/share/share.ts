export interface ShareFileOptions {
  blob: Blob;
  filename: string;
  title?: string;
  text?: string;
}

export async function shareFileOrDownload(options: ShareFileOptions): Promise<'shared' | 'downloaded'> {
  const file = new File([options.blob], options.filename, { type: options.blob.type || 'application/octet-stream' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: options.title,
      text: options.text,
    });
    return 'shared';
  }

  const url = URL.createObjectURL(options.blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = options.filename;
    anchor.rel = 'noopener';
    anchor.click();
    return 'downloaded';
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

export async function shareUrlOrCopy(options: {
  url: string;
  title?: string;
  text?: string;
}): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ url: options.url, title: options.title, text: options.text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
    }
  }

  await navigator.clipboard.writeText(options.url);
  return 'copied';
}
