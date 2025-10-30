# Download Required Fonts

The backend needs TrueType Font (.ttf) files to render typed signatures in the PDF.

## Steps:

1. Create the fonts folder:
   ```powershell
   mkdir fonts
   ```

2. Download the following fonts from Google Fonts and save them as .ttf files in the `backend/fonts/` folder:

   - **Dancing Script** → Save as `dancing-script.ttf`
   - **Great Vibes** → Save as `great-vibes.ttf`
   - **Allura** → Save as `allura.ttf`
   - **Alex Brush** → Save as `alex-brush.ttf`
   - **Amatic SC** → Save as `amatic-sc.ttf`
   - **Caveat** → Save as `caveat.ttf`
   - **Kaushan Script** → Save as `kaushan-script.ttf`
   - **Pacifico** → Save as `pacifico.ttf`
   - **Satisfy** → Save as `satisfy.ttf`
   - **Permanent Marker** → Save as `permanent-marker.ttf`

## Download Links:

- Dancing Script: https://fonts.google.com/specimen/Dancing+Script
- Great Vibes: https://fonts.google.com/specimen/Great+Vibes
- Allura: https://fonts.google.com/specimen/Allura
- Alex Brush: https://fonts.google.com/specimen/Alex+Brush
- Amatic SC: https://fonts.google.com/specimen/Amatic+SC
- Caveat: https://fonts.google.com/specimen/Caveat
- Kaushan Script: https://fonts.google.com/specimen/Kaushan+Script
- Pacifico: https://fonts.google.com/specimen/Pacifico
- Satisfy: https://fonts.google.com/specimen/Satisfy
- Permanent Marker: https://fonts.google.com/specimen/Permanent+Marker

## Quick Download Instructions:

1. Go to each Google Fonts link
2. Click "Download family"
3. Extract the .zip file
4. Find the .ttf file (usually in a "static" folder)
5. Rename it to match the name above (e.g., `DancingScript-Regular.ttf` → `dancing-script.ttf`)
6. Copy it to `backend/fonts/`

After adding the fonts, restart the backend server and try signing again!
