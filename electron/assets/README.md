# Electron Build Assets

Place your Windows icon file here before packaging:

- `icon.ico` — Windows app icon (256x256 recommended, multi-size ICO)
- `icon.icns` — macOS app icon (optional)
- `header.bmp` — NSIS installer header image (150×57 px, optional)

## Generating icon.ico from a PNG

You can use the existing logo at `frontend/public/logo.jpg`:

### Using ImageMagick (if installed):
```bash
magick convert frontend/public/logo.jpg -resize 256x256 electron/assets/icon.ico
```

### Using an online tool:
Upload `frontend/public/logo.jpg` to https://convertio.co/jpg-ico/ and save to `electron/assets/icon.ico`.

> NOTE: Without icon.ico the app will still run — electron-builder will use a default icon.
