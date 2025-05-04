# Font Gen

With this script you can convert your fonts from `.ttf`, `.otf` files to Base64 encoding. 

## Usage

Before running the script, you must place the font files in a special “`fonts`” folder. 
The files must conform to this name format: `{Font_Name}-{Font_Weight}`.

For example: `GeistMono-Black.ttf`

List of available weights:
- `100 — Thin` 
- `200 — ExtraLight`
- `200 — UltraLight`
- `300 — Light`
- `400 — Regular`
- `400 — Normal`
- `500 — Medium`
- `600 — SemiBold`
- `600 — DemiBold`
- `700 — Bold`
- `800 — ExtraBold`
- `800 — UltraBold`
- `900 — Black`
- `900 — Heavy`
- `950 — ExtraBlack`
- `950 — UltraBlack`

After that, you can run the script with the following command:

```bash
$ tsx font-gen.ts
```
