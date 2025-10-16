# Word→PDF conversion in production

This backend converts uploaded DOC/DOCX files to PDF. On some servers, the legacy html-pdf/PhantomJS stack fails with OpenSSL/DSO provider errors:

- Auto configuration failed
- DSO support routines: could not load the shared library: libproviders.so
- configuration file routines: MODULE_LOAD_DSO: error loading dso: module=providers
- html-pdf: Received the exit code '1'

Those are typically due to PhantomJS using an outdated OpenSSL and missing provider modules on modern Linux. To avoid this, the code now uses:

1. Primary: docx-pdf (pure Node wrapper)
2. Fallback: LibreOffice (soffice) in headless mode — reliable and actively maintained

## What you need on the production server

Install LibreOffice + common fonts (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install -y libreoffice-core libreoffice-writer fonts-dejavu fonts-liberation
```

Optional: more fonts for better fidelity with user-uploaded DOCX files:

```bash
sudo apt-get install -y fonts-freefont-ttf fonts-noto fonts-noto-cjk
```

Ensure `soffice` is on PATH:

```bash
which soffice
# typically /usr/bin/soffice
```

If running under PM2/systemd, make sure the PATH includes `/usr/bin`. You can set it explicitly in your PM2 ecosystem file:

```json
{
	"apps": [
		{
			"name": "backend",
			"script": "server.js",
			"env": {
				"PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
			}
		}
	]
}
```

## How the backend falls back

- `backend/utils/wordProcessor.js` first tries `docx-pdf`.
- If it fails or the PDF isn't created, it runs: `soffice --headless --convert-to pdf --outdir <dir> <input.docx>`
- It returns the resulting PDF path or a clear error with installation hints.

## Remove legacy html-pdf/PhantomJS usage

If your production environment (or an older branch) still uses `html-pdf`, uninstall it to avoid accidental invocation and OpenSSL errors:

```bash
npm remove html-pdf phantomjs-prebuilt
```

This repo's current code path does not call `html-pdf`.

## Troubleshooting

- PDF not generated and logs say "LibreOffice fallback conversion failed":

  - Verify `soffice` is installed and visible to the running process (`which soffice`).
  - Ensure the service user has write permissions to the output directory (see uploads paths in logs).
  - Set HOME for headless LibreOffice (the code already sets HOME=/tmp if unset, but you can also export it in PM2/systemd).

- Fonts look wrong in the PDF output:

  - Install additional font packages and restart the service.

- Still seeing OpenSSL provider errors in your logs:
  - Make sure you're not running any path that still uses PhantomJS/html-pdf. Grep your code and dependencies.

## Verification checklist

- Upload a DOCX locally and on prod; ensure both create a PDF and show page count in logs.
- Confirm `template.metadata.originalPdfPath` is set and the PDF URL renders in the frontend viewer.
- Check PM2 logs for any errors after the change.
