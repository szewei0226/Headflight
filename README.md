# HeadFlight — GitHub Pages edition

This edition is a static website designed for GitHub Pages and recent iPhone Safari versions. It has no build step and no server-side dependencies.

## Publish with the GitHub website

1. Sign in at https://github.com and create a new repository named `headflight`.
2. Choose **Public**. GitHub Pages availability for private repositories depends on your GitHub plan.
3. Extract `HeadFlight-GitHub-Pages.zip` on a computer.
4. In the empty repository, choose **Add file → Upload files**.
5. Upload the contents of this folder—not the ZIP itself. `index.html` must be at the repository root.
6. Commit the files to the `main` branch.
7. Open **Settings → Pages**.
8. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
9. Select branch **main**, folder **/(root)**, then choose **Save**.
10. Wait for the Pages deployment to complete. GitHub will show the live address.

The normal address is:

```text
https://YOUR-USERNAME.github.io/headflight/
```

GitHub documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Publish with Git on a computer

Create the empty GitHub repository first, open a terminal inside this folder, and run:

```bash
git init
git add .
git commit -m "Publish HeadFlight"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/headflight.git
git push -u origin main
```

Then enable GitHub Pages using steps 7–9 above.

## Use on iPhone

1. Open the HTTPS Pages link directly in Safari. Avoid opening it inside an email or social-media app's embedded browser.
2. Tap **Enable camera** and choose **Allow**.
3. Hold the phone still, centre your head, and tap **I'm ready** when the indicator is green.
4. Landscape gives a wider game area, but portrait mode is supported.
5. Keep an internet connection available: the face-tracking library and model download when the game starts. Camera images stay on the device and are not uploaded.

Optional: use Safari's **Share → Add to Home Screen** command for an app-like shortcut.

## iPhone troubleshooting

- **Camera permission denied:** Open iPhone **Settings → Apps → Safari → Camera** and select **Ask** or **Allow**, then reload the game.
- **Blank camera or camera busy:** Close other apps using the camera, close the Safari tab, and reopen the Pages link.
- **Tracker remains on “Loading”:** Disable content blockers for the page and check the internet connection. The game needs access to jsDelivr and Google's MediaPipe model host.
- **Page shows source files instead of the game:** Confirm that `index.html` is in the repository root and Pages is configured for `main` and `/(root)`.
- **Changes are not visible:** Wait a minute, reload the page, or open the link in a new private tab to bypass the previous cached version.

## Privacy

The camera stream is processed in Safari with MediaPipe Face Landmarker. Frames are not recorded, stored, or transmitted by this project. The browser downloads the face-tracking code and model from their public hosts.
