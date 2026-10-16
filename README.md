# Guitaring

Phone-first guitar app (PWA): tuner, song analysis → chord sheets, hand-written and screenshot/PDF sheets, chord book + visual chord finder, video-lesson links, practice mixer, daily song ideas, gear adviser.

- Live: https://yoavlan-cmd.github.io/guitar-tuner/
- Full spec: [`docs/PRD-Guitaring-V1.md`](docs/PRD-Guitaring-V1.md) · Agent rules: [`CLAUDE.md`](CLAUDE.md)

```bash
bash tools/build.sh                      # src/parts/*.html -> index.html
python3 -m http.server 8000              # open http://localhost:8000 (mic needs https or localhost)
cd tests && npm i && npx playwright install chromium && bash ../tools/get_test_samples.sh && node tun_ui.js
bash tools/release.sh                    # build + bump sw.js cache version, then commit & push to main
```
