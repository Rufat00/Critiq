# Critiq logos

- `critiq-wordmark.webp`: tightly cropped, transparent full logo with dark lettering.
- `critiq-mark.webp`: the C cropped from the wordmark's symbol layer, with identical colors.
- `critiq-wordmark-symbol.webp` and `critiq-wordmark-lettering.webp`: aligned layers used by the component so lettering can inherit the theme's text color.
- `originals/`: renamed, unmodified source PNGs.

Use the shared component:

```tsx
import { Logo } from '@/components/logo';

<Logo />
<Logo variant="mark" className="h-10" />
```

The default is the full wordmark. Set its height with `className`; width follows the artwork's aspect ratio. Lettering inherits `currentColor`, which uses the theme's foreground by default. Use `alt=""` when adjacent text already names Critiq.

Background removal and lettering recoloring used the built-in imagegen tool. Final edit prompt: remove the textured background to transparent alpha, change white lettering to `#202020`, and preserve the blue C, letter contours, spacing, and gradients. The standalone C is a direct crop of the final wordmark, not a separately generated image. Assets use lossless WebP encoding.
