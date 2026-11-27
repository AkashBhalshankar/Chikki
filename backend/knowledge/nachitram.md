# NaChitram: screen, webcam and whiteboard recorder (Chrome extension)

## What NaChitram is
NaChitram is a free Chrome extension (listed as "NaChitram - Screen, Webcam & Whiteboard Recorder") that Akash built for teachers, tutors and creators. It records the screen and webcam together, lets the presenter draw on the page while talking, and offers a private teleprompter that never appears in the recorded video. It is in the Productivity category.

## Privacy by design
Recording, editing, AI backgrounds and storage all happen inside the user's browser. There is no NaChitram account, no servers and no cloud video upload; videos are saved straight to the user's own computer. The extension makes no network requests of its own and collects no analytics. Optional Live Captions is off by default and uses Chrome's speech-recognition interface, which may process microphone audio through Google's speech service.

## Features
- Record a tab, a window or the whole screen, with microphone and tab sound.
- A draggable, resizable round webcam bubble.
- A live whiteboard: pen, highlighter, text, sticky notes, callouts, arrows and a grouped shape gallery with fills, outlines, rotation and layers; select, move, resize, style, duplicate and lock annotations, with undo and redo.
- Focus mode, a cursor spotlight and a draggable teleprompter; a separate presenter-only teleprompter window when recording a tab or window.
- Neon and pastel inks and four stroke widths.
- Noise suppression, echo cancellation and a gentle compressor for cleaner audio.
- Pause and resume without losing place, and emoji reactions that float across the screen.
- Download as WebM (or MP4 where the browser supports it); export the whiteboard as a PNG and a notes summary as Markdown.

## How it is built
- A Chrome Manifest V3 extension. Because MV3 service workers cannot use MediaRecorder or the Web Audio API, a hidden offscreen page records active-tab streams and mixes microphone audio; window and screen streams are recorded by the extension's own picker page. Neither page loads remote content.
- It uses the activeTab, scripting, storage, unlimitedStorage, downloads, tabCapture and offscreen permissions, each with a plain-language justification for the Chrome Web Store.
- To handle recordings of hundreds of megabytes, the video is written in small chunks to the browser's local database while recording, so a long lesson is not held in memory and survives a browser crash.
- It injects the toolbar, whiteboard canvas and camera bubble into the tab the user chose to record, and loads no remote code.

## Limits worth knowing
Chrome does not allow any extension to run on chrome:// pages or the Chrome Web Store. Tab and window capture exclude the separate teleprompter, while entire-screen capture includes everything visible.

## Business model
NaChitram is free; after saving a recording a card offers an optional, voluntary coffee tip.
