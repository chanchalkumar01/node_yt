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

function extractQualityNumber(qualityLabel) {
    if (!qualityLabel) return 0; // Fallback for missing qualityLabel
    const match = qualityLabel.match(/\d+/); // Extract the first number
    return match ? parseInt(match[0], 10) : 0; // Convert to integer or default to 0
}

// Serve the form with available qualities in a dropdown
// 🔹 Step 1: Add YouTube Login Cookies (Manually Extracted)
const YOUTUBE_COOKIES = `SID=g.a000swi9nuBuIOD8NaH6HM5fCrItDVQi81wVQYEEp9IhRflbL-3Eb3-Nq6pxUSHQxYTNvlvzOgACgYKAb4SARQSFQHGX2MiorOSG8bzEh6zqJyF8FkFLBoVAUF8yKq5iYJIgvZhxt6-_2F86BvO0076; 
                         HSID=AbwDidialpIflgej7;
                         SSID=AARFXg1JFi8-8Gd8q;
                         SAPISID=DdiZ3gtH9ouI1ejA/A32qFJBLS9aaYFe24`;

const HEADERS = {
    "Cookie": "LOGIN_INFO=AFmmF2swRQIhAKtsWPiwExjgM1FYq5PwOA5iMDqdJlEZLdJu6NM_sn2nAiA2geNj8jzX5phANMmmfr3wWezyfQ4Zl0-umU8nE3uUOw:QUQ3MjNmeFRqUk40NGlDeS0xUWJUNnN5RlVNc0pRNHdpSFlvUnhVRW56a3hULVB5Z1E1Rmd0YjBpejRicFdUeGl4NDJVeGhyRmFTTFZLZDFkbV85YU9UdER3cTRGZjZtUVhmdlp5ckJMZGJUcDNEbUZmdzdER1FkaXNyVWF0Ul80N3FMcl90QVVhVkJqV0FWNEUwQk5wcnV4VHJPUVJoSll3; VISITOR_INFO1_LIVE=FWV44X0mXLc; VISITOR_PRIVACY_METADATA=CgJJThIEGgAgEg%3D%3D; YSC=ezEaAmqhjt4; HSID=AbwDidialpIflgej7; SSID=AARFXg1JFi8-8Gd8q; APISID=VR1iB1DKWACzj0Og/AocfbdUDt4yEFePTG; SAPISID=DdiZ3gtH9ouI1ejA/A32qFJBLS9aaYFe24; __Secure-1PAPISID=DdiZ3gtH9ouI1ejA/A32qFJBLS9aaYFe24; __Secure-3PAPISID=DdiZ3gtH9ouI1ejA/A32qFJBLS9aaYFe24; SID=g.a000swi9nuBuIOD8NaH6HM5fCrItDVQi81wVQYEEp9IhRflbL-3Eb3-Nq6pxUSHQxYTNvlvzOgACgYKAb4SARQSFQHGX2MiorOSG8bzEh6zqJyF8FkFLBoVAUF8yKq5iYJIgvZhxt6-_2F86BvO0076; __Secure-1PSID=g.a000swi9nuBuIOD8NaH6HM5fCrItDVQi81wVQYEEp9IhRflbL-3EwYqk-7GpAdPmLozlvlzzewACgYKAS4SARQSFQHGX2MiPqu9tYOpWKIyBG4YRCY1ExoVAUF8yKqrFmXkvpk7RhGaeXnYqLag0076; __Secure-3PSID=g.a000swi9nuBuIOD8NaH6HM5fCrItDVQi81wVQYEEp9IhRflbL-3EpASEy7PuBSScOMMsurhkaAACgYKAQESARQSFQHGX2Miyi2W8ebnZJ5qTrGzQ1fsrBoVAUF8yKrnvqNtmlvE73U1gc0rk-Nr0076; PREF=f4=4000000&tz=Asia.Calcutta&f5=20000&f6=40000000&f7=18100; __Secure-ROLLOUT_TOKEN=CPDS9e7jzu7NqgEQ1MH1urjqigMYj9jm1qepiwM%3D; __Secure-1PSIDTS=sidts-CjIBmiPuTavzk7gWBgopVZA7yv5JTz-yW2aCdiHYCA1swqim5E7EJEuw55Nb9tEccRanPBAA; __Secure-3PSIDTS=sidts-CjIBmiPuTavzk7gWBgopVZA7yv5JTz-yW2aCdiHYCA1swqim5E7EJEuw55Nb9tEccRanPBAA; ST-3opvp5=session_logininfo=AFmmF2swRQIhAKtsWPiwExjgM1FYq5PwOA5iMDqdJlEZLdJu6NM_sn2nAiA2geNj8jzX5phANMmmfr3wWezyfQ4Zl0-umU8nE3uUOw%3AQUQ3MjNmeFRqUk40NGlDeS0xUWJUNnN5RlVNc0pRNHdpSFlvUnhVRW56a3hULVB5Z1E1Rmd0YjBpejRicFdUeGl4NDJVeGhyRmFTTFZLZDFkbV85YU9UdER3cTRGZjZtUVhmdlp5ckJMZGJUcDNEbUZmdzdER1FkaXNyVWF0Ul80N3FMcl90QVVhVkJqV0FWNEUwQk5wcnV4VHJPUVJoSll3; SIDCC=AKEyXzUK1tnPjxa5aj7HB1AjZIukhyWOGHE5JQO-YFWtzri_7Wp47AgbgRwfO39tlyLUZc6UmQ; __Secure-1PSIDCC=AKEyXzVRJhMhIFlENeCspQFSkmhJKDj-05JXVyZ8o_gDYouzmJ_1PdK3Eim_uBUSKxn2p0XfsQ; __Secure-3PSIDCC=AKEyXzWlo9WNUbH4ubyy1MFKXc21-BPtXoYsn6vPu37qaIitIo7Sb-NwbGQZsr5OXFNrvu3onAA",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36\n",
    "X-Origin": "https://www.youtube.com",
    "Referer": "https://www.youtube.com"
};

app.get("/get-form-options", async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send("<h1>Please provide a YouTube video URL</h1>");
    }

    try {
        const videoInfo = await ytdl.getInfo(url, {
            requestOptions: { headers: HEADERS }
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
// SSE to send download progress
app.get("/download-progress", async (req, res) => {
    const {url} = req.query;
    if (!url) {
        return res.status(400).json({error: "YouTube URL is required"});
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
        ytdl(url, {format: videoInfo.formats[0]})
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
        res.status(500).json({error: "Failed to fetch video", details: error.message});
    }
});

// Handle the download
app.get("/download", async (req, res) => {
    const {url, itag} = req.query;
    if (!url || !itag) {
        return res.status(400).json({error: "YouTube URL and quality (itag) are required"});
    }

    try {
        const videoInfo = await ytdl.getInfo(url);
        const selectedFormat = videoInfo.formats.find(format => format.itag == itag);
        if (!selectedFormat) {
            return res.status(404).json({error: "Selected quality not found"});
        }

        const videoTitle = sanitize(videoInfo.videoDetails.title);
        const mimeType = selectedFormat.mimeType.split(";")[0];

        res.header("Content-Disposition", `attachment; filename="${videoTitle}.${mimeType.split('/')[1]}"`);
        res.header("Content-Type", mimeType);

        // Stream the video to the client
        ytdl(url, {format: selectedFormat}).pipe(res);
    } catch (error) {
        console.error("Error downloading video:", error);
        res.status(500).json({error: "Failed to fetch video", details: error.message});
    }
});

// Start the server
const PORT = process.env.PORT || 3500;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
