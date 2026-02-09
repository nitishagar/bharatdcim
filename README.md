# BharatDCIM

India's first DCIM with native Time-of-Day tariff billing for data centers.

## Features

- **ToD Power Tariff Calculator** - Interactive calculator with state-wise tariff data
- **State Coverage** - Maharashtra, Tamil Nadu, Karnataka, Telangana
- **Full Bill Breakdown** - Energy charges, demand charges, GST, PF penalties
- **Example Scenarios** - Pre-built configurations for quick estimation

## Tech Stack

- [Astro](https://astro.build) 5.0
- [Tailwind CSS](https://tailwindcss.com) 4.x
- [React](https://react.dev) 19.x (for interactive components)
- TypeScript

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── TodCalculator.tsx    # Interactive ToD calculator
│   ├── data/
│   │   └── tariffs.ts           # State-wise tariff data
│   ├── layouts/
│   │   └── Layout.astro         # Main layout with nav/footer
│   ├── pages/
│   │   ├── index.astro          # Homepage
│   │   ├── calculator.astro     # ToD Calculator page
│   │   ├── product.astro        # Product features
│   │   ├── pricing.astro        # Pricing plans
│   │   ├── about.astro          # About us
│   │   ├── contact.astro        # Contact form
│   │   └── blog/
│   │       └── index.astro      # Blog/Resources index
│   └── styles/
│       └── global.css           # Design system & Tailwind
└── package.json
```

## Deployment

Configured for Cloudflare Pages:
- Build command: `npm run build`
- Output directory: `dist`

## License

Proprietary - BharatDCIM
