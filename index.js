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

function extractQualityNumber(qualityLabel) {
    if (!qualityLabel) return 0; // Fallback for missing qualityLabel
    const match = qualityLabel.match(/\d+/); // Extract the first number
    return match ? parseInt(match[0], 10) : 0; // Convert to integer or default to 0
}
// Serve the form with available qualities in a dropdown
const YOUTUBE_COOKIES = `SID=g.a000swi9nuBuIOD8NaH6HM5fCrItDVQi81wVQYEEp9IhRflbL-3Eb3-Nq6pxUSHQxYTNvlvzOgACgYKAb4SARQSFQHGX2MiorOSG8bzEh6zqJyF8FkFLBoVAUF8yKq5iYJIgvZhxt6-_2F86BvO0076; 
                         HSID=AbwDidialpIflgej7;
                         SSID=AARFXg1JFi8-8Gd8q;
                         SAPISID=DdiZ3gtH9ouI1ejA/A32qFJBLS9aaYFe24`;

app.get("/get-form-options", async (req, res) => {
    const {url} = req.query;
    if (!url) {
        return res.status(400).send("<h1>Please provide a YouTube video URL</h1>");
    }

    try {
        const videoInfo = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {Cookie: YOUTUBE_COOKIES},
            },
        });

        const seenQualities = new Set();
        const qualities = videoInfo.formats
            .map(format => ({
                qualityLabel: format.qualityLabel || "Unknown",
                mimeType: format.mimeType ? format.mimeType.split(";")[0] : "Unknown",
                itag: format.itag,
                hasVideo: format.hasVideo,
                url: format.url,
                qualityNumber: extractQualityNumber(format.qualityLabel),
            }))
            .filter(format => {
                if (format.hasVideo && !seenQualities.has(format.qualityLabel) && format.mimeType === "video/mp4") {
                    seenQualities.add(format.qualityLabel);
                    return true;
                }
                return false;
            })
            .sort((a, b) => b.qualityNumber - a.qualityNumber); // Sort by resolution (highest to lowest)

        const formOptions = qualities
            .map(format => `<option value="${format.itag}">${format.qualityLabel} - ${format.mimeType}</option>`)
            .join("");

        const formHTML = `
            <h1>Select a Quality to Download</h1>
            <form action="/download" method="GET">
                <input type="hidden" name="url" value="${url}">
                <select name="itag">${formOptions}</select>
                <button type="submit">Download</button>
            </form>
        `;

        res.send(formHTML);
    } catch (error) {
        console.error("Error fetching video info:", error);
        res.status(500).json({error: "Failed to fetch video details", details: error.message});
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
