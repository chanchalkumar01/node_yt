// const express = require('express');
// const ytdl = require('@distube/ytdl-core');
// const cors = require('cors');
// const sanitize = require('sanitize-filename');
// const app = express();
// app.use(cors());
//
// // 📌 Serve the page with available qualities in a form
// app.get("/", async (req, res) => {
//     const { url } = req.query;
//     if (!url) {
//         return res.send('<h1>Please provide a YouTube video URL</h1>');
//     }
//
//     try {
//         const videoInfo = await ytdl.getInfo(url);
//         const qualities = videoInfo.formats
//             .map(format => ({
//                 qualityLabel: format.qualityLabel,
//                 mimeType: format.mimeType.split(';')[0], // Only the MIME type (e.g., video/mp4)
//                 itag: format.itag,
//                 hasVideo: format.hasVideo,
//                 hasAudio: format.hasAudio,
//                 url: format.url
//             }))
//             .filter(format => format.hasVideo || format.hasAudio); // Filter to keep valid formats
//
//         // Generate the form dynamically
//         const formOptions = qualities.map(format => {
//             return `<option value="${format.itag}">${format.qualityLabel} - ${format.mimeType}</option>`;
//         }).join('');
//
//         const formHTML = `
//             <h1>Select a Quality to Download</h1>
//             <form action="/download" method="GET">
//                 <input type="hidden" name="url" value="${url}">
//                 <select name="itag">
//                     ${formOptions}
//                 </select>
//                 <button type="submit">Download</button>
//             </form>
//         `;
//
//         res.send(formHTML);
//     } catch (error) {
//         console.error("Error fetching video info:", error);
//         res.status(500).json({ error: "Failed to fetch video details", details: error.message });
//     }
// });
//
// // 📌 Download the selected quality
// app.get("/download", async (req, res) => {
//     try {
//         const { url, itag } = req.query;
//         if (!url || !itag) {
//             return res.status(400).json({ error: "YouTube URL and quality (itag) are required" });
//         }
//
//         const videoInfo = await ytdl.getInfo(url);
//
//         // Find the selected format based on itag
//         const selectedFormat = videoInfo.formats.find(format => format.itag == itag);
//
//         if (!selectedFormat) {
//             return res.status(404).json({ error: "Selected quality not found" });
//         }
//
//         // Get the video title and sanitize it for the filename
//         const videoTitle = sanitize(videoInfo.videoDetails.title);
//         const mimeType = selectedFormat.mimeType.split(";")[0]; // Get the MIME type, e.g., "video/mp4"
//
//         // Set the correct Content-Disposition header for download
//         res.header("Content-Disposition", `attachment; filename="${videoTitle}.${mimeType.split('/')[1]}"`);
//         res.header("Content-Type", mimeType); // Set correct content type for video
//
//         // Stream the video with the selected format (itag)
//         ytdl(url, { format: selectedFormat })
//             .pipe(res)
//             .on('finish', () => {
//                 console.log("Download finished");
//             });
//     } catch (error) {
//         console.error("Error downloading video:", error);
//         res.status(500).json({ error: "Failed to fetch video", details: error.message });
//     }
// });
//
// // 📌 Start server
// const PORT = process.env.PORT || 3500;
// app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));





const express = require('express');
const ytdl = require('@distube/ytdl-core');
const cors = require('cors');
const sanitize = require('sanitize-filename');
const app = express();
app.use(cors());

// Serve the form with available qualities in a dropdown
app.get("/get-form-options", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('<h1>Please provide a YouTube video URL</h1>');
    }

    try {
        const videoInfo = await ytdl.getInfo(url);
        const qualities = videoInfo.formats
            .map(format => ({
                qualityLabel: format.qualityLabel,
                mimeType: format.mimeType.split(';')[0],
                itag: format.itag,
                hasVideo: format.hasVideo,
                hasAudio: format.hasAudio,
                url: format.url
            }))
            .filter(format => format.hasVideo || format.hasAudio);

        const formOptions = qualities.map(format => {
            return `<option value="${format.itag}">${format.qualityLabel} - ${format.mimeType}</option>`;
        }).join('');

        const formHTML = `
            <h1>Select a Quality to Download</h1>
            <form action="/download" method="GET">
                <input type="hidden" name="url" value="${url}">
                <select name="itag">
                    ${formOptions}
                </select>
                <button type="submit">Download</button>
            </form>
            <div id="download-progress" style="margin-top: 20px;">
                <div>Progress: <span id="progress">0%</span></div>
                <div>Time Left: <span id="timeRemaining">N/A</span></div>
                <div>Size: <span id="videoSize">0 MB</span></div>
                <progress id="progressBar" value="0" max="100" style="width: 100%;"></progress>
            </div>
            <script>
                const progressBar = document.getElementById('progressBar');
                const progressText = document.getElementById('progress');
                const timeText = document.getElementById('timeRemaining');
                const sizeText = document.getElementById('videoSize');
                
                // Track download progress from server
                const source = new EventSource('/download-progress?url=${url}');
                source.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    if (data.progress !== undefined) {
                        progressBar.value = data.progress;
                        progressText.innerText = data.progress + '%';
                    }
                    if (data.timeLeft !== undefined) {
                        timeText.innerText = 'Time Left: ' + data.timeLeft + 's';
                    }
                    if (data.sizeMB !== undefined) {
                        sizeText.innerText = (data.sizeMB).toFixed(2) + ' MB';
                    }
                };
            </script>
        `;
        res.send(formHTML);
    } catch (error) {
        console.error("Error fetching video info:", error);
        res.status(500).json({ error: "Failed to fetch video details", details: error.message });
    }
});

// SSE to send download progress
app.get("/download-progress", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: "YouTube URL is required" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const videoInfo = await ytdl.getInfo(url);
        const videoSize = videoInfo.formats[0].contentLength || 0;
        const sizeMB = videoSize / 1024 / 1024; // Convert bytes to MB

        let downloaded = 0;
        const startTime = Date.now();

        // Stream the video with progress tracking
        ytdl(url, { format: videoInfo.formats[0] })
            .on('data', (chunk) => {
                downloaded += chunk.length;
                const elapsedTime = (Date.now() - startTime) / 1000; // in seconds
                const downloadSpeed = downloaded / elapsedTime / 1024; // KB/s
                const timeRemaining = (videoSize - downloaded) / downloadSpeed; // Estimated time in seconds

                const progress = (downloaded / videoSize) * 100;

                // Send progress info to client via SSE
                res.write(`data: ${JSON.stringify({
                    progress: progress.toFixed(2),
                    timeLeft: timeRemaining.toFixed(0),
                    sizeMB: sizeMB
                })}\n\n`);
            })
            .on('end', () => {
                console.log("Download finished");
                res.write('data: {"progress": 100, "timeLeft": 0, "sizeMB": 0}\n\n');
                res.end(); // End the connection when download finishes
            });
    } catch (error) {
        console.error("Error fetching video:", error);
        res.status(500).json({ error: "Failed to fetch video", details: error.message });
    }
});

// Handle the download
app.get("/download", async (req, res) => {
    const { url, itag } = req.query;
    if (!url || !itag) {
        return res.status(400).json({ error: "YouTube URL and quality (itag) are required" });
    }

    try {
        const videoInfo = await ytdl.getInfo(url);
        const selectedFormat = videoInfo.formats.find(format => format.itag == itag);
        if (!selectedFormat) {
            return res.status(404).json({ error: "Selected quality not found" });
        }

        const videoTitle = sanitize(videoInfo.videoDetails.title);
        const mimeType = selectedFormat.mimeType.split(";")[0];

        res.header("Content-Disposition", `attachment; filename="${videoTitle}.${mimeType.split('/')[1]}"`);
        res.header("Content-Type", mimeType);

        // Stream the video to the client
        ytdl(url, { format: selectedFormat }).pipe(res);
    } catch (error) {
        console.error("Error downloading video:", error);
        res.status(500).json({ error: "Failed to fetch video", details: error.message });
    }
});

// Start the server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
