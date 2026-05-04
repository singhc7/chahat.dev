# Chahat Sandhu - Personal Portfolio

[![Deploy Hugo site to Pages](https://github.com/singhc7/chahat.dev/actions/workflows/deploy.yaml/badge.svg)](https://github.com/singhc7/chahat.dev/actions/workflows/deploy.yaml)

This is the source code for my personal website,
**[chahat.dev](https://chahat.dev/)**. It serves as my portfolio and a space to
share my exploration of Linux, open source, and software engineering.

The site is built with a focus on **privacy, efficiency, and minimalism**. It
maximizes resources and strips away the bloat, relying on a robust custom
architecture rather than pre-built themes.

## ✨ Features

- **High Performance:** Built with [Hugo](https://gohugo.io/) for incredibly
  fast static site generation.
- **Custom Design:** Uses a bespoke single-page layout with smooth scroll-snap
  transitions.
- **Auto Theme Support:** Seamlessly switches between light and dark modes based
  on your OS settings using CSS variables.
- **Responsive & Accessible:** Adapts perfectly to different screen sizes and
  devices.
- **No Bloat:** Built with Vanilla HTML/CSS. Minimal JavaScript is used only for
  initializing icons.

## 🛠️ Tech Stack

- **Static Site Generator:** Hugo (Extended)
- **Styling:** Vanilla CSS
- **Icons:** [Lucide](https://lucide.dev/)
- **Hosting/Deployment:** GitHub Pages & GitHub Actions

## 🚀 Local Development

If you'd like to run this site locally, follow these steps:

### Prerequisites

You will need to have **Hugo Extended** (v0.152.2 or later recommended)
installed on your system.

- [Hugo Installation Guide](https://gohugo.io/installation/)

### Getting Started

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/singhc7/chahat.dev.git
    cd chahat.dev
    ```

2.  **Start the development server:**

    ```bash
    hugo server -D
    ```

    The `-D` flag includes draft content.

3.  **View the site:** Open your browser and navigate to
    `http://localhost:1313/`. The server supports live reloading, so changes
    will appear instantly.

### Production Build

To generate the static HTML files for production:

```bash
hugo --gc --minify
```

This will create a `public/` directory containing the optimized, minified site
ready for deployment.

## 📦 Deployment

This repository is configured with a GitHub Actions workflow
(`.github/workflows/deploy.yaml`). Any push to the `main` branch automatically
builds the site using Hugo and deploys the generated `public/` folder to GitHub
Pages.

## 📄 License & Copyright

The source code for this project is licensed under the **GNU Affero General
Public License v3.0 (AGPL-3.0)**. You are free to reuse the layout and styling
for your own purposes, provided you maintain the same license and provide source
code access if you modify the software. However, all personal content
(biography, text, and branding) remains the copyrighted property of Chahat
Sandhu.

**Note for Commercial/Proprietary Use:** If you wish to implement this code in a
proprietary product without releasing your codebase, please contact me at
**contact@chahat.dev** to negotiate a separate license.

See the [LICENSE](./LICENSE) file for the full terms and conditions.

&copy; 2026 Chahat Sandhu. All rights reserved.
