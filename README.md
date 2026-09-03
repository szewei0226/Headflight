# HeadFlight — iPhone GitHub Pages edition 1.1

This version fixes the common iPhone failure where camera permission succeeds but the external face-tracking resources fail afterward. GitHub Actions now downloads MediaPipe, its WebAssembly files, and the face model while publishing. Safari receives them from the same HTTPS address as the game.

## Update an existing `headflight` repository

Use a computer for this update because the package contains nested `.github/workflows` and `scripts` folders.

1. Extract `HeadFlight-GitHub-Pages.zip`.
2. Copy all extracted files and folders into your local `headflight` repository, replacing the older files.
3. In Terminal or Command Prompt, from that repository, run:

```bash
git add .
git commit -m "Fix iPhone camera tracking"
git push
```

4. On GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, change **Source** to **GitHub Actions**.
6. Open the repository's **Actions** tab and select **Deploy HeadFlight to GitHub Pages**.
7. Wait for its status to become green. Use the URL shown in the deployment result.

## Create a new repository

1. Create an empty public GitHub repository named `headflight`.
2. Extract this ZIP on a computer and open Terminal or Command Prompt inside the extracted folder.
3. Run the following, replacing `YOUR-USERNAME`:

```bash
git init
git add .
git commit -m "Publish HeadFlight"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/headflight.git
git push -u origin main
```

4. Open **Settings → Pages** and select **GitHub Actions** as the publishing source.
5. Open **Actions** and wait for **Deploy HeadFlight to GitHub Pages** to finish.

The normal address is:

```text
https://YOUR-USERNAME.github.io/headflight/
```

GitHub documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Use on iPhone

1. Open the HTTPS Pages link directly in Safari, not an embedded browser inside another app.
2. Tap **Enable camera** and choose **Allow**.
3. Keep the page open while the tracker starts. The first launch may take several seconds.
4. Centre your head and tap **I'm ready** when the indicator turns green.
5. Landscape gives a wider game area, but portrait is supported.

The camera frames are processed locally and are not recorded or uploaded. The deployed tracker code and model are downloaded from your own GitHub Pages address.

## Troubleshooting

- **The old Camera unavailable screen still appears immediately:** verify that the latest GitHub Action is green, then close the Safari tab and reopen the Pages link. Version 1.1 adds `?v=1.1.0` to refresh cached code.
- **The message says the camera was allowed but its preview could not start:** close FaceTime and other camera apps, restart Safari, and try again.
- **The message says face-tracking code or model could not load:** open the GitHub Actions result and check that the build completed. The workflow must deploy `dist`, not the repository root.
- **The workflow does not start:** confirm the workflow exists at `.github/workflows/pages.yml`, the branch is named `main`, and Pages Source is **GitHub Actions**.
- **Camera permission:** in Safari, open the page controls and set Camera to Allow. You can also review **iPhone Settings → Apps → Safari → Camera**.
- **Tracker is slow:** close other Safari tabs and use landscape orientation. The game already limits tracking to approximately 24–26 updates per second.

## Deployment contents

The workflow creates `dist/` with:

- the game HTML, CSS, and JavaScript;
- MediaPipe's JavaScript bundle;
- MediaPipe WebAssembly runtime files; and
- the Face Landmarker model.

No Node.js server runs after deployment; GitHub Pages serves ordinary static files over HTTPS.
